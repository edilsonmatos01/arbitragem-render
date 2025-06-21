"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.MexcConnector = void 0;
var WebSocket = require('ws');
var node_fetch_1 = require("node-fetch");
var events_1 = require("events");
var MexcConnector = /** @class */ (function (_super) {
    __extends(MexcConnector, _super);
    function MexcConnector(identifier, onPriceUpdate, onConnect) {
        var _this = _super.call(this) || this;
        _this.ws = null;
        _this.isConnected = false;
        _this.isConnecting = false;
        _this.reconnectAttempts = 0;
        _this.baseReconnectDelay = 5000; // 5 segundos
        _this.maxReconnectDelay = 300000; // 5 minutos
        _this.WS_URL = 'wss://wbs.mexc.com/ws';
        _this.REST_URL = 'https://api.mexc.com/api/v3';
        _this.heartbeatInterval = null;
        _this.heartbeatTimeout = null;
        _this.subscribedSymbols = new Set();
        _this.fallbackRestInterval = null;
        _this.connectionStartTime = 0;
        _this.lastPongTime = 0;
        _this.HEARTBEAT_INTERVAL = 30000; // 30 segundos
        _this.HEARTBEAT_TIMEOUT = 10000; // 10 segundos
        _this.REST_FALLBACK_INTERVAL = 30000; // 30 segundos
        _this.isBlocked = false;
        _this.maxReconnectAttempts = 5;
        _this.reconnectDelay = 5000;
        _this.identifier = identifier;
        _this.onPriceUpdate = onPriceUpdate;
        _this.onConnect = onConnect;
        return _this;
    }
    MexcConnector.prototype.connect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_1;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.isConnecting) {
                            console.log("[".concat(this.identifier, "] J\u00E1 existe uma tentativa de conex\u00E3o em andamento"));
                            return [2 /*return*/];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        this.isConnecting = true;
                        this.connectionStartTime = Date.now();
                        // Limpa conexão anterior se existir
                        return [4 /*yield*/, this.cleanup()];
                    case 2:
                        // Limpa conexão anterior se existir
                        _a.sent();
                        console.log("\n[".concat(this.identifier, "] Iniciando conex\u00E3o WebSocket..."));
                        this.ws = new WebSocket(this.WS_URL);
                        if (!this.ws) {
                            throw new Error('Falha ao criar WebSocket');
                        }
                        this.ws.on('open', function () {
                            console.log("[".concat(_this.identifier, "] WebSocket conectado"));
                            _this.isConnected = true;
                            _this.isConnecting = false;
                            _this.reconnectAttempts = 0;
                            _this.lastPongTime = Date.now();
                            _this.startHeartbeat();
                            if (_this.subscribedSymbols.size > 0) {
                                _this.resubscribeAll();
                            }
                            _this.onConnect();
                            _this.stopRestFallback();
                        });
                        this.ws.on('message', function (data) {
                            try {
                                var message = JSON.parse(data.toString());
                                console.log("\n[".concat(_this.identifier, "] Mensagem recebida:"), message);
                                if (message.channel === 'spot.book_ticker') {
                                    var _a = message.data, symbol = _a.symbol, ask = _a.ask, bid = _a.bid;
                                    console.log("\n[".concat(_this.identifier, "] Atualiza\u00E7\u00E3o de pre\u00E7o para ").concat(symbol));
                                    console.log("Ask: ".concat(ask, ", Bid: ").concat(bid));
                                    _this.onPriceUpdate({
                                        type: 'price-update',
                                        symbol: symbol,
                                        marketType: 'spot',
                                        bestAsk: parseFloat(ask),
                                        bestBid: parseFloat(bid),
                                        identifier: _this.identifier
                                    });
                                }
                            }
                            catch (error) {
                                console.error("[".concat(_this.identifier, "] Erro ao processar mensagem:"), error);
                            }
                        });
                        this.ws.on('close', function (code, reason) {
                            console.log("[".concat(_this.identifier, "] WebSocket desconectado, c\u00F3digo: ").concat(code, ", raz\u00E3o: ").concat(reason));
                            _this.handleDisconnect();
                        });
                        this.ws.on('error', function (error) {
                            console.error("[".concat(_this.identifier, "] Erro na conex\u00E3o:"), error);
                            _this.handleDisconnect();
                        });
                        // Configura timeout para a conexão inicial
                        setTimeout(function () {
                            if (!_this.isConnected) {
                                _this.handleDisconnect();
                            }
                        }, 10000);
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        console.error("[".concat(this.identifier, "] Erro ao conectar:"), error_1);
                        this.handleDisconnect();
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    MexcConnector.prototype.cleanup = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (this.ws) {
                    try {
                        this.ws.removeAllListeners();
                        if (this.ws.readyState === WebSocket.OPEN) {
                            this.ws.close();
                        }
                        this.ws.terminate();
                    }
                    catch (error) {
                        console.error("[".concat(this.identifier, "] Erro ao limpar conex\u00E3o:"), error);
                    }
                }
                this.stopHeartbeat();
                this.isConnected = false;
                return [2 /*return*/];
            });
        });
    };
    MexcConnector.prototype.handleDisconnect = function () {
        var _this = this;
        console.log("[".concat(this.identifier, "] Desconectado: Conex\u00E3o fechada pelo servidor"));
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
    MexcConnector.prototype.scheduleReconnect = function () {
        var _this = this;
        // Não tenta reconectar se estiver bloqueado
        if (this.isBlocked) {
            return;
        }
        var delay = Math.min(this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
        this.reconnectAttempts++;
        console.log("[".concat(this.identifier, "] Tentativa de reconex\u00E3o ").concat(this.reconnectAttempts, " em ").concat(delay / 1000, "s"));
        if (Date.now() - this.connectionStartTime > 300000) { // 5 minutos
            console.log("[".concat(this.identifier, "] WebSocket n\u00E3o reconectou ap\u00F3s m\u00FAltiplas tentativas. Verifique a conex\u00E3o."));
        }
        setTimeout(function () { return _this.connect(); }, delay);
    };
    MexcConnector.prototype.startHeartbeat = function () {
        this.stopHeartbeat();
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify({ method: 'PING' }));
            }
            catch (error) {
                console.error("[".concat(this.identifier, "] Erro ao enviar PING:"), error);
            }
        }
    };
    MexcConnector.prototype.stopHeartbeat = function () {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
        }
    };
    MexcConnector.prototype.updateLastPongTime = function () {
        this.lastPongTime = Date.now();
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
        }
    };
    MexcConnector.prototype.startRestFallback = function () {
        var _this = this;
        if (this.fallbackRestInterval)
            return;
        console.log("[".concat(this.identifier, "] Iniciando fallback para REST API"));
        this.fallbackRestInterval = setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
            var _i, _a, symbol, formattedSymbol, response, data, price, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 6, , 7]);
                        _i = 0, _a = this.subscribedSymbols;
                        _b.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 5];
                        symbol = _a[_i];
                        formattedSymbol = symbol.replace('/', '');
                        return [4 /*yield*/, (0, node_fetch_1.default)("".concat(this.REST_URL, "/ticker/price?symbol=").concat(formattedSymbol))];
                    case 2:
                        response = _b.sent();
                        return [4 /*yield*/, response.json()];
                    case 3:
                        data = _b.sent();
                        if (data.price) {
                            price = parseFloat(data.price);
                            this.onPriceUpdate({
                                type: 'price-update',
                                symbol: symbol,
                                marketType: 'spot',
                                bestAsk: price,
                                bestBid: price,
                                identifier: this.identifier
                            });
                        }
                        _b.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 1];
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        error_2 = _b.sent();
                        console.error("[".concat(this.identifier, "] Erro ao buscar pre\u00E7os via REST:"), error_2);
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        }); }, this.REST_FALLBACK_INTERVAL);
    };
    MexcConnector.prototype.stopRestFallback = function () {
        if (this.fallbackRestInterval) {
            clearInterval(this.fallbackRestInterval);
            this.fallbackRestInterval = null;
        }
    };
    MexcConnector.prototype.resubscribeAll = function () {
        var symbols = Array.from(this.subscribedSymbols);
        if (symbols.length > 0) {
            console.log("[".concat(this.identifier, "] Reinscrevendo em ").concat(symbols.length, " pares..."));
            this.subscribe(symbols);
        }
    };
    MexcConnector.prototype.subscribe = function (symbols) {
        return __awaiter(this, void 0, void 0, function () {
            var _i, symbols_1, symbol, subscriptionMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!(!this.ws || this.ws.readyState !== WebSocket.OPEN)) return [3 /*break*/, 2];
                        console.log("[".concat(this.identifier, "] WebSocket n\u00E3o est\u00E1 conectado. Tentando reconectar..."));
                        return [4 /*yield*/, this.connect()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                    case 2:
                        for (_i = 0, symbols_1 = symbols; _i < symbols_1.length; _i++) {
                            symbol = symbols_1[_i];
                            try {
                                subscriptionMessage = {
                                    method: 'sub.book_ticker',
                                    param: {
                                        symbol: symbol.replace('/', '').toLowerCase()
                                    }
                                };
                                console.log("[".concat(this.identifier, "] Inscrevendo-se em ").concat(symbol, ":"), subscriptionMessage);
                                this.ws.send(JSON.stringify(subscriptionMessage));
                            }
                            catch (error) {
                                console.error("[".concat(this.identifier, "] Erro ao se inscrever em ").concat(symbol, ":"), error);
                            }
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    MexcConnector.prototype.getTradablePairs = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, data, pairs, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        console.log("[".concat(this.identifier, "] Buscando pares negoci\u00E1veis..."));
                        return [4 /*yield*/, (0, node_fetch_1.default)("".concat(this.REST_URL, "/ticker/price"))];
                    case 1:
                        response = _a.sent();
                        return [4 /*yield*/, response.json()];
                    case 2:
                        data = _a.sent();
                        if (!Array.isArray(data)) {
                            throw new Error('Formato de resposta inválido');
                        }
                        pairs = data
                            .map(function (ticker) { return ticker.symbol.replace(/([A-Z0-9]+)([A-Z0-9]+)$/, '$1/$2'); });
                        console.log("[".concat(this.identifier, "] ").concat(pairs.length, " pares encontrados"));
                        return [2 /*return*/, pairs];
                    case 3:
                        error_3 = _a.sent();
                        console.error("[".concat(this.identifier, "] Erro ao buscar pares:"), error_3);
                        return [2 /*return*/, []];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return MexcConnector;
}(events_1.EventEmitter));
exports.MexcConnector = MexcConnector;
