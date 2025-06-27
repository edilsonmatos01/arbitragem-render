"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MexcFuturesConnector = void 0;
const ws_1 = __importDefault(require("ws"));
const events_1 = require("events");
const node_fetch_1 = __importDefault(require("node-fetch"));
const GATEIO_WS_URL = 'wss://fx-ws.gateio.ws/v4/ws/usdt';
class MexcFuturesConnector extends events_1.EventEmitter {
    constructor(identifier, onPriceUpdate, onConnect) {
        super();
        this.ws = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000;
        this.REST_URL = 'https://api.gateio.ws/api/v4/futures/usdt/contracts';
        this.subscribedSymbols = new Set();
        this.identifier = identifier;
        this.onPriceUpdate = onPriceUpdate;
        this.onConnect = onConnect;
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
        console.log(`[${this.identifier}] Conectando...`);
        try {
            this.ws = new ws_1.default('wss://contract.mexc.com/edge');
            this.ws.on('open', () => {
                console.log(`[${this.identifier}] Conexão estabelecida`);
                this.isConnected = true;
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                this.onConnect();
            });
            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    if (message.channel === 'push.ticker') {
                        const ticker = message.data;
                        this.onPriceUpdate({
                            identifier: this.identifier,
                            symbol: ticker.symbol.replace('_', '/').toUpperCase(),
                            marketType: 'futures',
                            bestAsk: parseFloat(ticker.ask),
                            bestBid: parseFloat(ticker.bid)
                        });
                    }
                }
                catch (error) {
                    console.error(`[${this.identifier}] Erro ao processar mensagem:`, error);
                }
            });
            this.ws.on('close', () => {
                console.log(`[${this.identifier}] Conexão fechada`);
                this.handleDisconnect();
            });
            this.ws.on('error', (error) => {
                console.error(`[${this.identifier}] Erro na conexão:`, error);
                this.handleDisconnect();
            });
            this.startHeartbeat();
        }
        catch (error) {
            console.error(`[${this.identifier}] Erro ao criar WebSocket:`, error);
            this.handleDisconnect();
        }
    }
    startHeartbeat() {
        if (!this.ws)
            return;
        setInterval(() => {
            var _a;
            if (this.isConnected && ((_a = this.ws) === null || _a === void 0 ? void 0 : _a.readyState) === ws_1.default.OPEN) {
                this.ws.ping();
            }
        }, 20000);
    }
    handleDisconnect() {
        this.isConnected = false;
        this.isConnecting = false;
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            console.log(`[${this.identifier}] Tentando reconectar em ${delay}ms...`);
            setTimeout(() => this.connect(), delay);
        }
        else {
            console.error(`[${this.identifier}] Máximo de tentativas de reconexão atingido`);
        }
    }
    subscribe(symbols) {
        if (!this.ws || this.ws.readyState !== ws_1.default.OPEN) {
            console.log(`[${this.identifier}] WebSocket não está pronto para subscrição`);
            return;
        }
        symbols.forEach(symbol => {
            var _a;
            const formattedSymbol = symbol.replace('/', '').toLowerCase();
            const msg = { method: 'sub.ticker', param: { symbol: formattedSymbol } };
            (_a = this.ws) === null || _a === void 0 ? void 0 : _a.send(JSON.stringify(msg));
        });
    }
    disconnect() {
        console.log(`[${this.identifier}] Desconectando...`);
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        this.isConnecting = false;
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
exports.MexcFuturesConnector = MexcFuturesConnector;
//# sourceMappingURL=mexc-futures-connector.js.map