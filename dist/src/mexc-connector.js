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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MexcConnector = void 0;
var ws_1 = __importDefault(require("ws"));
var node_fetch_1 = __importDefault(require("node-fetch"));
var MexcConnector = /** @class */ (function () {
    function MexcConnector(identifier, onPriceUpdate, onConnect) {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000;
        this.WS_URL = 'wss://wbs.mexc.com/ws';
        this.REST_URL = 'https://api.mexc.com/api/v3';
        this.identifier = identifier;
        this.onPriceUpdate = onPriceUpdate;
        this.onConnect = onConnect;
    }
    MexcConnector.prototype.connect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                try {
                    console.log('\n[MEXC] Iniciando conexão WebSocket...');
                    this.ws = new ws_1.default(this.WS_URL);
                    this.ws.on('open', function () {
                        console.log('\n[MEXC] WebSocket conectado');
                        _this.isConnected = true;
                        _this.reconnectAttempts = 0;
                        _this.onConnect();
                    });
                    this.ws.on('message', function (data) {
                        try {
                            var message = JSON.parse(data.toString());
                            
                            // Log da mensagem recebida para debug
                            console.log('\n[MEXC] Mensagem recebida:', JSON.stringify(message));

                            // Processa ping/pong
                            if (message.op === 'ping') {
                                console.log('[MEXC] Ping recebido, enviando pong');
                                _this.ws?.send(JSON.stringify({ op: 'pong' }));
                                _this.updateLastPongTime();
                                return;
                            }

                            if (message.op === 'pong') {
                                console.log('[MEXC] Pong recebido');
                                _this.updateLastPongTime();
                                return;
                            }

                            // Processa confirmação de subscrição
                            if (message.channel === 'sub.response') {
                                if (message.code === 0) {
                                    console.log('[MEXC] Subscrição confirmada para:', message.symbol);
                                } else {
                                    console.error('[MEXC] Erro na subscrição:', message);
                                }
                                return;
                            }

                            // Processa dados do ticker
                            if (message.c === 'spot.ticker' && message.d) {
                                var ticker = message.d;
                                var symbol = ticker.s.replace('_', '/');
                                var bestAsk = parseFloat(ticker.a);
                                var bestBid = parseFloat(ticker.b);

                                if (isNaN(bestAsk) || isNaN(bestBid)) {
                                    console.warn('[MEXC] Valores inválidos recebidos:', ticker);
                                    return;
                                }

                                _this.onPriceUpdate({
                                    type: 'price-update',
                                    symbol: symbol,
                                    marketType: 'spot',
                                    bestAsk: bestAsk,
                                    bestBid: bestBid,
                                    identifier: _this.identifier
                                });
                            }
                        } catch (error) {
                            console.error('\n[MEXC] Erro ao processar mensagem:', error);
                        }
                    });
                    this.ws.on('close', function (code, reason) {
                        console.log("\n[MEXC] WebSocket desconectado: ".concat(code, " - ").concat(reason));
                        _this.isConnected = false;
                        _this.handleReconnect();
                    });
                    this.ws.on('error', function (error) {
                        console.error('\n[MEXC] Erro no WebSocket:', error);
                        _this.handleReconnect();
                    });
                }
                catch (error) {
                    console.error('\n[MEXC] Erro ao conectar:', error);
                    this.handleReconnect();
                }
                return [2 /*return*/];
            });
        });
    };
    MexcConnector.prototype.handleReconnect = function () {
        var _this = this;
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log("\n[MEXC] Tentativa de reconex\u00E3o ".concat(this.reconnectAttempts, "/").concat(this.maxReconnectAttempts, " em ").concat(this.reconnectDelay, "ms"));
            setTimeout(function () { return _this.connect(); }, this.reconnectDelay);
        }
        else {
            console.error('\n[MEXC] Máximo de tentativas de reconexão atingido');
        }
    };
    MexcConnector.prototype.subscribe = function (symbols) {
        if (!this.ws || !this.isConnected) {
            console.error('\n[MEXC] Tentativa de inscrição sem conexão ativa');
            return;
        }
        try {
            console.log("\n[MEXC] Inscrevendo em ".concat(symbols.length, " pares..."));
            
            symbols.forEach(function(symbol) {
                var formattedSymbol = symbol.replace('/', '_').toUpperCase();
                var subscribeMessage = {
                    "method": "SUBSCRIPTION",
                    "params": ["spot.ticker." + formattedSymbol]
                };

                console.log('\n[MEXC] Enviando mensagem de subscrição:', JSON.stringify(subscribeMessage));
                this.ws.send(JSON.stringify(subscribeMessage));
            }.bind(this));
        }
        catch (error) {
            console.error('\n[MEXC] Erro ao se inscrever:', error);
        }
    };
    MexcConnector.prototype.getTradablePairs = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, data, pairs, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        console.log('\n[MEXC] Buscando pares negociáveis...');
                        return [4 /*yield*/, (0, node_fetch_1.default)("".concat(this.REST_URL, "/exchangeInfo"))];
                    case 1:
                        response = _a.sent();
                        return [4 /*yield*/, response.json()];
                    case 2:
                        data = _a.sent();
                        pairs = data.symbols
                            .filter(function (symbol) { return symbol.status === 'ENABLED'; })
                            .map(function (symbol) { return symbol.symbol; });
                        console.log("\n[MEXC] ".concat(pairs.length, " pares encontrados"));
                        return [2 /*return*/, pairs];
                    case 3:
                        error_1 = _a.sent();
                        console.error('\n[MEXC] Erro ao buscar pares:', error_1);
                        return [2 /*return*/, []];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    MexcConnector.prototype.updateLastPongTime = function() {
        this.lastPongTime = Date.now();
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
        }
    };
    return MexcConnector;
}());
exports.MexcConnector = MexcConnector;
