"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MexcConnector = void 0;
const ws_1 = __importDefault(require("ws"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const events_1 = require("events");
const MEXC_SPOT_WS_URL = 'wss://wbs.mexc.com/ws';
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
            console.log(`[${this.marketIdentifier}] Fechando conexão existente...`);
            this.ws.close();
        }
        console.log(`[${this.marketIdentifier}] Conectando a ${MEXC_SPOT_WS_URL}`);
        this.ws = new ws_1.default(MEXC_SPOT_WS_URL, {
            handshakeTimeout: 30000,
            timeout: 30000,
            perMessageDeflate: false,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        this.ws.on('open', this.onOpen.bind(this));
        this.ws.on('message', this.onMessage.bind(this));
        this.ws.on('close', this.onClose.bind(this));
        this.ws.on('error', this.onError.bind(this));
        this.ws.on('upgrade', (response) => {
            console.log(`[${this.marketIdentifier}] Conexão WebSocket atualizada. Status:`, response.statusCode);
        });
    }
    subscribe(symbols) {
        console.log(`[${this.marketIdentifier}] Inscrevendo nos símbolos:`, symbols);
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
            const formattedSymbol = symbol.replace('/', '').toLowerCase();
            const msg = { method: 'sub.ticker', param: { symbol: formattedSymbol } };
            console.log(`[${this.marketIdentifier}] Enviando subscrição:`, JSON.stringify(msg));
            ws.send(JSON.stringify(msg));
        });
    }
    onMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            console.log(`[${this.marketIdentifier}] Mensagem recebida:`, JSON.stringify(message));
            if (message.channel === 'push.ticker' && message.data) {
                const ticker = message.data;
                const pair = ticker.symbol.replace('_', '/').toUpperCase();
                const priceData = {
                    bestAsk: parseFloat(ticker.ask),
                    bestBid: parseFloat(ticker.bid),
                };
                if (!priceData.bestAsk || !priceData.bestBid) {
                    console.log(`[${this.marketIdentifier}] Preços inválidos recebidos:`, ticker);
                    return;
                }
                console.log(`[${this.marketIdentifier}] Atualização de preço para ${pair}:`, priceData);
                this.priceUpdateCallback({
                    identifier: this.marketIdentifier,
                    symbol: pair,
                    marketType: 'spot',
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
        console.warn(`[${this.marketIdentifier}] Conexão fechada. Reconectando em 5 segundos...`);
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
                const pingMsg = { method: "ping" };
                console.log(`[${this.marketIdentifier}] Enviando ping:`, JSON.stringify(pingMsg));
                this.ws.send(JSON.stringify(pingMsg));
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
