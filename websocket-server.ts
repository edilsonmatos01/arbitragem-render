require('dotenv').config();

import * as WebSocket from 'ws';
import { createServer, IncomingMessage, Server } from 'http';
import { GateIoConnector } from './src/gateio-connector';
import { MexcFuturesConnector } from './src/mexc-futures-connector';
import { MarketPrices, ArbitrageOpportunity, PriceUpdate } from './src/types';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PORT = process.env.PORT || 10000;
const MIN_PROFIT_PERCENTAGE = 0.1;

let marketPrices: MarketPrices = {};
let targetPairs: string[] = [];

interface CustomWebSocket extends WebSocket {
    isAlive?: boolean;
}

let clients: CustomWebSocket[] = [];

function handlePriceUpdate(update: PriceUpdate) {
    const { identifier, symbol, marketType, bestAsk, bestBid } = update;

    if (!marketPrices[identifier]) {
        marketPrices[identifier] = {};
    }

    marketPrices[identifier][symbol] = { 
        bestAsk, 
        bestBid, 
        timestamp: Date.now() 
    };
    
    broadcast({
        type: 'price-update',
        symbol,
        marketType,
        bestAsk,
        bestBid
    });

    // Log para debug
    console.log(`[${identifier}] Atualização de preço para ${symbol}:`);
    console.log(`Ask: ${bestAsk}, Bid: ${bestBid}`);
}

export function startWebSocketServer(httpServer: Server) {
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
        wss.clients.forEach((ws) => {
            const customWs = ws as CustomWebSocket;
            if (customWs.isAlive === false) {
                console.log('[WS Server] Conexão inativa terminada.');
                return customWs.terminate();
            }
            customWs.isAlive = false;
            customWs.ping();
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
        console.log(`[Servidor] WebSocket iniciado na porta ${PORT}`);
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
            },
        });
    } catch (error) {
        console.error(`[Prisma] Erro ao gravar spread para ${opportunity.baseSymbol}:`, error);
    }
}

async function findAndBroadcastArbitrage() {
    const gateioSpotPrices = marketPrices['GATEIO_SPOT'];
    const mexcFuturesPrices = marketPrices['MEXC_FUTURES'];

    if (!gateioSpotPrices || !mexcFuturesPrices) {
        return;
    }

    let opportunitiesFound = 0;

    for (const spotSymbol in gateioSpotPrices) {
        const futuresSymbol = spotSymbol.replace('/', '_');
        const spotData = gateioSpotPrices[spotSymbol];
        const futuresData = mexcFuturesPrices[futuresSymbol];

        if (!spotData || !futuresData) continue;
        if (spotData.bestAsk <= 0 || spotData.bestBid <= 0 || futuresData.bestAsk <= 0 || futuresData.bestBid <= 0) continue;

        // Calcula preços médios para comparação mais precisa
        const spotMidPrice = (spotData.bestAsk + spotData.bestBid) / 2;
        const futuresMidPrice = (futuresData.bestAsk + futuresData.bestBid) / 2;

        // Calcula o spread percentual
        const spread = ((futuresMidPrice - spotMidPrice) / spotMidPrice) * 100;

        // Verifica se o spread é significativo e dentro dos limites
        if (Math.abs(spread) >= MIN_PROFIT_PERCENTAGE && Math.abs(spread) <= 10) {
            opportunitiesFound++;

            if (spread > 0) {
                // Futures > Spot: Comprar Spot, Vender Futures
                const opportunity: ArbitrageOpportunity = {
                    type: 'arbitrage',
                    baseSymbol: spotSymbol,
                    buyAt: { 
                        exchange: 'GATEIO', 
                        marketType: 'spot', 
                        price: spotData.bestAsk 
                    },
                    sellAt: { 
                        exchange: 'MEXC', 
                        marketType: 'futures', 
                        price: futuresData.bestBid 
                    },
                    arbitrageType: 'spot_to_futures',
                    profitPercentage: spread,
                    timestamp: Date.now()
                };
                await recordSpread(opportunity);
                broadcastOpportunity(opportunity);
            } else {
                // Spot > Futures: Comprar Futures, Vender Spot
                const opportunity: ArbitrageOpportunity = {
                    type: 'arbitrage',
                    baseSymbol: spotSymbol,
                    buyAt: { 
                        exchange: 'MEXC', 
                        marketType: 'futures', 
                        price: futuresData.bestAsk 
                    },
                    sellAt: { 
                        exchange: 'GATEIO', 
                        marketType: 'spot', 
                        price: spotData.bestBid 
                    },
                    arbitrageType: 'futures_to_spot',
                    profitPercentage: Math.abs(spread),
                    timestamp: Date.now()
                };
                await recordSpread(opportunity);
                broadcastOpportunity(opportunity);
            }
        }
    }

    if (opportunitiesFound === 0) {
        console.log(`[Arbitragem] Nenhuma oportunidade encontrada neste momento.`);
    } else {
        console.log(`[Arbitragem] Total de ${opportunitiesFound} oportunidades encontradas.`);
    }
}

async function startFeeds() {
    console.log("Iniciando feeds de dados...");
    
    const gateIoSpot = new GateIoConnector('GATEIO_SPOT', handlePriceUpdate, () => {
        console.log('[Gate.io Spot] Conectado');
    });
    
    const mexcFutures = new MexcFuturesConnector('MEXC_FUTURES', handlePriceUpdate, () => {
        console.log('[MEXC Futures] Conectado');
    });

    try {
        // Primeiro conecta os WebSockets
        await Promise.all([
            gateIoSpot.connect(),
            mexcFutures.connect()
        ]);

        console.log('[Feeds] WebSockets conectados, buscando pares...');

        // Depois busca os pares disponíveis
        const [spotPairs, futuresPairs] = await Promise.all([
            gateIoSpot.getTradablePairs(),
            mexcFutures.getTradablePairs()
        ]);

        console.log('[Gate.io] Pares spot:', spotPairs.length);
        console.log('[MEXC] Pares futures:', futuresPairs.length);

        // Encontra pares em comum
        targetPairs = spotPairs.filter(p => {
            const mexcFormat = p.replace('/', '_');
            return futuresPairs.includes(mexcFormat);
        });

        console.log(`[Arbitragem] Pares em comum: ${targetPairs.length}`);
        console.log('Primeiros 5 pares:', targetPairs.slice(0, 5));

        // Inscreve no Gate.io com formato padrão (BTC/USDT)
        gateIoSpot.subscribe(targetPairs);

        // Inscreve no MEXC com formato específico (BTC_USDT)
        const mexcPairs = targetPairs.map(p => p.replace('/', '_'));
        mexcFutures.subscribe(mexcPairs);

        // Inicia o monitoramento de oportunidades a cada 1 segundo
        setInterval(findAndBroadcastArbitrage, 1000);
    } catch (error) {
        console.error("Erro fatal ao iniciar os feeds:", error);
    }
}
