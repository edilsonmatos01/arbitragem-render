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
        this.wsUrl = 'wss://contract.mexc.com/edge';
        this.restUrl = 'https://contract.mexc.com/api/v1/contract/detail';
        this.symbols = [];
        this.pingInterval = null;
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
            this.symbols = await this.getSymbols();
            console.log('Conectando ao WebSocket da MEXC...');
            this.ws = new ws_1.default(this.wsUrl, {
                perMessageDeflate: false,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            this.ws.on('open', () => {
                console.log('Conexão estabelecida com MEXC!');
                this.setupHeartbeat();
                this.subscribeToSymbols();
            });
            this.ws.on('message', (data) => this.handleMessage(data));
            this.ws.on('error', (error) => {
                console.error('Erro na conexão MEXC:', error);
            });
            this.ws.on('close', (code, reason) => {
                console.log('Conexão MEXC fechada:', code, reason === null || reason === void 0 ? void 0 : reason.toString());
                this.cleanup();
                setTimeout(() => this.connect(), 5000);
            });
        }
        catch (error) {
            console.error('Erro ao conectar com MEXC:', error);
            throw error;
        }
    }
    async getSymbols() {
        try {
            const response = await (0, node_fetch_1.default)(this.restUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
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
            return [
                'BTC_USDT',
                'ETH_USDT',
                'SOL_USDT',
                'XRP_USDT',
                'BNB_USDT'
            ];
        }
        catch (error) {
            console.error('Erro ao buscar símbolos da MEXC:', error);
            return [
                'BTC_USDT',
                'ETH_USDT',
                'SOL_USDT',
                'XRP_USDT',
                'BNB_USDT'
            ];
        }
    }
    setupHeartbeat() {
        var _a;
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        this.pingInterval = setInterval(() => {
            var _a;
            if (((_a = this.ws) === null || _a === void 0 ? void 0 : _a.readyState) === ws_1.default.OPEN) {
                this.ws.ping();
                console.log('Ping enviado para MEXC');
            }
        }, 20000);
        (_a = this.ws) === null || _a === void 0 ? void 0 : _a.on('pong', () => {
            console.log('Pong recebido da MEXC');
        });
    }
    subscribeToSymbols() {
        this.symbols.forEach(symbol => {
            var _a;
            if (((_a = this.ws) === null || _a === void 0 ? void 0 : _a.readyState) === ws_1.default.OPEN) {
                const msg = {
                    method: "sub.ticker",
                    param: { symbol }
                };
                console.log('Enviando subscrição MEXC:', JSON.stringify(msg));
                this.ws.send(JSON.stringify(msg));
            }
        });
    }
    handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            if (message.channel === 'push.ticker' && message.data) {
                const ticker = message.data;
                const bestAsk = parseFloat(ticker.ask1);
                const bestBid = parseFloat(ticker.bid1);
                if (bestAsk && bestBid && this.priceUpdateCallback) {
                    const spreadPercent = ((bestBid - bestAsk) / bestAsk) * 100;
                    const update = {
                        identifier: 'mexc',
                        symbol: ticker.symbol,
                        type: 'futures',
                        marketType: 'futures',
                        bestAsk,
                        bestBid
                    };
                    if (this.relevantPairs.includes(ticker.symbol) && Math.abs(spreadPercent) > 0.1) {
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