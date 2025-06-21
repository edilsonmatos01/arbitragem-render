"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.startWebSocketServer = startWebSocketServer;
require('dotenv').config();
var http = require("http");
var ws_1 = require("ws");
var ws_2 = require("ws");
var client_1 = require("@prisma/client");
var gateio_connector_1 = require("./src/gateio-connector");
var mexc_connector_1 = require("./src/mexc-connector");
var prisma = new client_1.PrismaClient();
var PORT = process.env.PORT || 10000;
var MIN_PROFIT_PERCENTAGE = 0.1;
var clients = [];
var marketPrices = {};
var targetPairs = [];
// ✅ Nova função centralizadora para lidar com todas as atualizações de preço
function handlePriceUpdate(update) {
    var identifier = update.identifier, symbol = update.symbol, marketType = update.marketType, bestAsk = update.bestAsk, bestBid = update.bestBid;
    // Log da atualização de preço
    console.log("\n[Pre\u00E7o Atualizado] ".concat(identifier, " - ").concat(symbol));
    console.log("Ask: ".concat(bestAsk, ", Bid: ").concat(bestBid));
    console.log("Spread interno: ".concat(((bestAsk - bestBid) / bestBid * 100).toFixed(4), "%"));
    // 1. Atualiza o estado central de preços
    if (!marketPrices[identifier]) {
        console.log("[Novo Market] Criando entrada para ".concat(identifier));
        marketPrices[identifier] = {};
    }
    var oldPrice = marketPrices[identifier][symbol];
    marketPrices[identifier][symbol] = { bestAsk: bestAsk, bestBid: bestBid, timestamp: Date.now() };
    if (oldPrice) {
        var askChange = ((bestAsk - oldPrice.bestAsk) / oldPrice.bestAsk * 100).toFixed(4);
        var bidChange = ((bestBid - oldPrice.bestBid) / oldPrice.bestBid * 100).toFixed(4);
        console.log("Varia\u00E7\u00E3o: Ask ".concat(askChange, "%, Bid ").concat(bidChange, "%"));
    }
    // 2. Transmite a atualização para todos os clientes
    try {
        broadcast({
            type: 'price-update',
            symbol: symbol,
            marketType: marketType,
            bestAsk: bestAsk,
            bestBid: bestBid
        });
        console.log("[Broadcast] Pre\u00E7o enviado para ".concat(clients.length, " clientes"));
    }
    catch (error) {
        console.error('[Erro Broadcast]', error);
    }
}
function startWebSocketServer(httpServer) {
    var wss = new ws_2.Server({
        server: httpServer,
        perMessageDeflate: false,
        clientTracking: true,
        maxPayload: 1024 * 1024, // 1MB
        verifyClient: function (info, cb) {
            // Aceita todas as conexões por enquanto
            cb(true);
        }
    });
    wss.on('connection', function (ws, req) {
        ws.isAlive = true;
        ws.lastPing = Date.now();
        // Configura o ping-pong para manter a conexão ativa
        var pingInterval = setInterval(function () {
            if (ws.isAlive === false) {
                clearInterval(pingInterval);
                return ws.terminate();
            }
            ws.isAlive = false;
            try {
                ws.ping();
            }
            catch (error) {
                console.error('Erro ao enviar ping:', error);
                clearInterval(pingInterval);
                ws.terminate();
            }
        }, 30000);
        ws.on('pong', function () {
            heartbeat(ws);
        });
        ws.on('error', function (error) {
            console.error('[WebSocket] Erro na conexão:', error);
            ws.close();
        });
        var clientIp = req.socket.remoteAddress || req.headers['x-forwarded-for'];
        clients.push(ws);
        console.log("[WS Server] Cliente conectado: ".concat(clientIp, ". Total: ").concat(clients.length));
        // Envia o estado inicial
        if (Object.keys(marketPrices).length > 0) {
            try {
                ws.send(JSON.stringify({
                    type: 'full_book',
                    data: marketPrices,
                    timestamp: Date.now()
                }));
            }
            catch (error) {
                console.error('Erro ao enviar estado inicial:', error);
            }
        }
        ws.on('close', function (code, reason) {
            clients = clients.filter(function (c) { return c !== ws; });
            clearInterval(pingInterval);
            console.log("[WS Server] Cliente desconectado: ".concat(clientIp, ". C\u00F3digo: ").concat(code, ", Raz\u00E3o: ").concat(reason, ". Total: ").concat(clients.length));
        });
    });
    wss.on('close', function () {
        console.log('Servidor WebSocket fechado');
    });
    console.log("Servidor WebSocket iniciado e anexado ao servidor HTTP.");
    startFeeds();
}
// --- Início: Adição para Servidor Standalone ---
// Esta função cria e inicia um servidor HTTP que usa a nossa lógica WebSocket.
function initializeStandaloneServer() {
    var httpServer = http.createServer(function (req, res) {
        // Adiciona headers CORS para todas as respostas HTTP
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        // Responde imediatamente a requisições OPTIONS
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        // Health check endpoint
        if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'healthy', clients: clients.length }));
            return;
        }
        // Rota de status do WebSocket
        if (req.url === '/status') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                connectedClients: clients.length,
                exchanges: Object.keys(marketPrices),
                timestamp: new Date().toISOString()
            }));
            return;
        }
        res.writeHead(404);
        res.end();
    });
    // Anexa a lógica do WebSocket ao nosso servidor HTTP.
    startWebSocketServer(httpServer);
    httpServer.listen(PORT, function () {
        console.log("\n[Servidor] WebSocket iniciado na porta ".concat(PORT));
        console.log("Health check dispon\u00EDvel em: http://localhost:".concat(PORT, "/health"));
        console.log("Status dispon\u00EDvel em: http://localhost:".concat(PORT, "/status"));
    });
    // Tratamento de erros do servidor
    httpServer.on('error', function (error) {
        console.error('Erro no servidor HTTP:', error);
    });
    // Graceful shutdown
    process.on('SIGTERM', function () {
        console.log('Recebido sinal SIGTERM, iniciando shutdown...');
        httpServer.close(function () {
            console.log('Servidor HTTP fechado.');
            process.exit(0);
        });
    });
}
// Inicia o servidor standalone.
if (require.main === module) {
    initializeStandaloneServer();
}
// --- Fim: Adição para Servidor Standalone ---
function heartbeat(ws) {
    ws.isAlive = true;
    ws.lastPing = Date.now();
}
function checkConnections() {
    var now = Date.now();
    clients.forEach(function (ws) {
        var customWs = ws;
        if (!customWs.isAlive && (now - customWs.lastPing) > 30000) {
            console.log('[Conexão] Cliente inativo removido');
            ws.terminate();
            return;
        }
        customWs.isAlive = false;
        try {
            ws.ping();
        }
        catch (error) {
            console.error('[Ping] Erro ao enviar ping:', error);
            ws.terminate();
        }
    });
}
function broadcast(data) {
    var serializedData = JSON.stringify(data);
    clients.forEach(function (client) {
        if (client.readyState === ws_1.default.OPEN) {
            try {
                client.send(serializedData);
            }
            catch (error) {
                console.error('[Broadcast] Erro ao enviar mensagem:', error);
                client.terminate();
            }
        }
    });
}
// Versão corrigida da função com logs de depuração
function broadcastOpportunity(opportunity) {
    console.log("[DEBUG] Verificando ".concat(opportunity.baseSymbol, " | Spread: ").concat(opportunity.profitPercentage.toFixed(2), "%"));
    if (!isFinite(opportunity.profitPercentage) || opportunity.profitPercentage > 100) {
        console.warn("[FILTRO] Spread >100% IGNORADO para ".concat(opportunity.baseSymbol, ": ").concat(opportunity.profitPercentage.toFixed(2), "%"));
        return;
    }
    broadcast(__assign(__assign({}, opportunity), { type: 'arbitrage' }));
    console.log("[Broadcast] Oportunidade V\u00C1LIDA enviada: ".concat(opportunity.baseSymbol, " ").concat(opportunity.profitPercentage.toFixed(2), "%"));
}
function recordSpread(opportunity) {
    return __awaiter(this, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (typeof opportunity.profitPercentage !== 'number' || !isFinite(opportunity.profitPercentage)) {
                        console.warn("[Prisma] Spread inv\u00E1lido para ".concat(opportunity.baseSymbol, ", grava\u00E7\u00E3o ignorada."));
                        return [2 /*return*/];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, prisma.spreadHistory.create({
                            data: {
                                symbol: opportunity.baseSymbol,
                                exchangeBuy: opportunity.buyAt.exchange,
                                exchangeSell: opportunity.sellAt.exchange,
                                direction: opportunity.arbitrageType,
                                spread: opportunity.profitPercentage,
                                timestamp: new Date()
                            },
                        })];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    console.error("[Prisma] Erro ao gravar spread para ".concat(opportunity.baseSymbol, ":"), error_1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function getSpreadStats(opportunity) {
    return __awaiter(this, void 0, void 0, function () {
        var twentyFourHoursAgo, stats, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, prisma.spreadHistory.aggregate({
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
                        })];
                case 2:
                    stats = _a.sent();
                    return [2 /*return*/, {
                            spMax: stats._max.spread,
                            spMin: stats._min.spread,
                            crosses: stats._count.id,
                        }];
                case 3:
                    error_2 = _a.sent();
                    console.error("[Prisma] Erro ao buscar estat\u00EDsticas de spread para ".concat(opportunity.baseSymbol, ":"), error_2);
                    return [2 /*return*/, { spMax: null, spMin: null, crosses: 0 }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function getNormalizedData(symbol) {
    var match = symbol.match(/^(\d+)(.+)$/);
    if (match) {
        var factor = parseInt(match[1], 10);
        var baseSymbol = match[2];
        return { baseSymbol: baseSymbol, factor: factor };
    }
    return { baseSymbol: symbol, factor: 1 };
}
function findAndBroadcastArbitrage() {
    return __awaiter(this, void 0, void 0, function () {
        var exchangeIdentifiers, spotId, futuresId, spotPrices, futuresPrices, opportunitiesFound, symbol, spotAsk, futuresBid, profitPercentage, opportunity;
        return __generator(this, function (_a) {
            exchangeIdentifiers = Object.keys(marketPrices);
            console.log('\n[Arbitragem] Exchanges disponíveis:', exchangeIdentifiers);
            if (exchangeIdentifiers.length < 2) {
                console.log('[Arbitragem] Aguardando dados de pelo menos 2 exchanges...');
                return [2 /*return*/];
            }
            spotId = exchangeIdentifiers.find(function (id) { return id === 'GATEIO_SPOT'; });
            futuresId = exchangeIdentifiers.find(function (id) { return id === 'MEXC_FUTURES'; });
            if (!spotId || !futuresId) {
                console.log('[Arbitragem] Aguardando dados do Gate.io Spot e MEXC Futures...');
                console.log('Spot:', spotId ? 'OK' : 'Aguardando');
                console.log('Futures:', futuresId ? 'OK' : 'Aguardando');
                return [2 /*return*/];
            }
            spotPrices = marketPrices[spotId];
            futuresPrices = marketPrices[futuresId];
            console.log('\n[Preços] Gate.io Spot:');
            Object.entries(spotPrices).slice(0, 5).forEach(function (_a) {
                var symbol = _a[0], data = _a[1];
                console.log("".concat(symbol, ": Ask ").concat(data.bestAsk, ", Bid ").concat(data.bestBid));
            });
            console.log('\n[Preços] MEXC Futures:');
            Object.entries(futuresPrices).slice(0, 5).forEach(function (_a) {
                var symbol = _a[0], data = _a[1];
                console.log("".concat(symbol, ": Ask ").concat(data.bestAsk, ", Bid ").concat(data.bestBid));
            });
            opportunitiesFound = 0;
            for (symbol in spotPrices) {
                if (futuresPrices[symbol]) {
                    spotAsk = spotPrices[symbol].bestAsk;
                    futuresBid = futuresPrices[symbol].bestBid;
                    if (spotAsk > 0 && futuresBid > 0) {
                        profitPercentage = ((futuresBid - spotAsk) / spotAsk) * 100;
                        if (profitPercentage >= MIN_PROFIT_PERCENTAGE) {
                            opportunitiesFound++;
                            opportunity = {
                                type: 'arbitrage',
                                baseSymbol: symbol,
                                profitPercentage: profitPercentage,
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
                            console.log('\n[OPORTUNIDADE ENCONTRADA]');
                            console.log("Par: ".concat(symbol));
                            console.log("Compra: ".concat(spotAsk, " (").concat(spotId, ")"));
                            console.log("Venda: ".concat(futuresBid, " (").concat(futuresId, ")"));
                            console.log("Lucro: ".concat(profitPercentage.toFixed(2), "%"));
                            broadcastOpportunity(opportunity);
                        }
                    }
                }
            }
            if (opportunitiesFound === 0) {
                console.log('\n[Arbitragem] Nenhuma oportunidade encontrada neste ciclo');
            }
            else {
                console.log("\n[Arbitragem] Total de oportunidades encontradas: ".concat(opportunitiesFound));
            }
            return [2 /*return*/];
        });
    });
}
function startFeeds() {
    return __awaiter(this, void 0, void 0, function () {
        var gateioConnector, mexcConnector, spotPairs, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    console.log("\n[Iniciando] Conectando aos feeds de dados...");
                    gateioConnector = new gateio_connector_1.GateIoConnector('GATEIO_SPOT', handlePriceUpdate, function () {
                        console.log('[GateIO] WebSocket conectado e pronto');
                    });
                    mexcConnector = new mexc_connector_1.MexcConnector('MEXC_FUTURES', handlePriceUpdate, function () {
                        console.log('[MEXC] WebSocket conectado e pronto');
                    });
                    // Primeiro, conecta os WebSockets
                    console.log('\n[Conexão] Iniciando conexão com as exchanges...');
                    return [4 /*yield*/, Promise.all([
                            gateioConnector.connect(),
                            mexcConnector.connect()
                        ])];
                case 1:
                    _a.sent();
                    console.log('[Conexão] Conectado com sucesso às exchanges');
                    // Depois, busca os pares negociáveis
                    console.log('\n[Pares] Buscando pares negociáveis...');
                    return [4 /*yield*/, gateioConnector.getTradablePairs()];
                case 2:
                    spotPairs = _a.sent();
                    console.log("[GateIO] ".concat(spotPairs.length, " pares dispon\u00EDveis"));
                    console.log('Primeiros 5 pares:', spotPairs.slice(0, 5));
                    // Inscreve-se nos pares
                    console.log('\n[Inscrição] Inscrevendo-se nos pares...');
                    gateioConnector.subscribe(spotPairs);
                    mexcConnector.subscribe(spotPairs.map(function (p) { return p.replace('/', '_'); }));
                    console.log('[Inscrição] Inscrição nos pares concluída');
                    // Inicia o monitoramento de arbitragem
                    console.log('\n[Monitor] Iniciando monitoramento de arbitragem...');
                    setInterval(findAndBroadcastArbitrage, 5000);
                    console.log('\n[Sistema] Feeds iniciados com sucesso');
                    return [3 /*break*/, 4];
                case 3:
                    error_3 = _a.sent();
                    console.error('\n[ERRO] Falha ao iniciar os feeds:', error_3);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
