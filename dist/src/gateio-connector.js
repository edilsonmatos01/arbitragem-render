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
exports.GateIoConnector = void 0;
var ws_1 = __importDefault(require("ws"));
var node_fetch_1 = __importDefault(require("node-fetch"));
var GATEIO_WS_URL = 'wss://api.gateio.ws/ws/v4/';
/**
 * Gerencia a conexão WebSocket e as inscrições para os feeds da Gate.io.
 * Pode ser configurado para SPOT ou FUTURES.
 */
var GateIoConnector = /** @class */ (function () {
    function GateIoConnector(identifier, onPriceUpdate, onConnect) {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000;
        this.identifier = identifier;
        this.onPriceUpdate = onPriceUpdate;
        this.onConnect = onConnect;
    }
    GateIoConnector.prototype.connect = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                try {
                    console.log('\n[GateIO] Iniciando conexão WebSocket...');
                    this.ws = new ws_1.default('wss://api.gateio.ws/ws/v4/');
                    this.ws.on('open', function () {
                        console.log('[GateIO] WebSocket conectado');
                        _this.isConnected = true;
                        _this.reconnectAttempts = 0;
                        _this.onConnect();
                    });
                    this.ws.on('message', function (data) {
                        try {
                            var message = JSON.parse(data.toString());
                            if (message.event === 'update' && message.channel === 'spot.book_ticker') {
                                var _a = message.result, currency_pair = _a.currency_pair, ask = _a.ask, bid = _a.bid;
                                console.log("\n[GateIO] Atualiza\u00E7\u00E3o de pre\u00E7o para ".concat(currency_pair));
                                console.log("Ask: ".concat(ask, ", Bid: ").concat(bid));
                                _this.onPriceUpdate({
                                    type: 'price-update',
                                    symbol: currency_pair,
                                    marketType: 'spot',
                                    bestAsk: parseFloat(ask),
                                    bestBid: parseFloat(bid),
                                    identifier: _this.identifier
                                });
                            }
                        }
                        catch (error) {
                            console.error('[GateIO] Erro ao processar mensagem:', error);
                        }
                    });
                    this.ws.on('close', function (code, reason) {
                        console.log("[GateIO] WebSocket fechado. C\u00F3digo: ".concat(code, ", Raz\u00E3o: ").concat(reason));
                        _this.isConnected = false;
                        if (_this.reconnectAttempts < _this.maxReconnectAttempts) {
                            console.log("[GateIO] Tentando reconectar em ".concat(_this.reconnectDelay, "ms..."));
                            setTimeout(function () { return _this.connect(); }, _this.reconnectDelay);
                            _this.reconnectAttempts++;
                        }
                        else {
                            console.error('[GateIO] Número máximo de tentativas de reconexão atingido');
                        }
                    });
                    this.ws.on('error', function (error) {
                        console.error('[GateIO] Erro na conexão WebSocket:', error);
                    });
                }
                catch (error) {
                    console.error('[GateIO] Erro ao conectar:', error);
                    throw error;
                }
                return [2 /*return*/];
            });
        });
    };
    GateIoConnector.prototype.getTradablePairs = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, data, pairs, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        console.log('[GateIO] Buscando pares negociáveis...');
                        return [4 /*yield*/, (0, node_fetch_1.default)('https://api.gateio.ws/api/v4/spot/currency_pairs')];
                    case 1:
                        response = _a.sent();
                        return [4 /*yield*/, response.json()];
                    case 2:
                        data = _a.sent();
                        pairs = data
                            .filter(function (pair) { return pair.trade_status === 'tradable'; })
                            .map(function (pair) { return pair.id; });
                        console.log("[GateIO] ".concat(pairs.length, " pares encontrados"));
                        console.log('Primeiros 5 pares:', pairs.slice(0, 5));
                        return [2 /*return*/, pairs];
                    case 3:
                        error_1 = _a.sent();
                        console.error('[GateIO] Erro ao buscar pares:', error_1);
                        throw error_1;
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    GateIoConnector.prototype.subscribe = function (pairs) {
        if (!this.ws || !this.isConnected) {
            console.error('[GateIO] WebSocket não está conectado');
            return;
        }
        try {
            console.log("\n[GateIO] Inscrevendo-se em ".concat(pairs.length, " pares"));
            var subscribeMessage = {
                time: Math.floor(Date.now() / 1000),
                channel: 'spot.book_ticker',
                event: 'subscribe',
                payload: pairs
            };
            this.ws.send(JSON.stringify(subscribeMessage));
            console.log('[GateIO] Mensagem de inscrição enviada');
            console.log('Primeiros 5 pares inscritos:', pairs.slice(0, 5));
        }
        catch (error) {
            console.error('[GateIO] Erro ao se inscrever nos pares:', error);
        }
    };
    return GateIoConnector;
}());
exports.GateIoConnector = GateIoConnector;
