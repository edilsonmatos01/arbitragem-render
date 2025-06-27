"use strict";
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
    constructor(identifier, onPriceUpdate, onConnect) {
        this.ws = null;
        this.subscriptionQueue = [];
        this.isConnected = false;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.baseReconnectDelay = 5000;
        this.maxReconnectDelay = 300000;
        this.heartbeatInterval = null;
        this.HEARTBEAT_INTERVAL = 20000;
        this.identifier = identifier;
        this.marketType = identifier.includes('_SPOT') ? 'spot' : 'futures';
        this.onPriceUpdate = onPriceUpdate;
        this.onConnect = onConnect;
        console.log(`[${this.identifier}] Conector inicializado.`);
    }
    async getTradablePairs() {
        const endpoint = this.marketType === 'spot'
            ? 'https://api.gateio.ws/api/v4/spot/currency_pairs'
            : 'https://api.gateio.ws/api/v4/futures/usdt/contracts';
        try {
            console.log(`[${this.identifier}] Buscando pares negociáveis de ${endpoint}`);
            const response = await (0, node_fetch_1.default)(endpoint);
            if (!response.ok) {
                throw new Error(`Falha na API: ${response.statusText}`);
            }
            const data = await response.json();
            if (!Array.isArray(data)) {
                console.warn(`[${this.identifier}] A resposta da API não foi uma lista (possível geoblocking).`);
                return [];
            }
            if (this.marketType === 'spot') {
                return data
                    .filter((p) => p.trade_status === 'tradable' && p.quote === 'USDT')
                    .map((p) => p.id.replace('_', '/'));
            }
            else {
                return data
                    .filter((c) => c.in_delisting === false)
                    .map((c) => c.name.replace('_', '/'));
            }
        }
        catch (error) {
            console.error(`[${this.identifier}] Erro ao buscar pares negociáveis:`, error);
            return [];
        }
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
        console.log(`[${this.identifier}] Conectando a ${GATEIO_WS_URL}`);
        try {
            this.ws = new ws_1.default(GATEIO_WS_URL);
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
        if (!symbols || symbols.length === 0) {
            console.warn(`[${this.identifier}] Lista de pares vazia ou inválida`);
            return;
        }
        this.subscriptionQueue = symbols.map(p => p.replace('/', '_'));
        if (this.isConnected && this.ws) {
            this.sendSubscriptions();
        }
    }
    sendSubscriptions() {
        if (!this.ws || !this.isConnected)
            return;
        const channel = this.marketType === 'spot' ? 'spot.book_ticker' : 'futures.book_ticker';
        this.subscriptionQueue.forEach(symbol => {
            var _a;
            const subscription = {
                time: Math.floor(Date.now() / 1000),
                channel,
                event: 'subscribe',
                payload: [symbol]
            };
            (_a = this.ws) === null || _a === void 0 ? void 0 : _a.send(JSON.stringify(subscription));
            console.log(`[${this.identifier}] Inscrito em ${symbol}`);
        });
    }
    onOpen() {
        console.log(`[${this.identifier}] Conexão estabelecida`);
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        if (this.subscriptionQueue.length > 0) {
            this.sendSubscriptions();
        }
        this.onConnect();
    }
    onMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            if (message.event === 'update' && (message.channel === 'spot.book_ticker' || message.channel === 'futures.book_ticker')) {
                const ticker = message.result;
                const symbol = ticker.s || ticker.currency_pair;
                const pair = symbol.replace('_', '/');
                const bestAsk = parseFloat(ticker.a || ticker.ask);
                const bestBid = parseFloat(ticker.b || ticker.bid);
                if (!bestAsk || !bestBid)
                    return;
                this.onPriceUpdate({
                    identifier: this.identifier,
                    symbol: pair,
                    marketType: this.marketType,
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
exports.GateIoConnector = GateIoConnector;
//# sourceMappingURL=gateio-connector.js.map