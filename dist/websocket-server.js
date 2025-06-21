"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWebSocketServer = startWebSocketServer;
require('dotenv').config();
const WebSocket = __importStar(require("ws"));
const http_1 = require("http");
const gateio_connector_1 = require("./src/gateio-connector");
const mexc_futures_connector_1 = require("./src/mexc-futures-connector");
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
    console.log(`[${identifier}] Atualização de preço para ${symbol}:`);
    console.log(`Ask: ${bestAsk}, Bid: ${bestBid}`);
}
function startWebSocketServer(httpServer) {
    const wss = new WebSocket.Server({ server: httpServer });
    wss.on('connection', (ws, req) => {
        const customWs = ws;
        customWs.isAlive = true;
        customWs.on('pong', () => {
            customWs.isAlive = true;
        });
        const clientIp = req.socket.remoteAddress || req.headers['x-forwarded-for'];
        clients.push(customWs);
        console.log(`[WS Server] Cliente conectado: ${clientIp}. Total: ${clients.length}`);
        if (Object.keys(marketPrices).length > 0) {
            customWs.send(JSON.stringify({ type: 'full_book', data: marketPrices }));
        }
        customWs.on('close', () => {
            clients = clients.filter(c => c !== customWs);
            console.log(`[WS Server] Cliente desconectado: ${clientIp}. Total: ${clients.length}`);
        });
    });
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            const customWs = ws;
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
        console.log(`[Servidor] WebSocket iniciado na porta ${PORT}`);
    });
}
if (require.main === module) {
    initializeStandaloneServer();
}
function broadcast(data) {
    const serializedData = JSON.stringify(data);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
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
        if (!spotData || !futuresData)
            continue;
        if (spotData.bestAsk <= 0 || spotData.bestBid <= 0 || futuresData.bestAsk <= 0 || futuresData.bestBid <= 0)
            continue;
        const spotMidPrice = (spotData.bestAsk + spotData.bestBid) / 2;
        const futuresMidPrice = (futuresData.bestAsk + futuresData.bestBid) / 2;
        const spread = ((futuresMidPrice - spotMidPrice) / spotMidPrice) * 100;
        if (Math.abs(spread) >= MIN_PROFIT_PERCENTAGE && Math.abs(spread) <= 10) {
            opportunitiesFound++;
            if (spread > 0) {
                const opportunity = {
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
            }
            else {
                const opportunity = {
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
    }
    else {
        console.log(`[Arbitragem] Total de ${opportunitiesFound} oportunidades encontradas.`);
    }
}
async function startFeeds() {
    console.log("Iniciando feeds de dados...");
    const gateIoSpot = new gateio_connector_1.GateIoConnector('GATEIO_SPOT', handlePriceUpdate, () => {
        console.log('[Gate.io Spot] Conectado');
    });
    const mexcFutures = new mexc_futures_connector_1.MexcFuturesConnector('MEXC_FUTURES', handlePriceUpdate, () => {
        console.log('[MEXC Futures] Conectado');
    });
    try {
        await Promise.all([
            gateIoSpot.connect(),
            mexcFutures.connect()
        ]);
        console.log('[Feeds] WebSockets conectados, buscando pares...');
        const [spotPairs, futuresPairs] = await Promise.all([
            gateIoSpot.getTradablePairs(),
            mexcFutures.getTradablePairs()
        ]);
        console.log('[Gate.io] Pares spot:', spotPairs.length);
        console.log('[MEXC] Pares futures:', futuresPairs.length);
        targetPairs = spotPairs.filter(p => {
            const mexcFormat = p.replace('/', '_');
            return futuresPairs.includes(mexcFormat);
        });
        console.log(`[Arbitragem] Pares em comum: ${targetPairs.length}`);
        console.log('Primeiros 5 pares:', targetPairs.slice(0, 5));
        gateIoSpot.subscribe(targetPairs);
        const mexcPairs = targetPairs.map(p => p.replace('/', '_'));
        mexcFutures.subscribe(mexcPairs);
        setInterval(findAndBroadcastArbitrage, 1000);
    }
    catch (error) {
        console.error("Erro fatal ao iniciar os feeds:", error);
    }
}
//# sourceMappingURL=websocket-server.js.map