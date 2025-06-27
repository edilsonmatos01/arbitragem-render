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
    constructor(identifier, onPriceUpdate, onConnect) {
        super();
        this.ws = null;
        this.subscriptions = new Set();
        this.isConnected = false;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000;
        this.baseReconnectDelay = 5000;
        this.maxReconnectDelay = 300000;
        this.heartbeatInterval = null;
        this.HEARTBEAT_INTERVAL = 20000;
        this.WS_URL = 'wss://contract.mexc.com/ws';
        this.REST_URL = 'https://api.mexc.com/api/v3/exchangeInfo';
        this.heartbeatTimeout = null;
        this.subscribedSymbols = new Set();
        this.fallbackRestInterval = null;
        this.connectionStartTime = 0;
        this.lastPongTime = 0;
        this.HEARTBEAT_TIMEOUT = 10000;
        this.REST_FALLBACK_INTERVAL = 30000;
        this.isBlocked = false;
        this.identifier = identifier;
        this.onPriceUpdate = onPriceUpdate;
        this.onConnect = onConnect;
        console.log(`[${this.identifier}] Conector instanciado.`);
    }
    connect() {
        if (this.isConnecting) {
            console.log(`[${this.identifier}] Conexão já em andamento.`);
            return;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnecting = true;
        console.log(`[${this.identifier}] Conectando a ${MEXC_FUTURES_WS_URL}`);
        try {
            this.ws = new ws_1.default(MEXC_FUTURES_WS_URL);
            this.ws.isAlive = true;
            this.ws.on('open', this.onOpen.bind(this));
            this.ws.on('message', this.onMessage.bind(this));
            this.ws.on('close', this.onClose.bind(this));
            this.ws.on('error', this.onError.bind(this));
            this.ws.on('pong', this.onPong.bind(this));
        }
        catch (error) {
            console.error(`[${this.identifier}] Erro ao criar WebSocket:`, error);
            this.handleDisconnect();
        }
    }
    subscribe(symbols) {
        symbols.forEach(symbol => this.subscriptions.add(symbol));
        if (this.isConnected && this.ws) {
            this.sendSubscriptionRequests(Array.from(this.subscriptions));
        }
    }
    async getTradablePairs() {
        try {
            const response = await (0, node_fetch_1.default)('https://api.mexc.com/api/v3/exchangeInfo');
            const data = await response.json();
            if (!Array.isArray(data.symbols)) {
                throw new Error('Formato de resposta inválido');
            }
            return data.symbols
                .filter((s) => s.status === 'ENABLED' && s.quoteAsset === 'USDT')
                .map((s) => `${s.baseAsset}/${s.quoteAsset}`);
        }
        catch (error) {
            console.error(`[${this.identifier}] Erro ao buscar pares negociáveis:`, error);
            return [];
        }
    }
    sendSubscriptionRequests(symbols) {
        if (!this.ws || !this.isConnected)
            return;
        symbols.forEach(symbol => {
            var _a;
            const msg = {
                method: 'sub.ticker',
                param: { symbol: symbol.replace('/', '_') }
            };
            (_a = this.ws) === null || _a === void 0 ? void 0 : _a.send(JSON.stringify(msg));
            console.log(`[${this.identifier}] Inscrito em ${symbol}`);
        });
    }
    onOpen() {
        console.log(`[${this.identifier}] Conexão estabelecida`);
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        if (this.subscriptions.size > 0) {
            this.sendSubscriptionRequests(Array.from(this.subscriptions));
        }
        this.onConnect();
    }
    onMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            if (message.channel === 'push.ticker' && message.data) {
                const ticker = message.data;
                const pair = ticker.symbol.replace('_', '/');
                const bestAsk = parseFloat(ticker.ask1);
                const bestBid = parseFloat(ticker.bid1);
                if (!bestAsk || !bestBid)
                    return;
                this.onPriceUpdate({
                    identifier: this.identifier,
                    symbol: pair,
                    marketType: 'futures',
                    bestAsk,
                    bestBid
                });
            }
        }
        catch (error) {
            console.error(`[${this.identifier}] Erro ao processar mensagem:`, error);
        }
    }
    onClose() {
        console.log(`[${this.identifier}] Conexão fechada`);
        this.cleanup();
        this.handleDisconnect();
    }
    onError(error) {
        console.error(`[${this.identifier}] Erro na conexão:`, error);
        this.cleanup();
        this.handleDisconnect();
    }
    onPong() {
        if (this.ws) {
            this.ws.isAlive = true;
        }
    }
    startHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        this.heartbeatInterval = setInterval(() => {
            if (!this.ws)
                return;
            if (this.ws.isAlive === false) {
                console.log(`[${this.identifier}] Heartbeat falhou, reconectando...`);
                this.ws.terminate();
                return;
            }
            this.ws.isAlive = false;
            this.ws.ping();
        }, this.HEARTBEAT_INTERVAL);
    }
    cleanup() {
        this.isConnected = false;
        this.isConnecting = false;
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.ws) {
            this.ws.removeAllListeners();
            this.ws = null;
        }
    }
    handleDisconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error(`[${this.identifier}] Máximo de tentativas de reconexão atingido`);
            return;
        }
        const delay = Math.min(this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
        console.log(`[${this.identifier}] Tentando reconectar em ${delay / 1000} segundos...`);
        setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
        }, delay);
    }
    disconnect() {
        console.log(`[${this.identifier}] Desconectando...`);
        this.cleanup();
    }
}
exports.MexcConnector = MexcConnector;
//# sourceMappingURL=mexc-connector.js.map