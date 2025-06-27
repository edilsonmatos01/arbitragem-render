"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GateioConnector = void 0;
const ws_1 = __importDefault(require("ws"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const GATEIO_WS_URL = 'wss://api.gateio.ws/ws/v4/';
class GateioConnector {
    constructor() {
        this.ws = null;
        this.priceUpdateCallback = null;
        this.wsUrl = 'wss://api.gateio.ws/ws/v4/';
        this.restUrl = 'https://api.gateio.ws/api/v4/futures/usdt/contracts';
        this.symbols = [];
        this.pingInterval = null;
    }
    async connect() {
        try {
            this.symbols = await this.getSymbols();
            console.log('Conectando ao WebSocket do Gate.io...');
            this.ws = new ws_1.default(this.wsUrl, {
                handshakeTimeout: 30000,
                perMessageDeflate: false,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            this.ws.on('open', () => {
                console.log('Conexão estabelecida com Gate.io!');
                this.setupHeartbeat();
                this.subscribeToSymbols();
            });
            this.ws.on('message', (data) => this.handleMessage(data));
            this.ws.on('error', (error) => {
                console.error('Erro na conexão Gate.io:', error);
            });
            this.ws.on('close', (code, reason) => {
                console.log('Conexão Gate.io fechada:', code, reason === null || reason === void 0 ? void 0 : reason.toString());
                this.cleanup();
                setTimeout(() => this.connect(), 5000);
            });
        }
        catch (error) {
            console.error('Erro ao conectar com Gate.io:', error);
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
            if (Array.isArray(data)) {
                return data
                    .filter((contract) => contract.settle === 'usdt' &&
                    !contract.name.includes('_INDEX'))
                    .map((contract) => contract.name);
            }
            console.warn('Formato de resposta inválido do Gate.io, usando lista padrão');
            return [
                'BTC_USDT',
                'ETH_USDT',
                'SOL_USDT',
                'XRP_USDT',
                'BNB_USDT'
            ];
        }
        catch (error) {
            console.error('Erro ao buscar símbolos do Gate.io:', error);
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
                console.log('Ping enviado para Gate.io');
            }
        }, 20000);
        (_a = this.ws) === null || _a === void 0 ? void 0 : _a.on('pong', () => {
            console.log('Pong recebido do Gate.io');
        });
    }
    subscribeToSymbols() {
        this.symbols.forEach(symbol => {
            var _a;
            if (((_a = this.ws) === null || _a === void 0 ? void 0 : _a.readyState) === ws_1.default.OPEN) {
                const msg = {
                    time: Math.floor(Date.now() / 1000),
                    channel: "futures.tickers",
                    event: "subscribe",
                    payload: [symbol]
                };
                console.log('Enviando subscrição Gate.io:', JSON.stringify(msg));
                this.ws.send(JSON.stringify(msg));
            }
        });
    }
    handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            if (message.channel === 'futures.tickers' && message.result) {
                const ticker = message.result;
                const bestAsk = parseFloat(ticker.last);
                const bestBid = parseFloat(ticker.last);
                if (bestAsk && bestBid && this.priceUpdateCallback) {
                    const update = {
                        identifier: 'gateio',
                        symbol: ticker.contract,
                        type: 'futures',
                        marketType: 'futures',
                        bestAsk,
                        bestBid
                    };
                    this.priceUpdateCallback(update);
                }
            }
        }
        catch (error) {
            console.error('Erro ao processar mensagem Gate.io:', error);
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
exports.GateioConnector = GateioConnector;
//# sourceMappingURL=gateio-connector.js.map