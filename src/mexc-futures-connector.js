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
exports.MexcFuturesConnector = void 0;
var WebSocket = require('ws');
var node_fetch_1 = require("node-fetch");
var MexcFuturesConnector = /** @class */ (function () {
    function MexcFuturesConnector(identifier, onPriceUpdate, onConnect) {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000;
        this.WS_URL = 'wss://contract.mexc.com/ws';
        this.REST_URL = 'https://contract.mexc.com/api/v1';
        this.subscribedSymbols = new Set();
        this.heartbeatInterval = null;
        this.HEARTBEAT_INTERVAL = 20000; // 20 seconds
        this.identifier = identifier;
        this.onPriceUpdate = onPriceUpdate;
        this.onConnect = onConnect;
        console.log("[".concat(this.identifier, "] Conector instanciado."));
    }
    MexcFuturesConnector.prototype.startHeartbeat = function () {
        var _this = this;
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        this.heartbeatInterval = setInterval(function () {
            if (_this.ws && _this.isConnected) {
                try {
                    var pingMessage = { "method": "ping" };
                    _this.ws.send(JSON.stringify(pingMessage));
                    console.log("[".concat(_this.identifier, "] Ping enviado"));
                }
                catch (error) {
                    console.error("[".concat(_this.identifier, "] Erro ao enviar ping:"), error);
                    _this.handleDisconnect();
                }
            }
        }, this.HEARTBEAT_INTERVAL);
    };
    MexcFuturesConnector.prototype.stopHeartbeat = function () {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    };
    MexcFuturesConnector.prototype.cleanup = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.stopHeartbeat();
                if (this.ws) {
                    try {
                        this.ws.removeAllListeners();
                        if (this.ws.readyState === WebSocket.OPEN) {
                            this.ws.close();
                        }
                        this.ws = null;
                    }
                    catch (error) {
                        console.error("[".concat(this.identifier, "] Erro ao limpar conex\u00E3o:"), error);
                    }
                }
                this.isConnected = false;
                return [2 /*return*/];
            });
        });
    };
    MexcFuturesConnector.prototype.handleDisconnect = function () {
        var _this = this;
        this.cleanup().then(function () {
            if (_this.reconnectAttempts < _this.maxReconnectAttempts) {
                console.log("[".concat(_this.identifier, "] Tentando reconectar em ").concat(_this.reconnectDelay, "ms..."));
                setTimeout(function () { return _this.connect(); }, _this.reconnectDelay);
                _this.reconnectAttempts++;
            }
            else {
                console.error("[".concat(_this.identifier, "] N\u00FAmero m\u00E1ximo de tentativas de reconex\u00E3o atingido"));
            }
        });
    };
    MexcFuturesConnector.prototype.connect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_1;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.cleanup()];
                    case 1:
                        _a.sent(); // Clean up before connecting
                        console.log("\n[".concat(this.identifier, "] Iniciando conex\u00E3o WebSocket..."));
                        this.ws = new WebSocket(this.WS_URL);
                        this.ws.on('open', function () {
                            console.log("[".concat(_this.identifier, "] WebSocket conectado"));
                            _this.isConnected = true;
                            _this.reconnectAttempts = 0;
                            _this.startHeartbeat();
                            _this.resubscribeAll();
                            _this.onConnect();
                        });
                        this.ws.on('message', function (data) {
                            var _a;
                            try {
                                var message = JSON.parse(data.toString());
                                // Log para debug
                                console.log("\n[".concat(_this.identifier, "] Mensagem recebida:"), message);
                                // Handle pong response
                                if (message.method === 'pong') {
                                    console.log("[".concat(_this.identifier, "] Pong recebido"));
                                    return;
                                }
                                // Handle subscription confirmation
                                if (message.channel === 'rs.sub.ticker') {
                                    if (message.code === 0) {
                                        console.log("[".concat(_this.identifier, "] Subscri\u00E7\u00E3o confirmada para:"), message.data);
                                    }
                                    else {
                                        console.error("[".concat(_this.identifier, "] Erro na subscri\u00E7\u00E3o:"), message);
                                        // Try to resubscribe if it's a temporary error
                                        if (message.code === 1) {
                                            var symbol_1 = (_a = message.data) === null || _a === void 0 ? void 0 : _a.symbol;
                                            if (symbol_1) {
                                                setTimeout(function () {
                                                    console.log("[".concat(_this.identifier, "] Tentando reinscrever em ").concat(symbol_1, "..."));
                                                    _this.subscribe([symbol_1.replace('_', '/')]);
                                                }, 5000);
                                            }
                                        }
                                    }
                                    return;
                                }
                                // Processa atualizações de ticker
                                if (message.symbol && message.data) {
                                    var symbol = message.symbol.replace('_', '/');
                                    var _b = message.data, bestAsk = _b.ask1, bestBid = _b.bid1;
                                    if (bestAsk && bestBid) {
                                        _this.onPriceUpdate({
                                            type: 'price-update',
                                            symbol: symbol,
                                            marketType: 'futures',
                                            bestAsk: parseFloat(bestAsk),
                                            bestBid: parseFloat(bestBid),
                                            identifier: _this.identifier
                                        });
                                    }
                                }
                            }
                            catch (error) {
                                console.error("[".concat(_this.identifier, "] Erro ao processar mensagem:"), error);
                            }
                        });
                        this.ws.on('close', function (code, reason) {
                            console.log("[".concat(_this.identifier, "] WebSocket fechado. C\u00F3digo: ").concat(code, ", Raz\u00E3o: ").concat(reason));
                            _this.handleDisconnect();
                        });
                        this.ws.on('error', function (error) {
                            console.error("[".concat(_this.identifier, "] Erro na conex\u00E3o WebSocket:"), error);
                            _this.handleDisconnect();
                        });
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _a.sent();
                        console.error("[".concat(this.identifier, "] Erro ao conectar:"), error_1);
                        this.handleDisconnect();
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    MexcFuturesConnector.prototype.getTradablePairs = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, data, pairs, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        console.log("[".concat(this.identifier, "] Buscando pares negoci\u00E1veis..."));
                        return [4 /*yield*/, (0, node_fetch_1.default)("".concat(this.REST_URL, "/contract/risk_limit"))];
                    case 1:
                        response = _a.sent();
                        return [4 /*yield*/, response.json()];
                    case 2:
                        data = _a.sent();
                        if (!data.success || !Array.isArray(data.data)) {
                            throw new Error('Formato de resposta inválido');
                        }
                        pairs = data.data
                            .map(function (contract) { return contract.symbol.replace('_', '/'); })
                            .filter(function (symbol) { return symbol.endsWith('USDT'); });
                        console.log("[".concat(this.identifier, "] ").concat(pairs.length, " pares encontrados"));
                        if (pairs.length > 0) {
                            console.log('Primeiros 5 pares:', pairs.slice(0, 5));
                        }
                        return [2 /*return*/, pairs];
                    case 3:
                        error_2 = _a.sent();
                        console.error("[".concat(this.identifier, "] Erro ao buscar pares:"), error_2);
                        return [2 /*return*/, []];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    MexcFuturesConnector.prototype.subscribe = function (pairs) {
        var _this = this;
        if (!this.ws || !this.isConnected) {
            console.error("[".concat(this.identifier, "] WebSocket n\u00E3o est\u00E1 conectado"));
            return;
        }
        try {
            console.log("\n[".concat(this.identifier, "] Inscrevendo-se em ").concat(pairs.length, " pares"));
            pairs.forEach(function (symbol) {
                var formattedSymbol = symbol.replace('/', '_');
                var subscriptionMessage = {
                    "method": "sub.ticker",
                    "param": {
                        "symbol": formattedSymbol
                    }
                };
                _this.ws.send(JSON.stringify(subscriptionMessage));
                _this.subscribedSymbols.add(symbol);
                console.log("[".concat(_this.identifier, "] Inscrito em ").concat(symbol));
            });
        }
        catch (error) {
            console.error("[".concat(this.identifier, "] Erro ao se inscrever:"), error);
        }
    };
    MexcFuturesConnector.prototype.resubscribeAll = function () {
        var symbols = Array.from(this.subscribedSymbols);
        if (symbols.length > 0) {
            console.log("[".concat(this.identifier, "] Reinscrevendo em ").concat(symbols.length, " pares..."));
            this.subscribe(symbols);
        }
    };
    return MexcFuturesConnector;
}());
exports.MexcFuturesConnector = MexcFuturesConnector;
