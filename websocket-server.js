"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
require('dotenv').config();
var http = require("http");
var WebSocket = require('ws');
var client_1 = require("@prisma/client");
var gateio_connector_1 = require("./src/gateio-connector");
var mexc_futures_connector_1 = require("./src/mexc-futures-connector");
var prisma = new client_1.PrismaClient();
var PORT = process.env.PORT || 10000;
var MIN_PROFIT_PERCENTAGE = 0.1; // 0.1%
var marketPrices = {};
var clients = [];
// Criar servidor HTTP
var server = http.createServer(function (req, res) {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
    }
    res.writeHead(404);
    res.end();
});
// Criar servidor WebSocket
var wss = new WebSocket.Server({ server: server });
// Configurar heartbeat para os clientes
function heartbeat() {
    this.isAlive = true;
    this.lastPing = Date.now();
}
wss.on('connection', function (ws, req) {
    var customWs = ws;
    customWs.isAlive = true;
    customWs.lastPing = Date.now();
    ws.on('pong', heartbeat.bind(customWs));
    clients.push(ws);
    console.log("[WebSocket] Nova conexão estabelecida. Total de clientes: ".concat(clients.length));
    ws.on('message', function (message) {
        try {
            var data = JSON.parse(message.toString());
            console.log('[WebSocket] Mensagem recebida:', data);
            if (data.type === 'config-update') {
                // Processar atualização de configuração
                console.log('[WebSocket] Configuração atualizada:', data.exchangeConfig);
            }
        }
        catch (error) {
            console.error('[WebSocket] Erro ao processar mensagem:', error);
        }
    });
    ws.on('close', function () {
        clients = clients.filter(function (c) { return c !== ws; });
        console.log("[WebSocket] Cliente desconectado. Total de clientes: ".concat(clients.length));
    });
    ws.on('error', function (error) {
        console.error('[WebSocket] Erro na conexão:', error);
        clients = clients.filter(function (c) { return c !== ws; });
    });
    if (Object.keys(marketPrices).length > 0) {
        ws.send(JSON.stringify({ type: 'full_book', data: marketPrices }));
    }
});
// Verificar conexões inativas
var interval = setInterval(function () {
    wss.clients.forEach(function (ws) {
        var customWs = ws;
        if (customWs.isAlive === false) {
            console.log('[WebSocket] Cliente inativo removido');
            clients = clients.filter(function (c) { return c !== ws; });
            return ws.terminate();
        }
        customWs.isAlive = false;
        ws.ping();
    });
}, 30000);
wss.on('close', function () {
    clearInterval(interval);
});
// Função para broadcast
function broadcast(data) {
    try {
        var message = JSON.stringify(data);
        clients.forEach(function (client) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
    catch (error) {
        console.error('[Broadcast] Erro ao enviar mensagem:', error);
    }
}
// Função para broadcast de oportunidades
function broadcastOpportunity(opportunity) {
    console.log('[DEBUG] Verificando '.concat(opportunity.baseSymbol, ' | Spread: ').concat(opportunity.profitPercentage.toFixed(2), '%'));
    if (!isFinite(opportunity.profitPercentage) || opportunity.profitPercentage > 100) {
        console.warn('[FILTRO] Spread >100% IGNORADO para '.concat(opportunity.baseSymbol, ': ').concat(opportunity.profitPercentage.toFixed(2), '%'));
        return;
    }
    broadcast({ ...opportunity, type: 'arbitrage' });
    console.log('[Broadcast] Oportunidade VÁLIDA enviada: '.concat(opportunity.baseSymbol, ' ').concat(opportunity.profitPercentage.toFixed(2), '%'));
}
// Iniciar servidor na porta configurada
server.listen(PORT, function () {
    console.log("\n[Servidor] WebSocket iniciado na porta ".concat(PORT));
    startFeeds();
});
// Função para atualizar preços
function updateMarketPrices(exchange, data) {
    if (!marketPrices[exchange]) {
        marketPrices[exchange] = {};
    }
    marketPrices[exchange][data.symbol] = {
        symbol: data.symbol,
        bestAsk: data.bestAsk,
        bestBid: data.bestBid,
        timestamp: Date.now()
    };
}
// Função para iniciar os feeds
function startFeeds() {
    return __awaiter(this, void 0, void 0, function () {
        var gateioSpot, mexcFutures, gateioSymbols, mexcSymbols, commonSymbols;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    gateioSpot = new gateio_connector_1.GateIoConnector('GATEIO_SPOT', function (data) {
                        updateMarketPrices('GATEIO_SPOT', data);
                    }, function () {
                        console.log('[Gate.io Spot] Conectado');
                    });
                    mexcFutures = new mexc_futures_connector_1.MexcFuturesConnector('MEXC_FUTURES', function (data) {
                        updateMarketPrices('MEXC_FUTURES', data);
                    }, function () {
                        console.log('[MEXC Futures] Conectado');
                    });
                    // Inicia as conexões
                    return [4 /*yield*/, Promise.all([
                            gateioSpot.connect(),
                            mexcFutures.connect()
                        ])];
                case 1:
                    // Inicia as conexões
                    _a.sent();
                    return [4 /*yield*/, gateioSpot.getTradablePairs()];
                case 2:
                    gateioSymbols = _a.sent();
                    return [4 /*yield*/, mexcFutures.getTradablePairs()];
                case 3:
                    mexcSymbols = _a.sent();
                    commonSymbols = gateioSymbols.filter(function (symbol) { return mexcSymbols.includes(symbol); });
                    console.log('\n[Arbitragem] Pares em comum:', commonSymbols);
                    // Inscreve-se nos pares em comum
                    return [4 /*yield*/, Promise.all([
                            gateioSpot.subscribe(commonSymbols),
                            mexcFutures.subscribe(commonSymbols)
                        ])];
                case 4:
                    // Inscreve-se nos pares em comum
                    _a.sent();
                    // Inicia o monitoramento de oportunidades
                    setInterval(function () {
                        findAndBroadcastArbitrage();
                    }, 1000);
                    return [2 /*return*/];
            }
        });
    });
}
// Função para encontrar e transmitir oportunidades de arbitragem
function findAndBroadcastArbitrage() {
    return __awaiter(this, void 0, void 0, function () {
        var now, opportunities, _i, _a, symbol, gateioSpotData, mexcFuturesData, spotAsk, spotBid, futuresAsk, futuresBid, spotToFuturesSpread, futuresToSpotSpread, spotToFuturesOpportunity, futuresToSpotOpportunity, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    now = Date.now();
                    opportunities = [];
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    // Verifica os preços para cada par de moedas
                    for (_i = 0, _a = Object.keys(marketPrices['GATEIO_SPOT'] || {}); _i < _a.length; _i++) {
                        symbol = _a[_i];
                        gateioSpotData = marketPrices['GATEIO_SPOT'][symbol];
                        mexcFuturesData = marketPrices['MEXC_FUTURES'][symbol];
                        // Verifica se temos dados válidos e recentes (últimos 10 segundos)
                        if (!gateioSpotData || !mexcFuturesData ||
                            now - gateioSpotData.timestamp > 10000 ||
                            now - mexcFuturesData.timestamp > 10000) {
                            continue;
                        }
                        spotAsk = gateioSpotData.bestAsk;
                        spotBid = gateioSpotData.bestBid;
                        futuresAsk = mexcFuturesData.bestAsk;
                        futuresBid = mexcFuturesData.bestBid;
                        // Calcula spreads
                        spotToFuturesSpread = ((futuresBid - spotAsk) / spotAsk) * 100;
                        futuresToSpotSpread = ((spotBid - futuresAsk) / futuresAsk) * 100;
                        // Verifica oportunidades de arbitragem
                        if (spotToFuturesSpread > MIN_PROFIT_PERCENTAGE) {
                            spotToFuturesOpportunity = {
                                type: 'arbitrage',
                                baseSymbol: symbol,
                                profitPercentage: spotToFuturesSpread,
                                buyAt: {
                                    exchange: 'GATEIO',
                                    price: spotAsk,
                                    marketType: 'spot'
                                },
                                sellAt: {
                                    exchange: 'MEXC',
                                    price: futuresBid,
                                    marketType: 'futures'
                                },
                                arbitrageType: 'spot_futures_inter_exchange',
                                timestamp: now
                            };
                            opportunities.push(spotToFuturesOpportunity);
                            broadcastOpportunity(spotToFuturesOpportunity);
                        }
                        if (futuresToSpotSpread > MIN_PROFIT_PERCENTAGE) {
                            futuresToSpotOpportunity = {
                                type: 'arbitrage',
                                baseSymbol: symbol,
                                profitPercentage: futuresToSpotSpread,
                                buyAt: {
                                    exchange: 'MEXC',
                                    price: futuresAsk,
                                    marketType: 'futures'
                                },
                                sellAt: {
                                    exchange: 'GATEIO',
                                    price: spotBid,
                                    marketType: 'spot'
                                },
                                arbitrageType: 'futures_spot_inter_exchange',
                                timestamp: now
                            };
                            opportunities.push(futuresToSpotOpportunity);
                            broadcastOpportunity(futuresToSpotOpportunity);
                        }
                    }
                    if (!(opportunities.length > 0)) return [3 /*break*/, 3];
                    return [4 /*yield*/, prisma.arbitrageOpportunity.createMany({
                            data: opportunities.map(function (opp) { return ({
                                symbol: opp.baseSymbol,
                                profitPercentage: opp.profitPercentage,
                                buyExchange: opp.buyAt.exchange,
                                buyPrice: opp.buyAt.price,
                                buyMarketType: opp.buyAt.marketType,
                                sellExchange: opp.sellAt.exchange,
                                sellPrice: opp.sellAt.price,
                                sellMarketType: opp.sellAt.marketType,
                                arbitrageType: opp.arbitrageType,
                                timestamp: new Date(opp.timestamp)
                            }); })
                        })];
                case 2:
                    _b.sent();
                    _b.label = 3;
                case 3: return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
