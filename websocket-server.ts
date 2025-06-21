require('dotenv').config();

import WebSocket from 'ws';
import { createServer, IncomingMessage } from 'http';
import { GateIoConnector } from './src/gateio-connector';
import { MexcConnector } from './src/mexc-connector';
import { MarketPrices, ArbitrageOpportunity } from './src/types';
import { PrismaClient } from '@prisma/client';
import { calculateSpread } from './app/utils/spreadUtils';

const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;
const MIN_PROFIT_PERCENTAGE = 0.1;

let marketPrices: MarketPrices = {};
let targetPairs: string[] = [];

interface CustomWebSocket extends WebSocket {
    isAlive?: boolean;
}

let clients: CustomWebSocket[] = [];

// ✅ Nova função centralizadora para lidar com todas as atualizações de preço
function handlePriceUpdate(update: { type: string, symbol: string, marketType: string, bestAsk: number, bestBid: number, identifier: string }) {
    const { identifier, symbol, marketType, bestAsk, bestBid } = update;

    // 1. Atualiza o estado central de preços
    if (!marketPrices[identifier]) {
        marketPrices[identifier] = {};
    }
    marketPrices[identifier][symbol] = { bestAsk, bestBid, timestamp: Date.now() };
    
    // 2. Transmite a atualização para todos os clientes
    broadcast({
        type: 'price-update',
        symbol,
        marketType,
        bestAsk,
        bestBid
    });
}

export function startWebSocketServer(httpServer: ReturnType<typeof createServer>) {
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
        wss.clients.forEach((client: WebSocket) => {
            const ws = client as CustomWebSocket;

            if (ws.isAlive === false) {
                console.log('[WS Server] Conexão inativa terminada.');
                return ws.terminate();
            }

            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    wss.on('close', () => {
        clearInterval(interval);
    });

    console.log(`Servidor WebSocket iniciado e anexado ao servidor HTTP.`);
    startFeeds();
}

// --- Início: Adição para Servidor Standalone ---

// Esta função cria e inicia um servidor HTTP que usa a nossa lógica WebSocket.
function initializeStandaloneServer() {
    const httpServer = createServer((req, res) => {
        // O servidor HTTP básico não fará nada além de fornecer uma base para o WebSocket.
        // Podemos adicionar um endpoint de health check simples.
        if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', message: 'WebSocket server is running' }));
        } else {
            res.writeHead(404);
            res.end();
        }
    });

    // Anexa a lógica do WebSocket ao nosso servidor HTTP.
    startWebSocketServer(httpServer);

    httpServer.listen(PORT, () => {
        console.log(`[Servidor Standalone] Servidor HTTP e WebSocket escutando na porta ${PORT}`);
    });
}

// Inicia o servidor standalone.
// O `require.main === module` garante que este código só rode quando
// o arquivo é executado diretamente (ex: `node dist/websocket-server.js`),
// mas não quando é importado por outro arquivo (como o `server.js` em dev).
if (require.main === module) {
    initializeStandaloneServer();
}

// --- Fim: Adição para Servidor Standalone ---

function broadcast(data: any) {
    const serializedData = JSON.stringify(data);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(serializedData);
        }
    });
}

// Versão corrigida da função com logs de depuração
function broadcastOpportunity(opportunity: ArbitrageOpportunity) {
    console.log(`[DEBUG] Verificando ${opportunity.baseSymbol} | Spread: ${opportunity.profitPercentage.toFixed(2)}%`);

    if (!isFinite(opportunity.profitPercentage) || opportunity.profitPercentage > 100) {
        console.warn(`[FILTRO] Spread >100% IGNORADO para ${opportunity.baseSymbol}: ${opportunity.profitPercentage.toFixed(2)}%`);
        return;
    }
    
    broadcast({ ...opportunity, type: 'arbitrage' });
    console.log(`[Broadcast] Oportunidade VÁLIDA enviada: ${opportunity.baseSymbol} ${opportunity.profitPercentage.toFixed(2)}%`);
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
                timestamp: new Date()
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
        const factor = parseInt(match[1], 10);
        const baseSymbol = match[2];
        return { baseSymbol, factor };
    }
    return { baseSymbol: symbol, factor: 1 };
}

async function findAndBroadcastArbitrage() {
    const exchangeIdentifiers = Object.keys(marketPrices);
    if (exchangeIdentifiers.length < 2) return;

    const spotId = exchangeIdentifiers.find(id => id === 'GATEIO_SPOT');
    const futuresId = exchangeIdentifiers.find(id => id === 'MEXC_FUTURES');

    if (!spotId || !futuresId) return;

    const spotPrices = marketPrices[spotId];
    const futuresPrices = marketPrices[futuresId];

    for (const symbol in spotPrices) {
        if (futuresPrices[symbol]) {
            const spotAsk = spotPrices[symbol].bestAsk;
            const futuresBid = futuresPrices[symbol].bestBid;

            if (spotAsk > 0 && futuresBid > 0) {
                const profitPercentage = ((futuresBid - spotAsk) / spotAsk) * 100;

                if (profitPercentage >= MIN_PROFIT_PERCENTAGE) {
                    const opportunity: ArbitrageOpportunity = {
                        type: 'arbitrage',
                        baseSymbol: symbol,
                        profitPercentage,
                        buyAt: {
                            exchange: spotId,
                            price: spotAsk,
                            marketType: 'spot'
                        },
                        sellAt: {
                            exchange: futuresId,
                            price: futuresBid,
                            marketType: 'futures'
                        },
                        arbitrageType: 'spot_futures_inter_exchange',
                        timestamp: Date.now()
                    };

                    broadcastOpportunity(opportunity);
                }
            }
        }
    }
}

async function startFeeds() {
    try {
        console.log("Iniciando feeds de dados...");

        const gateioConnector = new GateIoConnector('GATEIO_SPOT', handlePriceUpdate, () => {
            console.log('GateIO WebSocket conectado');
        });

        const mexcConnector = new MexcConnector('MEXC_FUTURES', handlePriceUpdate, () => {
            console.log('MEXC WebSocket conectado');
        });

        // Primeiro, conecta os WebSockets
        await Promise.all([
            gateioConnector.connect(),
            mexcConnector.connect()
        ]);

        // Depois, busca os pares negociáveis
        const spotPairs = await gateioConnector.getTradablePairs();
        console.log(`[GATEIO_SPOT] Pares disponíveis: ${spotPairs.length}`);

        // Inscreve-se nos pares
        gateioConnector.subscribe(spotPairs);
        mexcConnector.subscribe(spotPairs.map(p => p.replace('/', '_')));

        // Inicia o monitoramento de arbitragem
        setInterval(findAndBroadcastArbitrage, 5000);

        console.log('Feeds iniciados com sucesso');
    } catch (error) {
        console.error('Erro ao iniciar os feeds:', error);
    }
}
