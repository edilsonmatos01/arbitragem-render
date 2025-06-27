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
    const { identifier, symbol, marketType, bestAsk, bestBid } = update;
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
    var _a, _b;
    for (const symbol of targetPairs) {
        const gateioData = (_a = marketPrices['gateio']) === null || _a === void 0 ? void 0 : _a[symbol];
        const mexcData = (_b = marketPrices['mexc']) === null || _b === void 0 ? void 0 : _b[symbol];
        if (!gateioData || !mexcData)
            continue;
        if (!isFinite(gateioData.bestAsk) || !isFinite(gateioData.bestBid) ||
            !isFinite(mexcData.bestAsk) || !isFinite(mexcData.bestBid)) {
            continue;
        }
        const gateioToMexc = ((mexcData.bestBid - gateioData.bestAsk) / gateioData.bestAsk) * 100;
        const mexcToGateio = ((gateioData.bestBid - mexcData.bestAsk) / mexcData.bestAsk) * 100;
        if (gateioToMexc > MIN_PROFIT_PERCENTAGE) {
            const opportunity = {
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
            const opportunity = {
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
    const gateio = new gateio_connector_1.GateioConnector();
    const mexc = new mexc_connector_1.MexcConnector();
    gateio.onPriceUpdate(handlePriceUpdate);
    mexc.onPriceUpdate(handlePriceUpdate);
    try {
        await gateio.connect();
        await mexc.connect();
        setInterval(findAndBroadcastArbitrage, 1000);
    }
    catch (error) {
        console.error('Erro ao iniciar os feeds:', error);
        process.exit(1);
    }
}
//# sourceMappingURL=websocket-server.js.map