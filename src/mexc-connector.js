"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MexcConnector = void 0;
var ws_1 = require("ws");
var MEXC_FUTURES_WS_URL = 'wss://contract.mexc.com/edge';
var MexcConnector = /** @class */ (function () {
    function MexcConnector(identifier, onPriceUpdate, onConnected) {
        this.ws = null;
        this.subscriptions = new Set();
        this.pingInterval = null;
        this.isConnected = false;
        this.marketIdentifier = identifier;
        this.onPriceUpdate = onPriceUpdate;
        this.onConnectedCallback = onConnected;
        console.log("[".concat(this.marketIdentifier, "] Conector instanciado."));
    }
    MexcConnector.prototype.connect = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (_this.ws) {
                console.log("[".concat(_this.marketIdentifier, "] Conex\u00E3o j\u00E1 existe. Fechando a antiga..."));
                _this.ws.close();
            }
            console.log("[".concat(_this.marketIdentifier, "] Conectando a ").concat(MEXC_FUTURES_WS_URL));
            _this.ws = new ws_1.default(MEXC_FUTURES_WS_URL);
            _this.ws.once('open', function () {
                _this.onOpen();
                resolve();
            });
            _this.ws.once('error', function (error) {
                reject(error);
            });
            _this.ws.on('message', function (data) { return _this.onMessage(data); });
            _this.ws.on('close', function (code, reason) { return _this.onClose(code, reason); });
        });
    };
    MexcConnector.prototype.subscribe = function (symbols) {
        var _this = this;
        symbols.forEach(function (symbol) {
            _this.subscriptions.add(symbol);
            if (_this.isConnected) {
                _this.sendSubscriptionRequest(symbol);
            }
        });
    };
    MexcConnector.prototype.sendSubscriptionRequest = function (symbol) {
        var ws = this.ws;
        if (!ws)
            return;
        var subscriptionMessage = {
            method: 'sub.ticker',
            param: { symbol: symbol.replace('/', '_') }
        };
        console.log("[".concat(this.marketIdentifier, "] Inscrevendo-se em: ").concat(symbol));
        ws.send(JSON.stringify(subscriptionMessage));
    };
    MexcConnector.prototype.onOpen = function () {
        var _this = this;
        console.log("[".concat(this.marketIdentifier, "] Conex\u00E3o WebSocket estabelecida."));
        this.isConnected = true;
        this.startPing();
        // Inscreve-se em todos os pares registrados
        this.subscriptions.forEach(function (symbol) {
            _this.sendSubscriptionRequest(symbol);
        });
        if (this.onConnectedCallback) {
            this.onConnectedCallback();
        }
    };
    MexcConnector.prototype.onMessage = function (data) {
        var ws = this.ws;
        if (!ws)
            return;
        try {
            var message = JSON.parse(data.toString());
            // Resposta ao ping do servidor
            if (message.method === 'ping') {
                ws.send(JSON.stringify({ method: 'pong' }));
                return;
            }
            // Confirmação de inscrição
            if (message.channel === 'rs.sub.ticker') {
                console.log("[".concat(this.marketIdentifier, "] Inscri\u00E7\u00E3o confirmada para: ").concat(message.data));
                return;
            }
            // Processamento de dados do ticker
            if (message.channel === 'push.ticker' && message.data) {
                var ticker = message.data;
                var symbol = ticker.symbol.replace('_', '/');
                var bestAsk = parseFloat(ticker.ask1);
                var bestBid = parseFloat(ticker.bid1);
                this.onPriceUpdate({
                    type: 'price-update',
                    symbol: symbol,
                    marketType: 'futures',
                    bestAsk: bestAsk,
                    bestBid: bestBid,
                    identifier: this.marketIdentifier
                });
            }
        }
        catch (error) {
            console.error("[".concat(this.marketIdentifier, "] Erro ao processar mensagem:"), error);
        }
    };
    MexcConnector.prototype.startPing = function () {
        var _this = this;
        this.stopPing();
        this.pingInterval = setInterval(function () {
            var ws = _this.ws;
            if ((ws === null || ws === void 0 ? void 0 : ws.readyState) === ws_1.default.OPEN) {
                ws.send(JSON.stringify({ method: "ping" }));
            }
        }, 20 * 1000);
    };
    MexcConnector.prototype.stopPing = function () {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    };
    MexcConnector.prototype.onClose = function (code, reason) {
        var _this = this;
        console.warn("[".concat(this.marketIdentifier, "] Conex\u00E3o fechada. C\u00F3digo: ").concat(code, ". Reconectando em 5s..."));
        this.isConnected = false;
        this.stopPing();
        setTimeout(function () { return _this.connect(); }, 5000);
    };
    MexcConnector.prototype.onError = function (error) {
        console.error("[".concat(this.marketIdentifier, "] Erro no WebSocket:"), error.message);
    };
    return MexcConnector;
}());
exports.MexcConnector = MexcConnector;
