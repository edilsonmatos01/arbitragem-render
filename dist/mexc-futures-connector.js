"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MexcFuturesConnector = void 0;
const WebSocket = require('ws');
const node_fetch_1 = __importDefault(require("node-fetch"));
class MexcFuturesConnector {
    constructor(identifier, onPriceUpdate, onConnect) {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 5000;
        this.WS_URL = 'wss://contract.mexc.com/edge';
        this.REST_URL = 'https://contract.mexc.com/api/v1/contract/detail';
        this.subscribedSymbols = new Set();
        this.heartbeatInterval = null;
        this.HEARTBEAT_INTERVAL = 20000;
        this.reconnectTimeout = null;
        this.identifier = identifier;
        this.onPriceUpdate = onPriceUpdate;
        this.onConnect = onConnect;
        console.log(`[${this.identifier}] Conector instanciado.`);
    }
    startHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        this.heartbeatInterval = setInterval(() => {
            if (this.ws && this.isConnected) {
                try {
                    const pingMessage = { "op": "ping" };
                    this.ws.send(JSON.stringify(pingMessage));
                    console.log(`[${this.identifier}] Ping enviado`);
                }
                catch (error) {
                    console.error(`[${this.identifier}] Erro ao enviar ping:`, error);
                    this.handleDisconnect('Erro ao enviar ping');
                }
            }
        }, this.HEARTBEAT_INTERVAL);
    }
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    async cleanup() {
        this.stopHeartbeat();
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.ws) {
            try {
                this.ws.removeAllListeners();
                if (this.ws.readyState === WebSocket.OPEN) {
                    this.ws.close();
                }
                else {
                    this.ws.terminate();
                }
                this.ws = null;
            }
            catch (error) {
                console.error(`[${this.identifier}] Erro ao limpar conexão:`, error);
            }
        }
        this.isConnected = false;
    }
    handleDisconnect(reason = 'Desconexão') {
        console.log(`[${this.identifier}] Desconectado: ${reason}`);
        this.cleanup().then(() => {
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                const delay = Math.min(this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts), 30000);
                console.log(`[${this.identifier}] Tentando reconectar em ${delay}ms... (Tentativa ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
                this.reconnectTimeout = setTimeout(() => {
                    this.connect().catch((error) => {
                        console.error(`[${this.identifier}] Erro na tentativa de reconexão:`, error);
                    });
                }, delay);
                this.reconnectAttempts++;
            }
            else {
                console.error(`[${this.identifier}] Número máximo de tentativas de reconexão atingido`);
            }
        });
    }
    async connect() {
        try {
            await this.cleanup();
            console.log(`\n[${this.identifier}] Iniciando conexão WebSocket...`);
            this.ws = new WebSocket(this.WS_URL, {
                handshakeTimeout: 10000,
                timeout: 10000
            });
            this.ws.on('open', () => {
                console.log(`[${this.identifier}] WebSocket conectado`);
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.startHeartbeat();
                this.resubscribeAll();
                this.onConnect();
            });
            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    console.log(`\n[${this.identifier}] Mensagem recebida:`, message);
                    if (message.op === 'pong') {
                        console.log(`[${this.identifier}] Pong recebido`);
                        return;
                    }
                    if (message.channel === 'push.ticker') {
                        const { symbol, bestAsk, bestBid } = message.data;
                        if (bestAsk && bestBid) {
                            this.onPriceUpdate({
                                type: 'price-update',
                                symbol: symbol.replace('_', '/'),
                                marketType: 'futures',
                                bestAsk: parseFloat(bestAsk),
                                bestBid: parseFloat(bestBid),
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
        }
        catch (error) {
            console.error(`[${this.identifier}] Erro ao conectar:`, error);
            this.handleDisconnect();
        }
    }
    async getTradablePairs() {
        try {
            console.log(`[${this.identifier}] Buscando pares negociáveis...`);
            const response = await (0, node_fetch_1.default)(this.REST_URL);
            const data = await response.json();
            console.log(`[${this.identifier}] Resposta da API:`, JSON.stringify(data).slice(0, 200) + '...');
            if (!Array.isArray(data)) {
                console.error(`[${this.identifier}] Resposta inválida:`, data);
                return [];
            }
            const pairs = data
                .filter((contract) => {
                return contract.state === 'ENABLED' &&
                    contract.symbol.endsWith('_USDT') &&
                    contract.symbol.includes('_') &&
                    contract.symbol.split('_').length === 2;
            })
                .map((contract) => contract.symbol.replace('_', '/'));
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
    subscribe(pairs) {
        if (!this.ws || !this.isConnected) {
            console.error(`[${this.identifier}] WebSocket não está conectado`);
            return;
        }
        try {
            console.log(`\n[${this.identifier}] Inscrevendo-se em ${pairs.length} pares`);
            const formattedPairs = pairs.map(pair => pair.replace('/', '_'));
            const subscribeMessage = {
                "op": "sub.ticker",
                "symbol": formattedPairs
            };
            this.ws.send(JSON.stringify(subscribeMessage));
            pairs.forEach(symbol => this.subscribedSymbols.add(symbol));
            console.log(`[${this.identifier}] Mensagem de inscrição enviada`);
            console.log('Primeiros 5 pares inscritos:', formattedPairs.slice(0, 5));
        }
        catch (error) {
            console.error(`[${this.identifier}] Erro ao se inscrever nos pares:`, error);
        }
    }
    resubscribeAll() {
        const symbols = Array.from(this.subscribedSymbols);
        if (symbols.length > 0) {
            console.log(`[${this.identifier}] Reinscrevendo em ${symbols.length} pares...`);
            this.subscribe(symbols);
        }
    }
    disconnect() {
        console.log(`[${this.identifier}] Desconectando...`);
        this.cleanup();
    }
}
exports.MexcFuturesConnector = MexcFuturesConnector;
//# sourceMappingURL=mexc-futures-connector.js.map