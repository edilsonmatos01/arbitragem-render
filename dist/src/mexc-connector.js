"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MexcConnector = void 0;
const WebSocket = require('ws');
const node_fetch_1 = __importDefault(require("node-fetch"));
const events_1 = require("events");
class MexcConnector extends events_1.EventEmitter {
    constructor(identifier, onPriceUpdate, onConnect) {
        super();
        this.ws = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.baseReconnectDelay = 5000;
        this.maxReconnectDelay = 300000;
        this.WS_URL = 'wss://wbs.mexc.com/ws';
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
        this.identifier = identifier;
        this.onPriceUpdate = onPriceUpdate;
        this.onConnect = onConnect;
        console.log(`[${this.identifier}] Conector instanciado.`);
    }
    async connect() {
        if (this.isConnecting) {
            console.log(`[${this.identifier}] Já existe uma tentativa de conexão em andamento`);
            return;
        }
        try {
            this.isConnecting = true;
            this.connectionStartTime = Date.now();
            await this.cleanup();
            console.log(`\n[${this.identifier}] Iniciando conexão WebSocket...`);
            this.ws = new WebSocket(this.WS_URL);
            if (!this.ws) {
                throw new Error('Falha ao criar WebSocket');
            }
            this.ws.on('open', () => {
                console.log(`[${this.identifier}] WebSocket conectado`);
                this.isConnected = true;
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                this.lastPongTime = Date.now();
                this.startHeartbeat();
                if (this.subscribedSymbols.size > 0) {
                    this.resubscribeAll();
                }
                this.onConnect();
                this.stopRestFallback();
            });
            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    console.log(`\n[${this.identifier}] Mensagem recebida:`, message);
                    if (message.method === 'PONG') {
                        console.log(`[${this.identifier}] Pong recebido`);
                        return;
                    }
                    if (message.stream && message.stream.endsWith('@bookTicker')) {
                        const { s: symbol, a: ask, b: bid } = message.data;
                        if (ask && bid) {
                            this.onPriceUpdate({
                                type: 'price-update',
                                symbol: symbol.replace('_', '/'),
                                marketType: 'spot',
                                bestAsk: parseFloat(ask),
                                bestBid: parseFloat(bid),
                                identifier: this.identifier
                            });
                        }
                    }
                }
                catch (error) {
                    console.error(`[${this.identifier}] Erro ao processar mensagem:`, error);
                }
            });
            this.ws.on('close', (code, reason) => {
                console.log(`[${this.identifier}] WebSocket fechado. Código: ${code}, Razão: ${reason}`);
                this.handleDisconnect();
            });
            this.ws.on('error', (error) => {
                console.error(`[${this.identifier}] Erro na conexão WebSocket:`, error);
                this.handleDisconnect();
            });
            setTimeout(() => {
                if (!this.isConnected) {
                    this.handleDisconnect();
                }
            }, 10000);
        }
        catch (error) {
            console.error(`[${this.identifier}] Erro ao conectar:`, error);
            this.handleDisconnect();
        }
    }
    async cleanup() {
        this.stopHeartbeat();
        if (this.ws) {
            try {
                this.ws.removeAllListeners();
                if (this.ws.readyState === WebSocket.OPEN) {
                    this.ws.close();
                }
                this.ws = null;
            }
            catch (error) {
                console.error(`[${this.identifier}] Erro ao limpar conexão:`, error);
            }
        }
        this.isConnected = false;
    }
    handleDisconnect() {
        console.log(`[${this.identifier}] Desconectado: Conexão fechada pelo servidor`);
        this.cleanup().then(() => {
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                console.log(`[${this.identifier}] Tentando reconectar em ${this.reconnectDelay}ms...`);
                setTimeout(() => this.connect(), this.reconnectDelay);
                this.reconnectAttempts++;
            }
            else {
                console.error(`[${this.identifier}] Número máximo de tentativas de reconexão atingido`);
            }
        });
    }
    scheduleReconnect() {
        if (this.isBlocked) {
            return;
        }
        const delay = Math.min(this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
        this.reconnectAttempts++;
        console.log(`[${this.identifier}] Tentativa de reconexão ${this.reconnectAttempts} em ${delay / 1000}s`);
        if (Date.now() - this.connectionStartTime > 300000) {
            console.log(`[${this.identifier}] WebSocket não reconectou após múltiplas tentativas. Verifique a conexão.`);
        }
        setTimeout(() => this.connect(), delay);
    }
    startHeartbeat() {
        this.stopHeartbeat();
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                const pingMessage = { "method": "PING" };
                this.ws.send(JSON.stringify(pingMessage));
                console.log(`[${this.identifier}] Ping enviado`);
            }
            catch (error) {
                console.error(`[${this.identifier}] Erro ao enviar ping:`, error);
                this.handleDisconnect();
            }
        }
    }
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
        }
    }
    updateLastPongTime() {
        this.lastPongTime = Date.now();
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
        }
    }
    startRestFallback() {
        if (this.fallbackRestInterval)
            return;
        console.log(`[${this.identifier}] Iniciando fallback para REST API`);
        this.fallbackRestInterval = setInterval(async () => {
            try {
                for (const symbol of this.subscribedSymbols) {
                    const formattedSymbol = symbol.replace('/', '');
                    const response = await (0, node_fetch_1.default)(`${this.REST_URL}/ticker/price?symbol=${formattedSymbol}`);
                    const data = await response.json();
                    if (data.price) {
                        const price = parseFloat(data.price);
                        this.onPriceUpdate({
                            type: 'price-update',
                            symbol: symbol,
                            marketType: 'spot',
                            bestAsk: price,
                            bestBid: price,
                            identifier: this.identifier
                        });
                    }
                }
            }
            catch (error) {
                console.error(`[${this.identifier}] Erro ao buscar preços via REST:`, error);
            }
        }, this.REST_FALLBACK_INTERVAL);
    }
    stopRestFallback() {
        if (this.fallbackRestInterval) {
            clearInterval(this.fallbackRestInterval);
            this.fallbackRestInterval = null;
        }
    }
    resubscribeAll() {
        const symbols = Array.from(this.subscribedSymbols);
        if (symbols.length > 0) {
            console.log(`[${this.identifier}] Reinscrevendo em ${symbols.length} pares...`);
            this.subscribe(symbols);
        }
    }
    async subscribe(symbols) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log(`[${this.identifier}] WebSocket não está conectado. Tentando reconectar...`);
            await this.connect();
            return;
        }
        for (const symbol of symbols) {
            try {
                const subscriptionMessage = {
                    method: "SUBSCRIPTION",
                    params: [
                        `${symbol.replace('/', '').toLowerCase()}@bookTicker`
                    ]
                };
                console.log(`[${this.identifier}] Inscrevendo-se em ${symbol}:`, subscriptionMessage);
                this.ws.send(JSON.stringify(subscriptionMessage));
            }
            catch (error) {
                console.error(`[${this.identifier}] Erro ao se inscrever em ${symbol}:`, error);
            }
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