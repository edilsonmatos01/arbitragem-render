"use strict";
<<<<<<< HEAD
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
exports.GateIoConnector = void 0;
var WebSocket = require('ws');
var node_fetch_1 = require("node-fetch");
var GateIoConnector = /** @class */ (function () {
    function GateIoConnector(identifier, onPriceUpdate, onConnect) {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000;
        this.WS_URL = 'wss://api.gateio.ws/ws/v4/';
        this.REST_URL = 'https://api.gateio.ws/api/v4';
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
                    this.ws = new WebSocket(this.WS_URL);
                    this.ws.on('open', function () {
                        console.log('[GateIO] WebSocket conectado');
                        _this.isConnected = true;
                        _this.reconnectAttempts = 0;
                        _this.onConnect();
                    });
                    this.ws.on('message', function (data) {
                        try {
                            var message = JSON.parse(data.toString());
                            console.log('\n[GateIO] Mensagem recebida:', message);
                            if (message.event === 'update' && message.channel === 'spot.book_ticker') {
                                var _a = message.result, symbol = _a.s, ask = _a.a, bid = _a.b;
                                console.log("\n[GateIO] Atualiza\u00E7\u00E3o de pre\u00E7o para ".concat(symbol));
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
                        return [4 /*yield*/, (0, node_fetch_1.default)("".concat(this.REST_URL, "/spot/currency_pairs"))];
                    case 1:
                        response = _a.sent();
                        return [4 /*yield*/, response.json()];
                    case 2:
                        data = _a.sent();
                        pairs = data
                            .filter(function (pair) { return pair.trade_status === 'tradable' && pair.quote === 'USDT'; })
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
=======
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GateIoConnector = void 0;
const ws_1 = __importDefault(require("ws"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const GATEIO_WS_URL = 'wss://api.gateio.ws/ws/v4/';
/**
 * Gerencia a conexão WebSocket e as inscrições para os feeds da Gate.io.
 * Pode ser configurado para SPOT ou FUTURES.
 */
class GateIoConnector {
    constructor(identifier, marketPrices) {
        this.ws = null;
        this.subscriptionQueue = [];
        this.isConnected = false;
        this.pingInterval = null;
        this.reconnectTimeout = null;
        this.marketIdentifier = identifier;
        this.marketType = identifier.includes('_SPOT') ? 'spot' : 'futures';
        this.marketPrices = marketPrices;
        console.log(`[${this.marketIdentifier}] Conector inicializado.`);
    }
    async getTradablePairs() {
        const endpoint = this.marketType === 'spot'
            ? 'https://api.gateio.ws/api/v4/spot/currency_pairs'
            : 'https://api.gateio.ws/api/v4/futures/usdt/contracts';
        try {
            console.log(`[${this.marketIdentifier}] Buscando pares negociáveis de ${endpoint}`);
            const response = await (0, node_fetch_1.default)(endpoint);
            if (!response.ok) {
                throw new Error(`Falha na API: ${response.statusText}`);
            }
            const data = await response.json();
            if (!Array.isArray(data)) {
                console.warn(`[${this.marketIdentifier}] A resposta da API não foi uma lista (possível geoblocking).`);
                return [];
            }
            if (this.marketType === 'spot') {
                return data
                    .filter(p => p.trade_status === 'tradable' && p.quote === 'USDT')
                    .map(p => p.id.replace('_', '/')); // Converte 'BTC_USDT' para 'BTC/USDT'
            }
            else {
                return data
                    .filter(c => c.in_delisting === false)
                    .map(c => c.name.replace('_', '/')); // Converte 'BTC_USDT' para 'BTC/USDT'
            }
        }
        catch (error) {
            console.error(`[${this.marketIdentifier}] Erro ao buscar pares negociáveis:`, error);
            return [];
        }
    }
    connect(pairs) {
        this.subscriptionQueue = pairs.map(p => p.replace('/', '_')); // Gate.io usa '_'
        if (this.ws) {
            this.ws.close();
        }
        console.log(`[${this.marketIdentifier}] Conectando a ${GATEIO_WS_URL}`);
        this.ws = new ws_1.default(GATEIO_WS_URL);
        this.ws.on('open', this.onOpen.bind(this));
        this.ws.on('message', this.onMessage.bind(this));
        this.ws.on('close', this.onClose.bind(this));
        this.ws.on('error', this.onError.bind(this));
    }
    onOpen() {
        console.log(`[${this.marketIdentifier}] Conexão WebSocket estabelecida.`);
        this.isConnected = true;
        this.startPinging();
        this.processSubscriptionQueue();
    }
    onMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            if (message.channel === 'spot.ping' || message.channel === 'futures.ping') {
                return; // Ignora pongs
            }
            if (message.event === 'update' && message.result) {
                this.handleTickerUpdate(message.result);
            }
        }
        catch (error) {
            console.error(`[${this.marketIdentifier}] Erro ao processar mensagem:`, error);
        }
    }
    handleTickerUpdate(ticker) {
        const pair = (ticker.currency_pair || ticker.contract).replace('_', '/');
        const priceData = {
            bestAsk: parseFloat(ticker.lowest_ask || ticker.ask1),
            bestBid: parseFloat(ticker.highest_bid || ticker.bid1),
            timestamp: Date.now()
        };
        if (!priceData.bestAsk || !priceData.bestBid)
            return;
        if (!this.marketPrices[this.marketIdentifier]) {
            this.marketPrices[this.marketIdentifier] = {};
        }
        this.marketPrices[this.marketIdentifier][pair] = priceData;
    }
    processSubscriptionQueue() {
        if (!this.ws || this.ws.readyState !== ws_1.default.OPEN || this.subscriptionQueue.length === 0) {
            return;
        }
        const channel = this.marketType === 'spot' ? 'spot.tickers' : 'futures.tickers';
        // Gate.io aceita múltiplas inscrições em uma única mensagem
        const payload = this.subscriptionQueue;
        this.subscriptionQueue = []; // Limpa a fila
        const msg = {
            time: Math.floor(Date.now() / 1000),
            channel: channel,
            event: 'subscribe',
            payload: payload,
        };
        this.ws.send(JSON.stringify(msg));
        console.log(`[${this.marketIdentifier}] Enviada inscrição para ${payload.length} pares.`);
    }
    onClose() {
        console.warn(`[${this.marketIdentifier}] Conexão fechada. Tentando reconectar em 5s...`);
        this.isConnected = false;
        this.stopPinging();
        this.ws = null;
        if (this.reconnectTimeout)
            clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => this.connect(this.subscriptionQueue.map(p => p.replace('_', '/'))), 5000);
    }
    onError(error) {
        console.error(`[${this.marketIdentifier}] Erro no WebSocket:`, error.message);
        // O evento 'close' geralmente é disparado após um erro, cuidando da reconexão.
    }
    startPinging() {
        this.stopPinging();
        this.pingInterval = setInterval(() => {
            if (this.ws?.readyState === ws_1.default.OPEN) {
                const channel = this.marketType === 'spot' ? 'spot.ping' : 'futures.ping';
                this.ws.send(JSON.stringify({ time: Math.floor(Date.now() / 1000), channel }));
            }
        }, 20000);
    }
    stopPinging() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
}
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
exports.GateIoConnector = GateIoConnector;
