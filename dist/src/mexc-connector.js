"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MexcConnector = void 0;
const ws_1 = __importDefault(require("ws"));
const MEXC_FUTURES_WS_URL = 'wss://contract.mexc.com/edge';
class MexcConnector {
    constructor(identifier, marketPrices, onConnected) {
        this.ws = null;
        this.subscriptions = new Set();
        this.pingInterval = null;
        this.isConnected = false;
        this.marketIdentifier = identifier;
        this.marketPrices = marketPrices;
        this.onConnectedCallback = onConnected;
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
                if (!this.marketPrices[this.marketIdentifier]) {
                    this.marketPrices[this.marketIdentifier] = {};
                }
                this.marketPrices[this.marketIdentifier][pair] = {
                    bestAsk: parseFloat(ticker.ask1),
                    bestBid: parseFloat(ticker.bid1),
                    timestamp: ticker.timestamp,
                };
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
        console.error(`[${this.marketIdentifier}] Erro no WebSocket:`, error.message);
        this.ws?.close();
    }
    startPing() {
        this.stopPing();
        this.pingInterval = setInterval(() => {
            if (this.ws?.readyState === ws_1.default.OPEN) {
                this.ws.send(JSON.stringify({ method: "ping" }));
            }
        }, 20000);
    }
    stopPing() {
        if (this.pingInterval)
            clearInterval(this.pingInterval);
    }
}
exports.MexcConnector = MexcConnector;
