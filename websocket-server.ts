require('dotenv').config();

import WebSocket from 'ws';
import { createServer, IncomingMessage, Server } from 'http';
import { GateioConnector } from './src/gateio-connector';
import { MexcConnector } from './src/mexc-connector';
import { MarketPrices, ArbitrageOpportunity, PriceUpdate, CustomWebSocket } from './src/types';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PORT = parseInt(process.env.PORT || '8080', 10);
console.log(`[CONFIG] Iniciando servidor na porta ${PORT}`);

const MIN_PROFIT_PERCENTAGE = 0.05; // Reduzido para 0.05% para detectar mais oportunidades

let marketPrices: MarketPrices = {};
let targetPairs: string[] = [
    'BTC_USDT',
    'ETH_USDT',
    'SOL_USDT',
    'XRP_USDT',
    'BNB_USDT'
];

let clients: CustomWebSocket[] = [];

function handlePriceUpdate(update: PriceUpdate) {
    const { identifier, symbol, marketType, bestAsk, bestBid } = update;

    console.log(`[PRICE UPDATE] ${identifier.toUpperCase()}: ${symbol} - Ask: ${bestAsk}, Bid: ${bestBid}`);

    if (!marketPrices[identifier]) {
        marketPrices[identifier] = {};
        console.log(`[MARKET PRICES] Criada nova exchange: ${identifier}`);
    }
    marketPrices[identifier][symbol] = { bestAsk, bestBid, timestamp: Date.now() };
    
    // Log do estado atual dos dados
    const totalSymbols = Object.keys(marketPrices[identifier]).length;
    console.log(`[MARKET PRICES] ${identifier}: ${totalSymbols} símbolos ativos`);
    
    broadcast({
        type: 'price-update',
        symbol,
        marketType,
        bestAsk,
        bestBid
    });
}

function startWebSocketServer(httpServer: Server) {
    const wss = new WebSocket.Server({ server: httpServer });

    wss.on('connection', (ws: CustomWebSocket, req: IncomingMessage) => {
        ws.isAlive = true;

        ws.on('pong', () => {
          ws.isAlive = true;
        });
        
        const clientIp = req.socket.remoteAddress || req.headers['x-forwarded-for'];
        clients.push(ws);
        console.log(`[WS Server] Cliente conectado: ${clientIp}. Total: ${clients.length}`);

        if (Object.keys(marketPrices).length > 0) {
            ws.send(JSON.stringify({ type: 'full_book', data: marketPrices }));
        }

        ws.on('close', () => {
            clients = clients.filter(c => c !== ws);
            console.log(`[WS Server] Cliente desconectado: ${clientIp}. Total: ${clients.length}`);
        });
    });
    
    const interval = setInterval(() => {
        wss.clients.forEach(client => {
            const ws = client as CustomWebSocket;

            if (ws.isAlive === false) {
                console.log('[WS Server] Conexão inativa terminada.');
                return ws.terminate();
            }

            ws.isAlive = false; 
            ws.ping(() => {});
        });
    }, 30000);

    wss.on('close', () => {
        clearInterval(interval);
    });

    console.log(`Servidor WebSocket iniciado e anexado ao servidor HTTP.`);
    startFeeds();
}

function initializeStandaloneServer() {
    const httpServer = createServer((req, res) => {
        if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', message: 'WebSocket server is running' }));
        } else {
            res.writeHead(404);
            res.end();
        }
    });

    startWebSocketServer(httpServer);

    httpServer.listen(PORT, () => {
        console.log(`[Servidor Standalone] Servidor HTTP e WebSocket escutando na porta ${PORT}`);
    });
}

if (require.main === module) {
    initializeStandaloneServer();
}

function broadcast(data: any) {
    const serializedData = JSON.stringify(data);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(serializedData);
        }
    });
}

function broadcastOpportunity(opportunity: ArbitrageOpportunity) {
    const timestamp = new Date(opportunity.timestamp).toLocaleTimeString('pt-BR');
    const profitColor = opportunity.profitPercentage > 0.5 ? '\x1b[32m' : '\x1b[33m';
    const resetColor = '\x1b[0m';

    console.log(`
${profitColor}╔══════════════════════════════════════════════════════════════════════════════
║ 🔍 OPORTUNIDADE DETECTADA - ${timestamp}
║ 💱 Par: ${opportunity.baseSymbol}
║ 📈 Spread: ${opportunity.profitPercentage.toFixed(4)}%
║ 🔄 Direção: ${opportunity.arbitrageType}
║ 
║ 📥 COMPRA: ${opportunity.buyAt.exchange.toUpperCase()}
║    Preço: ${opportunity.buyAt.price.toFixed(8)} USDT
║    Tipo: ${opportunity.buyAt.marketType}
║ 
║ 📤 VENDA: ${opportunity.sellAt.exchange.toUpperCase()}
║    Preço: ${opportunity.sellAt.price.toFixed(8)} USDT
║    Tipo: ${opportunity.sellAt.marketType}
╚══════════════════════════════════════════════════════════════════════════════${resetColor}`);

    if (!isFinite(opportunity.profitPercentage) || opportunity.profitPercentage > 100) {
        console.warn(`\x1b[31m[ALERTA] Spread >100% IGNORADO para ${opportunity.baseSymbol}: ${opportunity.profitPercentage.toFixed(2)}%\x1b[0m`);
        return;
    }
    
    broadcast({ ...opportunity, type: 'arbitrage' });
}

async function recordSpread(opportunity: ArbitrageOpportunity) {
    if (typeof opportunity.profitPercentage !== 'number' || !isFinite(opportunity.profitPercentage)) {
        console.warn(`[Prisma] Spread inválido para ${opportunity.baseSymbol}, gravação ignorada.`);
        return;
    }

    try {
        await prisma.spreadHistory.create({
            data: {
                symbol: opportunity.baseSymbol,
                exchangeBuy: opportunity.buyAt.exchange,
                exchangeSell: opportunity.sellAt.exchange,
                direction: opportunity.arbitrageType,
                spread: opportunity.profitPercentage,
            },
        });
    } catch (error) {
        console.error(`[Prisma] Erro ao gravar spread para ${opportunity.baseSymbol}:`, error);
    }
}

async function getSpreadStats(opportunity: ArbitrageOpportunity): Promise<{ spMax: number | null; spMin: number | null; crosses: number }> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    try {
        const stats = await prisma.spreadHistory.aggregate({
            _max: { spread: true },
            _min: { spread: true },
            _count: { id: true },
            where: {
                symbol: opportunity.baseSymbol,
                exchangeBuy: opportunity.buyAt.exchange,
                exchangeSell: opportunity.sellAt.exchange,
                direction: opportunity.arbitrageType,
                timestamp: {
                    gte: twentyFourHoursAgo,
                },
            },
        });

        return {
            spMax: stats._max.spread,
            spMin: stats._min.spread,
            crosses: stats._count.id,
        };
    } catch (error) {
        console.error(`[Prisma] Erro ao buscar estatísticas de spread para ${opportunity.baseSymbol}:`, error);
        return { spMax: null, spMin: null, crosses: 0 };
    }
}

function getNormalizedData(symbol: string): { baseSymbol: string, factor: number } {
    const match = symbol.match(/^(\d+)(.+)$/);
    if (match) {
        return {
            baseSymbol: match[2],
            factor: parseInt(match[1], 10)
        };
    }
    return {
        baseSymbol: symbol,
        factor: 1
    };
}

async function findAndBroadcastArbitrage() {
    for (const symbol of targetPairs) {
        const gateioData = marketPrices['gateio']?.[symbol];
        const mexcData = marketPrices['mexc']?.[symbol];

        if (!gateioData || !mexcData) {
            // Debug: verificar quais dados estão disponíveis
            console.log(`[DEBUG] Dados ausentes para ${symbol}:`);
            console.log(`  GateIO: ${gateioData ? 'OK' : 'AUSENTE'}`);
            console.log(`  MEXC: ${mexcData ? 'AUSENTE' : 'OK'}`);
            console.log(`  Exchanges disponíveis:`, Object.keys(marketPrices));
            continue;
        }

        if (!isFinite(gateioData.bestAsk) || !isFinite(gateioData.bestBid) ||
            !isFinite(mexcData.bestAsk) || !isFinite(mexcData.bestBid)) {
            continue;
        }

        const gateioToMexc = ((mexcData.bestBid - gateioData.bestAsk) / gateioData.bestAsk) * 100;
        const mexcToGateio = ((gateioData.bestBid - mexcData.bestAsk) / mexcData.bestAsk) * 100;

        if (gateioToMexc > MIN_PROFIT_PERCENTAGE) {
            const opportunity: ArbitrageOpportunity = {
                type: 'arbitrage',
                baseSymbol: symbol,
                profitPercentage: gateioToMexc,
                arbitrageType: 'gateio_to_mexc',
                buyAt: {
                    exchange: 'gateio',
                    price: gateioData.bestAsk,
                    marketType: 'spot'
                },
                sellAt: {
                    exchange: 'mexc',
                    price: mexcData.bestBid,
                    marketType: 'futures'
                },
                timestamp: Date.now()
            };
            
            broadcastOpportunity(opportunity);
            await recordSpread(opportunity);
        }

        if (mexcToGateio > MIN_PROFIT_PERCENTAGE) {
            const opportunity: ArbitrageOpportunity = {
                type: 'arbitrage',
                baseSymbol: symbol,
                profitPercentage: mexcToGateio,
                arbitrageType: 'mexc_to_gateio',
                buyAt: {
                    exchange: 'mexc',
                    price: mexcData.bestAsk,
                    marketType: 'futures'
                },
                sellAt: {
                    exchange: 'gateio',
                    price: gateioData.bestBid,
                    marketType: 'spot'
                },
                timestamp: Date.now()
            };
            
            broadcastOpportunity(opportunity);
            await recordSpread(opportunity);
        }
    }
}

async function startFeeds() {
    console.log('[Feeds] Iniciando conexões com as exchanges...');
    const gateio = new GateioConnector();
    const mexc = new MexcConnector();

    gateio.onPriceUpdate((update) => {
        console.log('[GateIO] Atualização de preço recebida:', update);
        handlePriceUpdate(update);
    });
    
    mexc.onPriceUpdate((update) => {
        console.log('[MEXC] Atualização de preço recebida:', update);
        handlePriceUpdate(update);
    });

    try {
        console.log('[GateIO] Tentando conectar...');
        await gateio.connect();
        console.log('[GateIO] Conexão estabelecida com sucesso!');

        console.log('[MEXC] Tentando conectar...');
        await mexc.connect();
        console.log('[MEXC] Conexão estabelecida com sucesso!');

        console.log('[Feeds] Iniciando monitoramento de arbitragem...');
        setInterval(findAndBroadcastArbitrage, 1000);

    } catch (error) {
        console.error('[Feeds] Erro ao iniciar os feeds:', error);
        if (error instanceof Error) {
            console.error('[Feeds] Stack trace:', error.stack);
        }
        process.exit(1);
    }
}

export {
    startWebSocketServer,
    initializeStandaloneServer
};
