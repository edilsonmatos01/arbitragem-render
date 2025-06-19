"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MexcConnector = void 0;
var ws_1 = __importDefault(require("ws"));
var MEXC_FUTURES_WS_URL = 'wss://contract.mexc.com/edge';
var MexcConnector = (function () {
    function MexcConnector(identifier, priceUpdateCallback, onConnected) {
        this.ws = null;
        this.subscriptions = new Set();
        this.pingInterval = null;
        this.isConnected = false;
        this.marketIdentifier = identifier;
        this.priceUpdateCallback = priceUpdateCallback;
        this.onConnectedCallback = onConnected;
        console.log("[".concat(this.marketIdentifier, "] Conector instanciado."));
    }
    MexcConnector.prototype.connect = function () {
        if (this.ws) {
            this.ws.close();
        }
        console.log("[".concat(this.marketIdentifier, "] Conectando a ").concat(MEXC_FUTURES_WS_URL));
        this.ws = new ws_1.default(MEXC_FUTURES_WS_URL);
        this.ws.on('open', this.onOpen.bind(this));
        this.ws.on('message', this.onMessage.bind(this));
        this.ws.on('close', this.onClose.bind(this));
        this.ws.on('error', this.onError.bind(this));
    };
    MexcConnector.prototype.subscribe = function (symbols) {
        var _this = this;
        symbols.forEach(function (symbol) { return _this.subscriptions.add(symbol); });
        if (this.isConnected) {
            this.sendSubscriptionRequests(Array.from(this.subscriptions));
        }
    };
    MexcConnector.prototype.onOpen = function () {
        console.log("[".concat(this.marketIdentifier, "] Conex\u00E3o WebSocket estabelecida."));
        this.isConnected = true;
        this.startPing();
        if (this.subscriptions.size > 0) {
            this.sendSubscriptionRequests(Array.from(this.subscriptions));
        }
        if (this.onConnectedCallback) {
            this.onConnectedCallback();
            this.onConnectedCallback = null;
        }
    };
    MexcConnector.prototype.sendSubscriptionRequests = function (symbols) {
        var ws = this.ws;
        if (!ws)
            return;
        symbols.forEach(function (symbol) {
            var msg = { method: 'sub.ticker', param: { symbol: symbol.replace('/', '_') } };
            ws.send(JSON.stringify(msg));
        });
    };
    MexcConnector.prototype.onMessage = function (data) {
        try {
            var message = JSON.parse(data.toString());
            if (message.channel === 'push.ticker' && message.data) {
                var ticker = message.data;
                var pair = ticker.symbol.replace('_', '/');
                var priceData = {
                    bestAsk: parseFloat(ticker.ask1),
                    bestBid: parseFloat(ticker.bid1),
                };
                if (!priceData.bestAsk || !priceData.bestBid)
                    return;
                this.priceUpdateCallback({
                    identifier: this.marketIdentifier,
                    symbol: pair,
                    marketType: 'futures',
                    bestAsk: priceData.bestAsk,
                    bestBid: priceData.bestBid,
                });
            }
        }
        catch (error) {
            console.error("[".concat(this.marketIdentifier, "] Erro ao processar mensagem:"), error);
        }
    };
    MexcConnector.prototype.onClose = function () {
        var _this = this;
        console.warn("[".concat(this.marketIdentifier, "] Conex\u00E3o fechada. Reconectando..."));
        this.isConnected = false;
        this.stopPing();
        setTimeout(function () { return _this.connect(); }, 5000);
    };
    MexcConnector.prototype.onError = function (error) {
        var _a;
        console.error("[".concat(this.marketIdentifier, "] Erro no WebSocket:"), error.message);
        (_a = this.ws) === null || _a === void 0 ? void 0 : _a.close();
    };
    MexcConnector.prototype.startPing = function () {
        var _this = this;
        this.stopPing();
        this.pingInterval = setInterval(function () {
            var _a;
            if (((_a = _this.ws) === null || _a === void 0 ? void 0 : _a.readyState) === ws_1.default.OPEN) {
                _this.ws.send(JSON.stringify({ method: "ping" }));
            }
        }, 20000);
    };
    MexcConnector.prototype.stopPing = function () {
        if (this.pingInterval)
            clearInterval(this.pingInterval);
    };
    return MexcConnector;
}());
exports.MexcConnector = MexcConnector;
