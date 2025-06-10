"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require('dotenv').config();
const ws_1 = require("ws");
const http_1 = require("http");
const gateio_connector_1 = require("./src/gateio-connector");
const mexc_connector_1 = require("./src/mexc-connector");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const PORT = process.env.PORT || 8888;
const MIN_PROFIT_PERCENTAGE = 0.1;
let marketPrices = {};
let targetPairs = [];
const server = (0, http_1.createServer)();
const wss = new ws_1.WebSocketServer({ server });
let clients = [];
wss.on('connection', (ws, req) => {
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
function broadcast(data) {
    const serializedData = JSON.stringify(data);
    clients.forEach(client => {
        if (client.readyState === ws_1.WebSocket.OPEN) {
            client.send(serializedData);
        }
    });
}
// Versão corrigida da função com logs de depuração
function broadcastOpportunity(opportunity) {
    console.log(`[DEBUG] Verificando ${opportunity.baseSymbol} | Spread: ${opportunity.profitPercentage.toFixed(2)}%`);
    if (!isFinite(opportunity.profitPercentage) || opportunity.profitPercentage > 100) {
        console.warn(`[FILTRO] Spread >100% IGNORADO para ${opportunity.baseSymbol}: ${opportunity.profitPercentage.toFixed(2)}%`);
        return;
    }
    broadcast({ ...opportunity, type: 'arbitrage' });
    console.log(`[Broadcast] Oportunidade VÁLIDA enviada: ${opportunity.baseSymbol} ${opportunity.profitPercentage.toFixed(2)}%`);
}
async function recordSpread(opportunity) {
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
    }
    catch (error) {
        console.error(`[Prisma] Erro ao gravar spread para ${opportunity.baseSymbol}:`, error);
    }
}
async function getSpreadStats(opportunity) {
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
    }
    catch (error) {
        console.error(`[Prisma] Erro ao buscar estatísticas de spread para ${opportunity.baseSymbol}:`, error);
        return { spMax: null, spMin: null, crosses: 0 };
    }
}
function getNormalizedData(symbol, price) {
    const match = symbol.match(/^(\d+)(.+)$/);
    if (match) {
        const factor = parseInt(match[1], 10);
        const baseSymbol = match[2];
        return { baseSymbol, normalizedPrice: price / factor };
    }
    return { baseSymbol: symbol, normalizedPrice: price };
}
async function findAndBroadcastArbitrage() {
    const opportunities = [];
    const exchangeIdentifiers = Object.keys(marketPrices);
    if (exchangeIdentifiers.length < 2)
        return;
    for (let i = 0; i < exchangeIdentifiers.length; i++) {
        for (let j = i + 1; j < exchangeIdentifiers.length; j++) {
            const idA = exchangeIdentifiers[i];
            const idB = exchangeIdentifiers[j];
            const pricesA = marketPrices[idA];
            const pricesB = marketPrices[idB];
            const marketTypeA = idA.toUpperCase().includes('FUTURES') ? 'futures' : 'spot';
            const marketTypeB = idB.toUpperCase().includes('FUTURES') ? 'futures' : 'spot';
            if (marketTypeA === marketTypeB)
                continue;
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
            await recordSpread(op);
            const stats = await getSpreadStats(op);
            const opportunityWithStats = {
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
    const gateIoSpotConnector = new gateio_connector_1.GateIoConnector('GATEIO_SPOT', marketPrices);
    const mexcConnector = new mexc_connector_1.MexcConnector('MEXC_FUTURES', marketPrices, () => {
        mexcConnector.subscribe(targetPairs);
    });
    try {
        targetPairs = await gateIoSpotConnector.getTradablePairs();
        console.log(`Gate.io: Encontrados ${targetPairs.length} pares SPOT negociáveis.`);
        gateIoSpotConnector.connect(targetPairs);
        mexcConnector.connect();
        console.log(`Monitorando ${targetPairs.length} pares em Gate.io (Spot) e MEXC (Futures).`);
        setInterval(findAndBroadcastArbitrage, 5000);
    }
    catch (error) {
        console.error("Erro fatal ao iniciar os feeds:", error);
    }
}
server.listen(PORT, () => {
    console.log(`Servidor WebSocket rodando na porta ${PORT}`);
    startFeeds();
});
