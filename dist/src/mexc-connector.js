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
            console.log(`[${this.marketIdentifier}] Conexão já existe. Fechando a antiga...`);
            this.ws.close();
        }
        console.log(`[${this.marketIdentifier}] Conectando a ${MEXC_FUTURES_WS_URL}`);
        this.ws = new ws_1.default(MEXC_FUTURES_WS_URL);
        this.ws.on('open', () => this.onOpen());
        this.ws.on('message', (data) => this.onMessage(data));
        this.ws.on('close', (code, reason) => this.onClose(code, reason));
        this.ws.on('error', (error) => this.onError(error));
    }
    subscribe(symbols) {
        symbols.forEach(symbol => {
            this.subscriptions.add(symbol);
            if (this.isConnected) {
                this.sendSubscriptionRequest(symbol);
            }
        });
    }
    sendSubscriptionRequest(symbol) {
        const ws = this.ws;
        if (!ws)
            return;
        const subscriptionMessage = {
            method: 'sub.ticker',
            param: { symbol: symbol.replace('/', '_') }
        };
        console.log(`[${this.marketIdentifier}] Inscrevendo-se em: ${symbol}`);
        ws.send(JSON.stringify(subscriptionMessage));
    }
    onOpen() {
        console.log(`[${this.marketIdentifier}] Conexão WebSocket estabelecida.`);
        this.isConnected = true;
        this.startPing();
        // Inscreve-se em todos os pares registrados
        this.subscriptions.forEach(symbol => {
            this.sendSubscriptionRequest(symbol);
        });
        if (this.onConnectedCallback) {
            this.onConnectedCallback();
        }
    }
    onMessage(data) {
        const ws = this.ws;
        if (!ws)
            return;
        try {
            const message = JSON.parse(data.toString());
            // Resposta ao ping do servidor
            if (message.method === 'ping') {
                ws.send(JSON.stringify({ method: 'pong' }));
                return;
            }
            // Confirmação de inscrição
            if (message.channel === 'rs.sub.ticker') {
                console.log(`[${this.marketIdentifier}] Inscrição confirmada para: ${message.data}`);
                return;
            }
            // Processamento de dados do ticker
            if (message.channel === 'push.ticker' && message.data) {
                const ticker = message.data;
                const pair = ticker.symbol.replace('_', '/');
                if (!this.marketPrices[this.marketIdentifier]) {
                    this.marketPrices[this.marketIdentifier] = {};
                }
                this.marketPrices[this.marketIdentifier][pair] = {
                    bestAsk: parseFloat(ticker.ask1),
                    bestBid: parseFloat(ticker.bid1),
                    timestamp: ticker.timestamp
                };
            }
        }
        catch (error) {
            console.error(`[${this.marketIdentifier}] Erro ao processar mensagem:`, error);
        }
    }
    startPing() {
        this.stopPing();
        this.pingInterval = setInterval(() => {
            const ws = this.ws;
            if (ws?.readyState === ws_1.default.OPEN) {
                ws.send(JSON.stringify({ method: "ping" }));
            }
        }, 20 * 1000);
    }
    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
    onClose(code, reason) {
        console.warn(`[${this.marketIdentifier}] Conexão fechada. Código: ${code}. Reconectando em 5s...`);
        this.isConnected = false;
        this.stopPing();
        setTimeout(() => this.connect(), 5000);
    }
    onError(error) {
        console.error(`[${this.marketIdentifier}] Erro no WebSocket:`, error.message);
    }
}
exports.MexcConnector = MexcConnector;
