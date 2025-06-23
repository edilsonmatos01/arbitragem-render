"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GateIoConnector = void 0;
const ws_1 = __importDefault(require("ws"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const GATEIO_WS_URL = 'wss://api.gateio.ws/ws/v4/';
class GateIoConnector {
    constructor(identifier, priceUpdateCallback) {
        this.ws = null;
        this.subscriptionQueue = [];
        this.pingInterval = null;
        this.reconnectTimeout = null;
        this.marketIdentifier = identifier;
        this.marketType = identifier.includes('_SPOT') ? 'spot' : 'futures';
        this.priceUpdateCallback = priceUpdateCallback;
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
                    .map(p => p.id.replace('_', '/'));
            }
            else {
                return data
                    .filter(c => c.in_delisting === false)
                    .map(c => c.name.replace('_', '/'));
            }
        }
        catch (error) {
            console.error(`[${this.marketIdentifier}] Erro ao buscar pares negociáveis:`, error);
            return [];
        }
    }
    connect(pairs) {
        if (!pairs || pairs.length === 0) {
            console.warn(`[${this.marketIdentifier}] Lista de pares vazia ou inválida`);
            return;
        }
        this.subscriptionQueue = pairs.map(p => p.replace('/', '_'));
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
        this.startPinging();
        this.processSubscriptionQueue();
    }
    onMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            if (message.channel === 'spot.ping' || message.channel === 'futures.ping') {
                return;
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
    }
    processSubscriptionQueue() {
        if (!this.ws || this.ws.readyState !== ws_1.default.OPEN || this.subscriptionQueue.length === 0) {
            return;
        }
        const channel = this.marketType === 'spot' ? 'spot.tickers' : 'futures.tickers';
        const payload = this.subscriptionQueue;
        this.subscriptionQueue = [];
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
        this.stopPinging();
        this.ws = null;
        if (this.reconnectTimeout)
            clearTimeout(this.reconnectTimeout);
        if (this.subscriptionQueue && this.subscriptionQueue.length > 0) {
            this.reconnectTimeout = setTimeout(() => this.connect(this.subscriptionQueue.map(p => p.replace('_', '/'))), 5000);
        }
    }
    onError(error) {
        console.error(`[${this.marketIdentifier}] Erro no WebSocket:`, error.message);
    }
    startPinging() {
        this.stopPinging();
        this.pingInterval = setInterval(() => {
            var _a;
            if (((_a = this.ws) === null || _a === void 0 ? void 0 : _a.readyState) === ws_1.default.OPEN) {
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
    disconnect() {
        console.log(`[${this.marketIdentifier}] Desconectando...`);
        this.stopPinging();
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
exports.GateIoConnector = GateIoConnector;
//# sourceMappingURL=gateio-connector.js.map