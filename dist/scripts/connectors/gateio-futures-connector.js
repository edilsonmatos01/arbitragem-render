"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GateIoFuturesConnector = void 0;
const WebSocket = require('ws');
const node_fetch_1 = __importDefault(require("node-fetch"));
const GATEIO_WS_URL = 'wss://fx-ws.gateio.ws/v4/ws/usdt';
class GateIoFuturesConnector {
    constructor(identifier, onPriceUpdate, onConnect) {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 5000;
        this.REST_URL = 'https://api.gateio.ws/api/v4/futures/usdt/contracts';
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
        console.log(`[${this.identifier}] Iniciando limpeza da conexão...`);
        this.stopHeartbeat();
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.ws) {
            try {
                console.log(`[${this.identifier}] Estado do WebSocket antes da limpeza:`, this.ws.readyState);
                this.ws.removeAllListeners();
                if (this.ws.readyState === WebSocket.OPEN) {
                    this.ws.close();
                }
                else {
                    this.ws.terminate();
                }
                this.ws = null;
                console.log(`[${this.identifier}] WebSocket limpo com sucesso`);
            }
            catch (error) {
                console.error(`[${this.identifier}] Erro ao limpar conexão:`, error);
            }
        }
        this.isConnected = false;
        console.log(`[${this.identifier}] Limpeza concluída`);
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
            this.ws = new WebSocket(GATEIO_WS_URL, {
                handshakeTimeout: 30000,
                timeout: 30000,
                perMessageDeflate: false,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            this.ws.on('open', () => {
                console.log(`[${this.identifier}] WebSocket conectado com sucesso`);
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.startHeartbeat();
                this.onConnect();
                if (this.subscribedSymbols.size > 0) {
                    this.resubscribeAll();
                }
            });
            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    console.log(`[${this.identifier}] Mensagem recebida:`, message);
                    if (message.channel === 'push.ticker') {
                        const ticker = message.data;
                        const pair = ticker.symbol.replace('_', '/').toUpperCase();
                        const priceData = {
                            bestAsk: parseFloat(ticker.ask),
                            bestBid: parseFloat(ticker.bid),
                        };
                        if (!priceData.bestAsk || !priceData.bestBid) {
                            console.log(`[${this.identifier}] Preços inválidos recebidos:`, ticker);
                            return;
                        }
                        console.log(`[${this.identifier}] Atualização de preço para ${pair}:`, priceData);
                        this.onPriceUpdate({
                            type: 'price-update',
                            symbol: pair,
                            marketType: 'futures',
                            bestAsk: priceData.bestAsk,
                            bestBid: priceData.bestBid,
                            identifier: this.identifier
                        });
                    }
                }
                catch (error) {
                    console.error(`[${this.identifier}] Erro ao processar mensagem:`, error);
                }
            });
            this.ws.on('close', (code, reason) => {
                console.log(`[${this.identifier}] WebSocket fechado. Código: ${code}, Razão: ${reason || 'Sem razão especificada'}`);
                this.handleDisconnect(`Fechado com código ${code}`);
            });
            this.ws.on('error', (error) => {
                console.error(`[${this.identifier}] Erro na conexão WebSocket:`, error);
                this.handleDisconnect(`Erro: ${error.message}`);
            });
            this.ws.on('upgrade', (response) => {
                console.log(`[${this.identifier}] Conexão WebSocket atualizada. Status:`, response.statusCode);
            });
        }
        catch (error) {
            console.error(`[${this.identifier}] Erro ao conectar:`, error);
            this.handleDisconnect(`Erro na conexão: ${error}`);
        }
    }
    subscribe(pairs) {
        console.log(`[${this.identifier}] Inscrevendo-se em ${pairs.length} pares`);
        pairs.forEach(pair => this.subscribedSymbols.add(pair));
        if (this.isConnected && this.ws) {
            const formattedPairs = Array.from(this.subscribedSymbols).map(pair => pair.replace('/', '_'));
            const subscribeMessage = {
                "op": "sub.ticker",
                "param": {
                    "symbols": formattedPairs
                }
            };
            console.log(`[${this.identifier}] Enviando mensagem de subscrição:`, JSON.stringify(subscribeMessage));
            this.ws.send(JSON.stringify(subscribeMessage));
        }
    }
    resubscribeAll() {
        const pairs = Array.from(this.subscribedSymbols);
        if (pairs.length > 0) {
            console.log(`[${this.identifier}] Reinscrevendo em ${pairs.length} pares...`);
            this.subscribe(pairs);
        }
    }
    disconnect() {
        console.log(`[${this.identifier}] Desconectando...`);
        this.cleanup();
    }
    async getTradablePairs() {
        try {
            console.log(`[${this.identifier}] Buscando pares negociáveis...`);
            const response = await (0, node_fetch_1.default)(this.REST_URL);
            const data = await response.json();
            if (!Array.isArray(data)) {
                throw new Error('Formato de resposta inválido');
            }
            const pairs = data
                .filter((contract) => contract.in_delisting === false)
                .map((contract) => contract.name.replace('_', '/'));
            console.log(`[${this.identifier}] ${pairs.length} pares encontrados`);
            console.log('Primeiros 5 pares:', pairs.slice(0, 5));
            return pairs;
        }
        catch (error) {
            console.error(`[${this.identifier}] Erro ao buscar pares:`, error);
            return [];
        }
    }
}
exports.GateIoFuturesConnector = GateIoFuturesConnector;
//# sourceMappingURL=gateio-futures-connector.js.map