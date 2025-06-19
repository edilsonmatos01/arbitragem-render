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
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
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
var GateIoConnector = (function () {
    function GateIoConnector(identifier, priceUpdateCallback) {
        this.ws = null;
        this.subscriptionQueue = [];
        this.isConnected = false;
        this.pingInterval = null;
        this.reconnectTimeout = null;
        this.marketIdentifier = identifier;
        this.marketType = identifier.includes('_SPOT') ? 'spot' : 'futures';
        this.priceUpdateCallback = priceUpdateCallback;
        console.log("[".concat(this.marketIdentifier, "] Conector inicializado."));
    }
    GateIoConnector.prototype.getTradablePairs = function () {
        return __awaiter(this, void 0, void 0, function () {
            var endpoint, response, data, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        endpoint = this.marketType === 'spot'
                            ? 'https://api.gateio.ws/api/v4/spot/currency_pairs'
                            : 'https://api.gateio.ws/api/v4/futures/usdt/contracts';
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        console.log("[".concat(this.marketIdentifier, "] Buscando pares negoci\u00E1veis de ").concat(endpoint));
                        return [4, (0, node_fetch_1.default)(endpoint)];
                    case 2:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error("Falha na API: ".concat(response.statusText));
                        }
                        return [4, response.json()];
                    case 3:
                        data = _a.sent();
                        if (!Array.isArray(data)) {
                            console.warn("[".concat(this.marketIdentifier, "] A resposta da API n\u00E3o foi uma lista (poss\u00EDvel geoblocking)."));
                            return [2, []];
                        }
                        if (this.marketType === 'spot') {
                            return [2, data
                                    .filter(function (p) { return p.trade_status === 'tradable' && p.quote === 'USDT'; })
                                    .map(function (p) { return p.id.replace('_', '/'); })];
                        }
                        else {
                            return [2, data
                                    .filter(function (c) { return c.in_delisting === false; })
                                    .map(function (c) { return c.name.replace('_', '/'); })];
                        }
                        return [3, 5];
                    case 4:
                        error_1 = _a.sent();
                        console.error("[".concat(this.marketIdentifier, "] Erro ao buscar pares negoci\u00E1veis:"), error_1);
                        return [2, []];
                    case 5: return [2];
                }
            });
        });
    };
    GateIoConnector.prototype.connect = function (pairs) {
        this.subscriptionQueue = pairs.map(function (p) { return p.replace('/', '_'); });
        if (this.ws) {
            this.ws.close();
        }
        console.log("[".concat(this.marketIdentifier, "] Conectando a ").concat(GATEIO_WS_URL));
        this.ws = new ws_1.default(GATEIO_WS_URL);
        this.ws.on('open', this.onOpen.bind(this));
        this.ws.on('message', this.onMessage.bind(this));
        this.ws.on('close', this.onClose.bind(this));
        this.ws.on('error', this.onError.bind(this));
    };
    GateIoConnector.prototype.onOpen = function () {
        console.log("[".concat(this.marketIdentifier, "] Conex\u00E3o WebSocket estabelecida."));
        this.isConnected = true;
        this.startPinging();
        this.processSubscriptionQueue();
    };
    GateIoConnector.prototype.onMessage = function (data) {
        try {
            var message = JSON.parse(data.toString());
            if (message.channel === 'spot.ping' || message.channel === 'futures.ping') {
                return;
            }
            if (message.event === 'update' && message.result) {
                this.handleTickerUpdate(message.result);
            }
        }
        catch (error) {
            console.error("[".concat(this.marketIdentifier, "] Erro ao processar mensagem:"), error);
        }
    };
    GateIoConnector.prototype.handleTickerUpdate = function (ticker) {
        var pair = (ticker.currency_pair || ticker.contract).replace('_', '/');
        var priceData = {
            bestAsk: parseFloat(ticker.lowest_ask || ticker.ask1),
            bestBid: parseFloat(ticker.highest_bid || ticker.bid1),
        };
        if (!priceData.bestAsk || !priceData.bestBid)
            return;
        this.priceUpdateCallback({
            identifier: this.marketIdentifier,
            symbol: pair,
            marketType: this.marketType,
            bestAsk: priceData.bestAsk,
            bestBid: priceData.bestBid,
        });
    };
    GateIoConnector.prototype.processSubscriptionQueue = function () {
        if (!this.ws || this.ws.readyState !== ws_1.default.OPEN || this.subscriptionQueue.length === 0) {
            return;
        }
        var channel = this.marketType === 'spot' ? 'spot.tickers' : 'futures.tickers';
        var payload = this.subscriptionQueue;
        this.subscriptionQueue = [];
        var msg = {
            time: Math.floor(Date.now() / 1000),
            channel: channel,
            event: 'subscribe',
            payload: payload,
        };
        this.ws.send(JSON.stringify(msg));
        console.log("[".concat(this.marketIdentifier, "] Enviada inscri\u00E7\u00E3o para ").concat(payload.length, " pares."));
    };
    GateIoConnector.prototype.onClose = function () {
        var _this = this;
        console.warn("[".concat(this.marketIdentifier, "] Conex\u00E3o fechada. Tentando reconectar em 5s..."));
        this.isConnected = false;
        this.stopPinging();
        this.ws = null;
        if (this.reconnectTimeout)
            clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(function () { return _this.connect(_this.subscriptionQueue.map(function (p) { return p.replace('_', '/'); })); }, 5000);
    };
    GateIoConnector.prototype.onError = function (error) {
        console.error("[".concat(this.marketIdentifier, "] Erro no WebSocket:"), error.message);
    };
    GateIoConnector.prototype.startPinging = function () {
        var _this = this;
        this.stopPinging();
        this.pingInterval = setInterval(function () {
            var _a;
            if (((_a = _this.ws) === null || _a === void 0 ? void 0 : _a.readyState) === ws_1.default.OPEN) {
                var channel = _this.marketType === 'spot' ? 'spot.ping' : 'futures.ping';
                _this.ws.send(JSON.stringify({ time: Math.floor(Date.now() / 1000), channel: channel }));
            }
        }, 20000);
    };
    GateIoConnector.prototype.stopPinging = function () {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    };
    return GateIoConnector;
}());
exports.GateIoConnector = GateIoConnector;
