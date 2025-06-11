require('dotenv').config();

import { WebSocket, WebSocketServer } from 'ws';
import { createServer, IncomingMessage, Server } from 'http';
import { GateIoConnector } from './src/gateio-connector';
import { MexcConnector } from './src/mexc-connector';
import { MarketPrices, ArbitrageOpportunity } from './src/types';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PORT = process.env.PORT || 8888;
const MIN_PROFIT_PERCENTAGE = 0.1;

let marketPrices: MarketPrices = {};
let targetPairs: string[] = [];

// Estendemos a interface do WebSocket para adicionar nossa propriedade de controle
interface CustomWebSocket extends WebSocket {
  isAlive?: boolean;
}

let clients: CustomWebSocket[] = []; // Usamos o tipo estendido

export function startWebSocketServer(httpServer: Server) {
    const wss = new WebSocketServer({ server: httpServer });

    wss.on('connection', (ws: CustomWebSocket, req: IncomingMessage) => {
        ws.isAlive = true; // A conexão está viva ao ser estabelecida

        ws.on('pong', () => {
          ws.isAlive = true; // O cliente respondeu ao nosso ping, então está vivo
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
    
    // Intervalo para verificar conexões e mantê-las vivas
    const interval = setInterval(() => {
        wss.clients.forEach(client => {
            const ws = client as CustomWebSocket;

            if (ws.isAlive === false) {
                console.log('[WS Server] Conexão inativa terminada.');
                return ws.terminate();
            }

            ws.isAlive = false; // Presumimos que está inativa até que um 'pong' prove o contrário
            ws.ping(() => {}); // Enviamos o ping para o cliente
        });
    }, 30000); // A cada 30 segundos

    wss.on('close', () => {
        clearInterval(interval); // Limpa o intervalo quando o servidor é fechado
    });

    console.log(`Servidor WebSocket iniciado e anexado ao servidor HTTP.`);
    startFeeds();
}

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

function getNormalizedData(symbol: string, price: number): { baseSymbol: string, normalizedPrice: number } {
    const match = symbol.match(/^(\d+)(.+)$/);
    if (match) {
        const factor = parseInt(match[1], 10);
        const baseSymbol = match[2];
        return { baseSymbol, normalizedPrice: price / factor };
    }
    return { baseSymbol: symbol, normalizedPrice: price };
}

async function findAndBroadcastArbitrage() {
    const opportunities: Omit<ArbitrageOpportunity, 'spMax' | 'spMin' | 'crosses'>[] = [];
    const exchangeIdentifiers = Object.keys(marketPrices);
    if (exchangeIdentifiers.length < 2) return;

    for (let i = 0; i < exchangeIdentifiers.length; i++) {
        for (let j = i + 1; j < exchangeIdentifiers.length; j++) {
            const idA = exchangeIdentifiers[i];
            const idB = exchangeIdentifiers[j];
            const pricesA = marketPrices[idA];
            const pricesB = marketPrices[idB];
            
            const marketTypeA = idA.toUpperCase().includes('FUTURES') ? 'futures' : 'spot';
            const marketTypeB = idB.toUpperCase().includes('FUTURES') ? 'futures' : 'spot';

            if (marketTypeA === marketTypeB) continue;

            const spotId = marketTypeA === 'spot' ? idA : idB;
            const futuresId = marketTypeA === 'futures' ? idA : idB;
            const spotPrices = marketTypeA === 'spot' ? pricesA : pricesB;
            const futuresPrices = marketTypeA === 'futures' ? pricesA : pricesB;
            
            for (const spotSymbol in spotPrices) {
                const { baseSymbol: normalizedSpotSymbol, normalizedPrice: normalizedSpotAsk } = getNormalizedData(spotSymbol, spotPrices[spotSymbol].bestAsk);
                
                const futuresSymbol = Object.keys(futuresPrices).find(fs => getNormalizedData(fs, 0).baseSymbol === normalizedSpotSymbol);

                if (futuresSymbol && futuresPrices[futuresSymbol]) {
                    const { normalizedPrice: normalizedFuturesBid } = getNormalizedData(futuresSymbol, futuresPrices[futuresSymbol].bestBid);
                    const { normalizedPrice: normalizedFuturesAsk } = getNormalizedData(futuresSymbol, futuresPrices[futuresSymbol].bestAsk);
                    const { normalizedPrice: normalizedSpotBid } = getNormalizedData(spotSymbol, spotPrices[spotSymbol].bestBid);

                    // Validação de Preços: Ignorar cálculo se algum preço for zero ou negativo.
                    if (normalizedSpotAsk <= 0 || normalizedFuturesBid <= 0 || normalizedSpotBid <= 0 || normalizedFuturesAsk <= 0) {
                        continue;
                    }

                    const profitSpotToFutures = ((normalizedFuturesBid - normalizedSpotAsk) / normalizedSpotAsk) * 100;

                    if (profitSpotToFutures >= MIN_PROFIT_PERCENTAGE) {
                        opportunities.push({
                            type: 'arbitrage',
                            baseSymbol: normalizedSpotSymbol,
                            profitPercentage: profitSpotToFutures,
                            buyAt: { exchange: spotId, price: spotPrices[spotSymbol].bestAsk, marketType: 'spot', originalSymbol: spotSymbol },
                            sellAt: { exchange: futuresId, price: futuresPrices[futuresSymbol].bestBid, marketType: 'futures', originalSymbol: futuresSymbol },
                            arbitrageType: 'spot_to_futures_inter',
                            timestamp: Date.now()
                        });
                    }

                    const profitFuturesToSpot = ((normalizedSpotBid - normalizedFuturesAsk) / normalizedFuturesAsk) * 100;
                    if (profitFuturesToSpot >= MIN_PROFIT_PERCENTAGE) {
                         opportunities.push({
                            type: 'arbitrage',
                            baseSymbol: normalizedSpotSymbol,
                            profitPercentage: profitFuturesToSpot,
                            buyAt: { exchange: futuresId, price: futuresPrices[futuresSymbol].bestAsk, marketType: 'futures', originalSymbol: futuresSymbol },
                            sellAt: { exchange: spotId, price: spotPrices[spotSymbol].bestBid, marketType: 'spot', originalSymbol: spotSymbol },
                            arbitrageType: 'futures_to_spot_inter',
                            timestamp: Date.now()
                        });
                    }
                }
            }
        }
    }

    if (opportunities.length > 0) {
        opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
        
        for (const op of opportunities) {
            await recordSpread(op as ArbitrageOpportunity);
            const stats = await getSpreadStats(op as ArbitrageOpportunity);
            const opportunityWithStats: ArbitrageOpportunity = {
                ...op,
                spMax: stats.spMax ?? undefined,
                spMin: stats.spMin ?? undefined,
                crosses: stats.crosses,
            };
            broadcastOpportunity(opportunityWithStats);
        }
    }
}

async function startFeeds() {
    console.log("Iniciando feeds de dados...");
    const gateIoSpotConnector = new GateIoConnector('GATEIO_SPOT', marketPrices);
    const mexcConnector = new MexcConnector('MEXC_FUTURES', marketPrices, () => {
        mexcConnector.subscribe(targetPairs);
    });

    try {
        targetPairs = await gateIoSpotConnector.getTradablePairs();
        console.log(`Gate.io: Encontrados ${targetPairs.length} pares SPOT negociáveis.`);
        
        gateIoSpotConnector.connect(targetPairs);
        mexcConnector.connect();

        console.log(`Monitorando ${targetPairs.length} pares em Gate.io (Spot) e MEXC (Futures).`);
        setInterval(findAndBroadcastArbitrage, 5000);
    } catch (error) {
        console.error("Erro fatal ao iniciar os feeds:", error);
    }
}
