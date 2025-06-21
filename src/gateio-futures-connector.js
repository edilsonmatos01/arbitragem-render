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
exports.GateIoFuturesConnector = void 0;
var WebSocket = require('ws');
var node_fetch_1 = require("node-fetch");
var GateIoFuturesConnector = /** @class */ (function () {
    function GateIoFuturesConnector(identifier, onPriceUpdate, onConnect) {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000;
        this.WS_URL = 'wss://fx-ws.gateio.ws/v4/ws/usdt';
        this.REST_URL = 'https://api.gateio.ws/api/v4';
        this.subscribedSymbols = new Set();
        this.identifier = identifier;
        this.onPriceUpdate = onPriceUpdate;
        this.onConnect = onConnect;
        console.log("[".concat(this.identifier, "] Conector instanciado."));
    }
    GateIoFuturesConnector.prototype.connect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                try {
                    console.log("\n[".concat(this.identifier, "] Iniciando conex\u00E3o WebSocket..."));
                    this.ws = new WebSocket(this.WS_URL);
                    this.ws.on('open', function () {
                        console.log("[".concat(_this.identifier, "] WebSocket conectado"));
                        _this.isConnected = true;
                        _this.reconnectAttempts = 0;
                        _this.resubscribeAll();
                        _this.onConnect();
                    });
                    this.ws.on('message', function (data) {
                        try {
                            var message = JSON.parse(data.toString());
                            // Log para debug
                            console.log("\n[".concat(_this.identifier, "] Mensagem recebida:"), message);
                            // Processa atualizações de ticker
                            if (message.event === 'update' && message.channel === 'futures.book_ticker') {
                                var _a = message.result, symbol = _a.s, ask = _a.a, bid = _a.b;
                                var formattedSymbol = symbol.replace('_', '/');
                                if (ask && bid) {
                                    _this.onPriceUpdate({
                                        type: 'price-update',
                                        symbol: formattedSymbol,
                                        marketType: 'futures',
                                        bestAsk: parseFloat(ask),
                                        bestBid: parseFloat(bid),
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
                        _this.isConnected = false;
                        if (_this.reconnectAttempts < _this.maxReconnectAttempts) {
                            console.log("[".concat(_this.identifier, "] Tentando reconectar em ").concat(_this.reconnectDelay, "ms..."));
                            setTimeout(function () { return _this.connect(); }, _this.reconnectDelay);
                            _this.reconnectAttempts++;
                        }
                        else {
                            console.error("[".concat(_this.identifier, "] N\u00FAmero m\u00E1ximo de tentativas de reconex\u00E3o atingido"));
                        }
                    });
                    this.ws.on('error', function (error) {
                        console.error("[".concat(_this.identifier, "] Erro na conex\u00E3o WebSocket:"), error);
                    });
                }
                catch (error) {
                    console.error("[".concat(this.identifier, "] Erro ao conectar:"), error);
                    throw error;
                }
                return [2 /*return*/];
            });
        });
    };
    GateIoFuturesConnector.prototype.getTradablePairs = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, data, pairs, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        console.log("[".concat(this.identifier, "] Buscando pares negoci\u00E1veis..."));
                        return [4 /*yield*/, (0, node_fetch_1.default)("".concat(this.REST_URL, "/futures/usdt/contracts"))];
                    case 1:
                        response = _a.sent();
                        return [4 /*yield*/, response.json()];
                    case 2:
                        data = _a.sent();
                        if (!Array.isArray(data)) {
                            throw new Error('Formato de resposta inválido');
                        }
                        pairs = data
                            .filter(function (contract) { return contract.in_delisting === false; })
                            .map(function (contract) { return contract.name.replace('_', '/'); });
                        console.log("[".concat(this.identifier, "] ").concat(pairs.length, " pares encontrados"));
                        console.log('Primeiros 5 pares:', pairs.slice(0, 5));
                        return [2 /*return*/, pairs];
                    case 3:
                        error_1 = _a.sent();
                        console.error("[".concat(this.identifier, "] Erro ao buscar pares:"), error_1);
                        return [2 /*return*/, []];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    GateIoFuturesConnector.prototype.subscribe = function (pairs) {
        var _this = this;
        if (!this.ws || !this.isConnected) {
            console.error("[".concat(this.identifier, "] WebSocket n\u00E3o est\u00E1 conectado"));
            return;
        }
        try {
            console.log("\n[".concat(this.identifier, "] Inscrevendo-se em ").concat(pairs.length, " pares"));
            pairs.forEach(function (symbol) {
                var formattedSymbol = symbol.replace('/', '_');
                _this.subscribedSymbols.add(symbol);
                var subscribeMessage = {
                    time: Math.floor(Date.now() / 1000),
                    channel: 'futures.book_ticker',
                    event: 'subscribe',
                    payload: [formattedSymbol]
                };
                _this.ws.send(JSON.stringify(subscribeMessage));
            });
            console.log("[".concat(this.identifier, "] Mensagens de inscri\u00E7\u00E3o enviadas"));
            console.log('Primeiros 5 pares inscritos:', pairs.slice(0, 5));
        }
        catch (error) {
            console.error("[".concat(this.identifier, "] Erro ao se inscrever nos pares:"), error);
        }
    };
    GateIoFuturesConnector.prototype.resubscribeAll = function () {
        var pairs = Array.from(this.subscribedSymbols);
        if (pairs.length > 0) {
            console.log("[".concat(this.identifier, "] Reinscrevendo em ").concat(pairs.length, " pares..."));
            this.subscribe(pairs);
        }
    };
    return GateIoFuturesConnector;
}());
exports.GateIoFuturesConnector = GateIoFuturesConnector;
