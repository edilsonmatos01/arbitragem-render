require('dotenv').config();

import { WebSocket, WebSocketServer } from 'ws';
import { createServer, IncomingMessage, Server } from 'http';
import { GateIoConnector } from './src/gateio-connector';
import { MexcConnector } from './src/mexc-connector';
import { MarketPrices, ArbitrageOpportunity } from './src/types';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PORT = process.env.PORT || 10000;
const MIN_PROFIT_PERCENTAGE = 0.1;

let marketPrices: MarketPrices = {};
let targetPairs: string[] = [];

// Estendemos a interface do WebSocket para adicionar nossa propriedade de controle
interface CustomWebSocket extends WebSocket {
  isAlive?: boolean;
}

let clients: CustomWebSocket[] = []; // Usamos o tipo estendido

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

export function startWebSocketServer(httpServer: Server) {
    const wss = new WebSocketServer({ server: httpServer });

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

    for (const spotId of exchangeIdentifiers.filter(id => !id.toUpperCase().includes('FUTURES'))) {
        const futuresId = exchangeIdentifiers.find(id => id.toUpperCase().includes('FUTURES'));
        if (!futuresId) continue;

        const spotPrices = marketPrices[spotId];
        const futuresPrices = marketPrices[futuresId];

        for (const spotSymbol in spotPrices) {
            const spotData = getNormalizedData(spotSymbol);
            
            const futuresSymbol = Object.keys(futuresPrices).find(fs => {
                const futuresData = getNormalizedData(fs);
                return futuresData.baseSymbol === spotData.baseSymbol;
            });

            if (futuresSymbol) {
                const futuresData = getNormalizedData(futuresSymbol);
                
                const buyPriceSpot = spotPrices[spotSymbol].bestAsk * (futuresData.factor / spotData.factor);
                const sellPriceFutures = futuresPrices[futuresSymbol].bestBid;
                
                const buyPriceFutures = futuresPrices[futuresSymbol].bestAsk;
                const sellPriceSpot = spotPrices[spotSymbol].bestBid * (futuresData.factor / spotData.factor);

                if (buyPriceSpot <= 0 || sellPriceFutures <= 0 || buyPriceFutures <= 0 || sellPriceSpot <= 0) {
                    console.warn(`[DEBUG] Preços inválidos para ${spotSymbol}:`, {
                        buyPriceSpot,
                        sellPriceFutures,
                        buyPriceFutures,
                        sellPriceSpot
                    });
                    continue;
                }
                
                // Calcular preços médios para comparação mais justa
                const spotMidPrice = (spotPrices[spotSymbol].bestAsk + spotPrices[spotSymbol].bestBid) / 2;
                const futuresMidPrice = (futuresPrices[futuresSymbol].bestAsk + futuresPrices[futuresSymbol].bestBid) / 2;
                
                // Normalizar preços se necessário
                const normalizedSpotMid = spotMidPrice * (futuresData.factor / spotData.factor);
                
                // Fórmula simplificada: Spread (%) = ((Futures - Spot) / Spot) × 100
                const spread = ((futuresMidPrice - normalizedSpotMid) / normalizedSpotMid) * 100;
                
                // Só processar se o spread for significativo e dentro dos limites
                if (Math.abs(spread) >= 0.1 && Math.abs(spread) <= 10) {
                    const opportunity: ArbitrageOpportunity = {
                        type: 'arbitrage',
                        baseSymbol: spotData.baseSymbol,
                        buyAt: spread > 0 
                            ? { exchange: spotId.split('_')[0], marketType: 'spot', price: normalizedSpotMid }
                            : { exchange: futuresId.split('_')[0], marketType: 'futures', price: futuresMidPrice },
                        sellAt: spread > 0
                            ? { exchange: futuresId.split('_')[0], marketType: 'futures', price: futuresMidPrice }
                            : { exchange: spotId.split('_')[0], marketType: 'spot', price: normalizedSpotMid },
                        arbitrageType: spread > 0 ? 'spot_to_futures' : 'futures_to_spot',
                        profitPercentage: spread, // Não usar Math.abs aqui
                        timestamp: Date.now()
                    };
                    await recordSpread(opportunity);
                    broadcastOpportunity(opportunity);
                } else {
                    console.log(`[DEBUG] Spread fora dos limites para ${spotSymbol}: ${spread.toFixed(2)}%`);
                }
            }
        }
    }
}

async function startFeeds() {
    console.log("Iniciando feeds de dados...");
    
    // Passa a função 'handlePriceUpdate' para os conectores
    const gateIoSpotConnector = new GateIoConnector('GATEIO_SPOT', handlePriceUpdate);
    const gateIoFuturesConnector = new GateIoConnector('GATEIO_FUTURES', handlePriceUpdate);
    
    const mexcConnector = new MexcConnector('MEXC_FUTURES', handlePriceUpdate, () => {
        const mexcPairs = targetPairs.map(p => p.replace('/', '_'));
        mexcConnector.subscribe(mexcPairs);
    });

    try {
        const spotPairs = await gateIoSpotConnector.getTradablePairs();
        const futuresPairs = await gateIoFuturesConnector.getTradablePairs();
        
        targetPairs = spotPairs.filter(p => futuresPairs.includes(p));
        
        console.log(`Encontrados ${targetPairs.length} pares em comum.`);
        
        gateIoSpotConnector.connect(targetPairs);
        gateIoFuturesConnector.connect(targetPairs);
        mexcConnector.connect();

        console.log(`Monitorando ${targetPairs.length} pares.`);
        setInterval(findAndBroadcastArbitrage, 5000);
    } catch (error) {
        console.error("Erro fatal ao iniciar os feeds:", error);
    }
}
