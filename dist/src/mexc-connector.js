"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MexcConnector = void 0;
const ws_1 = __importDefault(require("ws"));
const node_fetch_1 = __importDefault(require("node-fetch"));
class MexcConnector {
    constructor() {
        this.ws = null;
        this.priceUpdateCallback = null;
        this.wsUrl = 'wss://contract.mexc.com/ws';
        this.restUrl = 'https://contract.mexc.com/api/v1/contract/detail';
        this.symbols = [];
        this.pingInterval = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 5000;
        this.relevantPairs = [
            'BTC_USDT',
            'ETH_USDT',
            'SOL_USDT',
            'XRP_USDT',
            'BNB_USDT'
        ];
    }
    async connect() {
        try {
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                console.error('Número máximo de tentativas de reconexão atingido. Aguardando 1 minuto antes de tentar novamente.');
                this.reconnectAttempts = 0;
                setTimeout(() => this.connect(), 60000);
                return;
            }
            this.symbols = await this.getSymbols();
            console.log('Conectando ao WebSocket da MEXC...');
            this.ws = new ws_1.default(this.wsUrl, {
                perMessageDeflate: false,
                handshakeTimeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Origin': 'https://contract.mexc.com'
                }
            });
            this.ws.on('open', () => {
                console.log('Conexão estabelecida com MEXC!');
                this.reconnectAttempts = 0;
                this.setupHeartbeat();
                this.subscribeToSymbols();
            });
            this.ws.on('message', (data) => this.handleMessage(data));
            this.ws.on('error', (error) => {
                console.error('Erro na conexão MEXC:', error);
                this.cleanup();
                this.reconnectAttempts++;
                setTimeout(() => this.connect(), this.reconnectDelay);
            });
            this.ws.on('close', (code, reason) => {
                console.log('Conexão MEXC fechada:', code, reason === null || reason === void 0 ? void 0 : reason.toString());
                this.cleanup();
                this.reconnectAttempts++;
                setTimeout(() => this.connect(), this.reconnectDelay);
            });
            this.ws.on('pong', () => {
                if (this.ws) {
                    this.ws.isAlive = true;
                    console.log('Pong recebido da MEXC - Conexão ativa');
                }
            });
        }
        catch (error) {
            console.error('Erro ao conectar com MEXC:', error);
            this.reconnectAttempts++;
            setTimeout(() => this.connect(), this.reconnectDelay);
        }
    }
    async getSymbols() {
        try {
            const response = await (0, node_fetch_1.default)(this.restUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if (data && data.data && Array.isArray(data.data)) {
                return data.data
                    .filter((contract) => contract.quoteCoin === 'USDT' &&
                    contract.futureType === 1 &&
                    !contract.symbol.includes('_INDEX_'))
                    .map((contract) => contract.symbol);
            }
            console.warn('Formato de resposta inválido da MEXC, usando lista padrão');
            return this.relevantPairs;
        }
        catch (error) {
            console.error('Erro ao buscar símbolos da MEXC:', error);
            return this.relevantPairs;
        }
    }
    setupHeartbeat() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        this.pingInterval = setInterval(() => {
            var _a;
            if (((_a = this.ws) === null || _a === void 0 ? void 0 : _a.readyState) === ws_1.default.OPEN) {
                if (this.ws.isAlive === false) {
                    console.log('MEXC não respondeu ao ping anterior, reconectando...');
                    this.cleanup();
                    this.connect();
                    return;
                }
                this.ws.isAlive = false;
                const pingMsg = {
                    "method": "ping"
                };
                this.ws.send(JSON.stringify(pingMsg));
                console.log('Ping enviado para MEXC');
            }
        }, 10000);
    }
    subscribeToSymbols() {
        if (!this.ws || this.ws.readyState !== ws_1.default.OPEN) {
            console.log('WebSocket não está pronto para subscrição, tentando reconectar...');
            this.cleanup();
            this.connect();
            return;
        }
        this.symbols.forEach(symbol => {
            var _a, _b;
            const formattedSymbol = symbol.toLowerCase().replace('_', '');
            const msg = {
                "method": "sub.deal",
                "param": {
                    "symbol": formattedSymbol
                },
                "id": Date.now()
            };
            try {
                console.log('Enviando subscrição MEXC:', JSON.stringify(msg));
                (_a = this.ws) === null || _a === void 0 ? void 0 : _a.send(JSON.stringify(msg));
                const tickerMsg = {
                    "method": "sub.depth",
                    "param": {
                        "symbol": formattedSymbol,
                        "level": 20
                    },
                    "id": Date.now() + 1
                };
                console.log('Enviando subscrição de profundidade MEXC:', JSON.stringify(tickerMsg));
                (_b = this.ws) === null || _b === void 0 ? void 0 : _b.send(JSON.stringify(tickerMsg));
            }
            catch (error) {
                console.error('Erro ao enviar subscrição para MEXC:', error);
            }
        });
    }
    handleMessage(data) {
        var _a;
        try {
            const message = JSON.parse(data.toString());
            if (message.method === "ping") {
                const pongMsg = {
                    "method": "pong"
                };
                (_a = this.ws) === null || _a === void 0 ? void 0 : _a.send(JSON.stringify(pongMsg));
                return;
            }
            if (message.channel === "push.depth" && message.data) {
                const depth = message.data;
                if (depth.asks && depth.asks.length > 0 && depth.bids && depth.bids.length > 0) {
                    const bestAsk = parseFloat(depth.asks[0][0]);
                    const bestBid = parseFloat(depth.bids[0][0]);
                    if (bestAsk && bestBid && this.priceUpdateCallback) {
                        const symbol = message.symbol.toUpperCase();
                        const formattedSymbol = symbol.slice(0, -4) + '_' + symbol.slice(-4);
                        const update = {
                            identifier: 'mexc',
                            symbol: formattedSymbol,
                            type: 'futures',
                            marketType: 'futures',
                            bestAsk,
                            bestBid
                        };
                        const spreadPercent = ((bestBid - bestAsk) / bestAsk) * 100;
                        if (this.relevantPairs.includes(formattedSymbol) && Math.abs(spreadPercent) > 0.1) {
                            const spreadColor = spreadPercent > 0.5 ? '\x1b[32m' : '\x1b[36m';
                            const resetColor = '\x1b[0m';
                            console.log(`
${spreadColor}┌──────────────────────────────────────────────
│ 📊 MEXC Atualização - ${new Date().toLocaleTimeString('pt-BR')}
│ 🔸 Par: ${update.symbol}
│ 📉 Compra (Ask): ${bestAsk.toFixed(8)} USDT
│ 📈 Venda (Bid): ${bestBid.toFixed(8)} USDT
│ 📊 Spread: ${spreadPercent.toFixed(4)}%
└──────────────────────────────────────────────${resetColor}`);
                        }
                        this.priceUpdateCallback(update);
                    }
                }
            }
        }
        catch (error) {
            console.error('\x1b[31mErro ao processar mensagem MEXC:', error, '\x1b[0m');
        }
    }
    disconnect() {
        this.cleanup();
    }
    cleanup() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        if (this.ws) {
            this.ws.removeAllListeners();
            if (this.ws.readyState === ws_1.default.OPEN) {
                this.ws.close();
            }
            this.ws = null;
        }
    }
    onPriceUpdate(callback) {
        this.priceUpdateCallback = callback;
    }
}
exports.MexcConnector = MexcConnector;
//# sourceMappingURL=mexc-connector.js.map