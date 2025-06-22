"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MexcConnector = void 0;
const ws_1 = __importDefault(require("ws"));
<<<<<<< HEAD
const node_fetch_1 = __importDefault(require("node-fetch"));
const events_1 = require("events");
const MEXC_FUTURES_WS_URL = 'wss://contract.mexc.com/edge';
class MexcConnector extends events_1.EventEmitter {
    constructor(identifier, priceUpdateCallback, onConnected) {
        super();
=======
const MEXC_FUTURES_WS_URL = 'wss://contract.mexc.com/edge';
class MexcConnector {
    constructor(identifier, priceUpdateCallback, onConnected) {
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
        this.ws = null;
        this.subscriptions = new Set();
        this.pingInterval = null;
        this.isConnected = false;
<<<<<<< HEAD
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.baseReconnectDelay = 5000;
        this.maxReconnectDelay = 300000;
        this.WS_URL = 'wss://contract.mexc.com/ws';
        this.REST_URL = 'https://api.mexc.com/api/v3/exchangeInfo';
        this.heartbeatInterval = null;
        this.heartbeatTimeout = null;
        this.subscribedSymbols = new Set();
        this.fallbackRestInterval = null;
        this.connectionStartTime = 0;
        this.lastPongTime = 0;
        this.HEARTBEAT_INTERVAL = 20000;
        this.HEARTBEAT_TIMEOUT = 10000;
        this.REST_FALLBACK_INTERVAL = 30000;
        this.isBlocked = false;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000;
        this.marketIdentifier = identifier;
        this.priceUpdateCallback = priceUpdateCallback;
        this.onConnectedCallback = onConnected;
        this.identifier = identifier;
        this.onPriceUpdate = priceUpdateCallback;
        this.onConnect = onConnected;
=======
        this.marketIdentifier = identifier;
        this.priceUpdateCallback = priceUpdateCallback;
        this.onConnectedCallback = onConnected;
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
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
<<<<<<< HEAD
=======
                // Chama o callback centralizado no servidor
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
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
<<<<<<< HEAD
        var _a;
        console.error(`[${this.marketIdentifier}] Erro no WebSocket:`, error.message);
        (_a = this.ws) === null || _a === void 0 ? void 0 : _a.close();
=======
        console.error(`[${this.marketIdentifier}] Erro no WebSocket:`, error.message);
        this.ws?.close();
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
    }
    startPing() {
        this.stopPing();
        this.pingInterval = setInterval(() => {
<<<<<<< HEAD
            var _a;
            if (((_a = this.ws) === null || _a === void 0 ? void 0 : _a.readyState) === ws_1.default.OPEN) {
=======
            if (this.ws?.readyState === ws_1.default.OPEN) {
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
                this.ws.send(JSON.stringify({ method: "ping" }));
            }
        }, 20000);
    }
    stopPing() {
        if (this.pingInterval)
            clearInterval(this.pingInterval);
    }
<<<<<<< HEAD
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
                    symbol.symbol.endsWith('USDT');
            })
                .map((symbol) => {
                const base = symbol.symbol.slice(0, -4);
                return `${base}/USDT`;
            });
            console.log(`[${this.identifier}] ${pairs.length} pares encontrados`);
            if (pairs.length > 0) {
                console.log('Primeiros 5 pares:', pairs.slice(0, 5));
            }
            return pairs;
        }
        catch (error) {
            console.error(`[${this.identifier}] Erro ao buscar pares:`, error);
            return [];
        }
    }
}
exports.MexcConnector = MexcConnector;
//# sourceMappingURL=mexc-connector.js.map
=======
}
exports.MexcConnector = MexcConnector;
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
