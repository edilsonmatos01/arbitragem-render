"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MexcConnector = void 0;
const ws_1 = __importDefault(require("ws"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const events_1 = require("events");
const MEXC_FUTURES_WS_URL = 'wss://contract.mexc.com/edge';
class MexcConnector extends events_1.EventEmitter {
    constructor(identifier, priceUpdateCallback, onConnected) {
        super();
        this.ws = null;
        this.subscriptions = new Set();
        this.pingInterval = null;
        this.isConnected = false;
        this.REST_URL = 'https://api.mexc.com/api/v3/exchangeInfo';
        this.marketIdentifier = identifier;
        this.priceUpdateCallback = priceUpdateCallback;
        this.onConnectedCallback = onConnected;
        this.identifier = identifier;
        console.log(`[${this.marketIdentifier}] Conector instanciado.`);
    }
    connect() {
        if (this.ws) {
            this.ws.close();
        }
        console.log(`[${this.marketIdentifier}] Conectando a ${MEXC_FUTURES_WS_URL}`);
        this.ws = new ws_1.default(MEXC_FUTURES_WS_URL);
        this.ws.on('open', this.onOpen.bind(this));
        this.ws.on('message', this.onMessage.bind(this));
        this.ws.on('close', this.onClose.bind(this));
        this.ws.on('error', this.onError.bind(this));
    }
    subscribe(symbols) {
        symbols.forEach(symbol => this.subscriptions.add(symbol));
        if (this.isConnected) {
            this.sendSubscriptionRequests(Array.from(this.subscriptions));
        }
    }
    onOpen() {
        console.log(`[${this.marketIdentifier}] Conexão WebSocket estabelecida.`);
        this.isConnected = true;
        this.startPing();
        if (this.subscriptions.size > 0) {
            this.sendSubscriptionRequests(Array.from(this.subscriptions));
        }
        if (this.onConnectedCallback) {
            this.onConnectedCallback();
            this.onConnectedCallback = null;
        }
    }
    sendSubscriptionRequests(symbols) {
        const ws = this.ws;
        if (!ws)
            return;
        symbols.forEach(symbol => {
            const msg = { method: 'sub.ticker', param: { symbol: symbol.replace('/', '_') } };
            ws.send(JSON.stringify(msg));
        });
    }
    onMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            if (message.channel === 'push.ticker' && message.data) {
                const ticker = message.data;
                const pair = ticker.symbol.replace('_', '/');
                const priceData = {
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
            console.error(`[${this.marketIdentifier}] Erro ao processar mensagem:`, error);
        }
    }
    onClose() {
        console.warn(`[${this.marketIdentifier}] Conexão fechada. Reconectando...`);
        this.isConnected = false;
        this.stopPing();
        setTimeout(() => this.connect(), 5000);
    }
    onError(error) {
        var _a;
        console.error(`[${this.marketIdentifier}] Erro no WebSocket:`, error.message);
        (_a = this.ws) === null || _a === void 0 ? void 0 : _a.close();
    }
    startPing() {
        this.stopPing();
        this.pingInterval = setInterval(() => {
            var _a;
            if (((_a = this.ws) === null || _a === void 0 ? void 0 : _a.readyState) === ws_1.default.OPEN) {
                this.ws.send(JSON.stringify({ method: "ping" }));
            }
        }, 20000);
    }
    stopPing() {
        if (this.pingInterval)
            clearInterval(this.pingInterval);
    }
    disconnect() {
        console.log(`[${this.marketIdentifier}] Desconectando...`);
        this.isConnected = false;
        this.stopPing();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
    async getTradablePairs() {
        try {
            console.log(`[${this.identifier}] Buscando pares negociáveis...`);
            const response = await (0, node_fetch_1.default)(this.REST_URL);
            const data = await response.json();
            console.log(`[${this.identifier}] Resposta da API:`, JSON.stringify(data).slice(0, 200) + '...');
            if (!data.symbols || !Array.isArray(data.symbols)) {
                console.error(`[${this.identifier}] Resposta inválida:`, data);
                return [];
            }
            const pairs = data.symbols
                .filter((symbol) => {
                return symbol.status === 'ENABLED' &&
                    symbol.quoteAsset === 'USDT' &&
                    symbol.baseAsset !== 'USDT';
            })
                .map((symbol) => `${symbol.baseAsset}/USDT`);
            console.log(`[${this.identifier}] Pares negociáveis encontrados:`, pairs.length);
            return pairs;
        }
        catch (error) {
            console.error(`[${this.identifier}] Erro ao buscar pares negociáveis:`, error);
            return [];
        }
    }
}
exports.MexcConnector = MexcConnector;
//# sourceMappingURL=mexc-connector.js.map