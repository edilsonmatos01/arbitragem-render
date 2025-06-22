"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWebSocketServer = startWebSocketServer;
require('dotenv').config();
const ws_1 = __importDefault(require("ws"));
const http_1 = require("http");
const gateio_connector_1 = require("./gateio-connector");
const mexc_connector_1 = require("./mexc-connector");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const PORT = process.env.PORT || 10000;
const MIN_PROFIT_PERCENTAGE = 0.1;
let marketPrices = {};
let targetPairs = [];
let clients = [];
function handlePriceUpdate(update) {
    const { identifier, symbol, priceData, marketType, bestAsk, bestBid } = update;
    if (!marketPrices[identifier]) {
        marketPrices[identifier] = {};
    }
    marketPrices[identifier][symbol] = { bestAsk, bestBid, timestamp: Date.now() };
    broadcast({
        type: 'price-update',
        symbol,
        marketType,
        bestAsk,
        bestBid
    });
}
function startWebSocketServer(httpServer) {
    const wss = new ws_1.default.Server({ server: httpServer });
    wss.on('connection', (ws, req) => {
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
            const ws = client;
            if (ws.isAlive === false) {
                console.log('[WS Server] Conexão inativa terminada.');
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping(() => { });
        });
    }, 30000);
    wss.on('close', () => {
        clearInterval(interval);
    });
    console.log(`Servidor WebSocket iniciado e anexado ao servidor HTTP.`);
    startFeeds();
}
function initializeStandaloneServer() {
    const httpServer = (0, http_1.createServer)((req, res) => {
        if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', message: 'WebSocket server is running' }));
        }
        else {
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
function broadcast(data) {
    const serializedData = JSON.stringify(data);
    clients.forEach(client => {
        if (client.readyState === ws_1.default.OPEN) {
            client.send(serializedData);
        }
    });
}
function broadcastOpportunity(opportunity) {
    console.log(`[DEBUG] Verificando ${opportunity.baseSymbol} | Spread: ${opportunity.profitPercentage.toFixed(2)}%`);
    if (!isFinite(opportunity.profitPercentage) || opportunity.profitPercentage > 100) {
        console.warn(`[FILTRO] Spread >100% IGNORADO para ${opportunity.baseSymbol}: ${opportunity.profitPercentage.toFixed(2)}%`);
        return;
    }
    broadcast(Object.assign(Object.assign({}, opportunity), { type: 'arbitrage' }));
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
function getNormalizedData(symbol) {
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
    if (exchangeIdentifiers.length < 2)
        return;
    for (const spotId of exchangeIdentifiers.filter(id => !id.toUpperCase().includes('FUTURES'))) {
        const futuresId = exchangeIdentifiers.find(id => id.toUpperCase().includes('FUTURES'));
        if (!futuresId)
            continue;
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
                    continue;
                }
                const normalizedSpotAsk = spotPrices[spotSymbol].bestAsk * (futuresData.factor / spotData.factor);
                const normalizedSpotBid = spotPrices[spotSymbol].bestBid * (futuresData.factor / spotData.factor);
                const normalizedFuturesAsk = futuresPrices[futuresSymbol].bestAsk * (futuresData.factor / spotData.factor);
                const normalizedFuturesBid = futuresPrices[futuresSymbol].bestBid * (futuresData.factor / spotData.factor);
                const profitSpotToFutures = ((normalizedFuturesBid - normalizedSpotAsk) / normalizedSpotAsk) * 100;
                if (profitSpotToFutures >= MIN_PROFIT_PERCENTAGE) {
                    const opportunity = {
                        type: 'arbitrage',
                        baseSymbol: spotData.baseSymbol,
                        profitPercentage: profitSpotToFutures,
                        buyAt: { exchange: spotId, price: spotPrices[spotSymbol].bestAsk, marketType: 'spot' },
                        sellAt: { exchange: futuresId, price: futuresPrices[futuresSymbol].bestBid, marketType: 'futures' },
                        arbitrageType: 'spot_to_futures_inter',
                        timestamp: Date.now()
                    };
                    await recordSpread(opportunity);
                    broadcastOpportunity(opportunity);
                }
                const profitFuturesToSpot = ((normalizedSpotBid - normalizedFuturesAsk) / normalizedSpotAsk) * 100;
                if (profitFuturesToSpot >= MIN_PROFIT_PERCENTAGE) {
                    const opportunity = {
                        type: 'arbitrage',
                        baseSymbol: spotData.baseSymbol,
                        profitPercentage: profitFuturesToSpot,
                        buyAt: { exchange: futuresId, price: futuresPrices[futuresSymbol].bestAsk, marketType: 'futures' },
                        sellAt: { exchange: spotId, price: spotPrices[spotSymbol].bestBid, marketType: 'spot' },
                        arbitrageType: 'futures_to_spot_inter',
                        timestamp: Date.now()
                    };
                    await recordSpread(opportunity);
                    broadcastOpportunity(opportunity);
                }
            }
        }
    }
}
async function startFeeds() {
    console.log("🚀 Iniciando feeds de dados com BUSCA DINÂMICA...");
    const gateIoSpotConnector = new gateio_connector_1.GateIoConnector('GATEIO_SPOT', handlePriceUpdate);
    const gateIoFuturesConnector = new gateio_connector_1.GateIoConnector('GATEIO_FUTURES', handlePriceUpdate);
    let mexcConnector;
    let dynamicPairs = [];
    try {
        console.log("📡 Buscando pares negociáveis das exchanges...");
        const [spotPairs, futuresPairs] = await Promise.all([
            gateIoSpotConnector.getTradablePairs(),
            gateIoFuturesConnector.getTradablePairs()
        ]);
        console.log(`✅ Gate.io Spot: ${spotPairs.length} pares encontrados`);
        console.log(`✅ Gate.io Futures: ${futuresPairs.length} pares encontrados`);
        dynamicPairs = spotPairs.filter((pair) => futuresPairs.includes(pair));
        console.log(`🎯 PARES EM COMUM: ${dynamicPairs.length} pares para arbitragem`);
        console.log(`📋 Primeiros 10 pares: ${dynamicPairs.slice(0, 10).join(', ')}`);
        mexcConnector = new mexc_connector_1.MexcConnector('MEXC_FUTURES', handlePriceUpdate, () => {
            console.log('✅ MEXC conectado! Inscrevendo em pares dinâmicos...');
            mexcConnector.subscribe(dynamicPairs);
        });
        console.log(`🔄 Conectando exchanges com ${dynamicPairs.length} pares dinâmicos...`);
        gateIoSpotConnector.connect(dynamicPairs);
        gateIoFuturesConnector.connect(dynamicPairs);
        mexcConnector.connect();
        console.log(`💰 Monitorando ${dynamicPairs.length} pares para arbitragem!`);
        setInterval(findAndBroadcastArbitrage, 5000);
        setInterval(async () => {
            console.log("🔄 Atualizando lista de pares dinâmicos...");
            try {
                const [newSpotPairs, newFuturesPairs] = await Promise.all([
                    gateIoSpotConnector.getTradablePairs(),
                    gateIoFuturesConnector.getTradablePairs()
                ]);
                const newDynamicPairs = newSpotPairs.filter((pair) => newFuturesPairs.includes(pair));
                if (newDynamicPairs.length !== dynamicPairs.length) {
                    console.log(`📈 Pares atualizados: ${dynamicPairs.length} → ${newDynamicPairs.length}`);
                    dynamicPairs = newDynamicPairs;
                    mexcConnector.subscribe(dynamicPairs);
                }
                else {
                    console.log("✅ Lista de pares permanece igual");
                }
            }
            catch (error) {
                console.error("❌ Erro ao atualizar pares:", error);
            }
        }, 3600000);
    }
    catch (error) {
        console.error("❌ Erro fatal ao iniciar os feeds:", error);
        console.log("🔄 Usando pares prioritários como fallback...");
        const fallbackPairs = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT'];
        mexcConnector = new mexc_connector_1.MexcConnector('MEXC_FUTURES', handlePriceUpdate, () => {
            mexcConnector.subscribe(fallbackPairs);
        });
        gateIoSpotConnector.connect(fallbackPairs);
        gateIoFuturesConnector.connect(fallbackPairs);
        mexcConnector.connect();
        setInterval(findAndBroadcastArbitrage, 5000);
    }
}
//# sourceMappingURL=websocket-server.js.map