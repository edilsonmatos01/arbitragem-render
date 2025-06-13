"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MexcConnector = void 0;
const ws_1 = __importDefault(require("ws"));
// O endpoint que confirmamos funcionar
const MEXC_FUTURES_WS_URL = 'wss://contract.mexc.com/edge';
/**
 * Gerencia a conexão WebSocket e as inscrições para o feed de futuros da MEXC.
 */
class MexcConnector {
    constructor(marketPrices, onConnected) {
        this.ws = null;
        this.subscriptions = new Set();
        this.pingInterval = null;
        this.isConnected = false;
        this.marketPrices = marketPrices;
        this.onConnectedCallback = onConnected;
        console.log("MexcConnector instanciado.");
    }
    /**
     * Inicia a conexão com o WebSocket da MEXC.
     */
    connect() {
        if (this.ws) {
            console.log("Conexão com a MEXC já existe. Fechando a antiga antes de reconectar.");
            this.ws.close();
        }
        console.log(`Conectando ao WebSocket de Futuros da MEXC: ${MEXC_FUTURES_WS_URL}`);
        this.ws = new ws_1.default(MEXC_FUTURES_WS_URL);
        this.ws.on('open', this.onOpen.bind(this));
        this.ws.on('message', this.onMessage.bind(this));
        this.ws.on('close', this.onClose.bind(this));
        this.ws.on('error', this.onError.bind(this));
    }
    /**
     * Inscreve-se em um ou mais pares de negociação.
     * @param symbols - Um array de símbolos de pares, ex: ['BTC_USDT', 'ETH_USDT']
     */
    subscribe(symbols) {
        symbols.forEach(symbol => this.subscriptions.add(symbol));
        if (this.isConnected && this.ws) {
            this.sendSubscriptionRequests(symbols);
        }
    }
    onOpen() {
        console.log('Conexão WebSocket com a MEXC (Futuros) estabelecida.');
        this.isConnected = true;
        // Inicia o mecanismo de ping/pong para manter a conexão ativa
        this.startPing();
        // Envia as inscrições pendentes
        if (this.subscriptions.size > 0) {
            this.sendSubscriptionRequests(Array.from(this.subscriptions));
        }
        // Executa o callback de conexão, se houver
        if (this.onConnectedCallback) {
            this.onConnectedCallback();
            this.onConnectedCallback = null;
        }
    }
    sendSubscriptionRequests(symbols) {
        if (!this.ws)
            return;
        symbols.forEach(symbol => {
            const subscriptionMessage = {
                method: 'sub.ticker',
                param: { symbol: symbol.replace('/', '_') } // Garante o formato 'BTC_USDT'
            };
            console.log(`[MEXC] Inscrevendo-se em: ${symbol}`);
            this.ws.send(JSON.stringify(subscriptionMessage));
        });
    }
    onMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            // Resposta ao ping do servidor
            if (message.method === 'ping' && this.ws) {
                this.ws.send(JSON.stringify({ method: 'pong' }));
                return;
            }
            // Confirmação de inscrição
            if (message.channel === 'rs.sub.ticker') {
                console.log(`[MEXC] Inscrição confirmada para: ${message.data}`);
                return;
            }
            // Processamento de dados do ticker
            if (message.channel === 'push.ticker' && message.data) {
                const ticker = message.data;
                const pair = ticker.symbol.replace('_', '/'); // Converte 'BTC_USDT' para 'BTC/USDT'
                if (!this.marketPrices['MEXC_FUTURES']) {
                    this.marketPrices['MEXC_FUTURES'] = {};
                }
                this.marketPrices['MEXC_FUTURES'][pair] = {
                    bestAsk: parseFloat(ticker.ask1),
                    bestBid: parseFloat(ticker.bid1),
                    timestamp: ticker.timestamp,
                };
            }
        }
        catch (error) {
            console.error('[MEXC] Erro ao processar mensagem:', error);
        }
    }
    onClose(code, reason) {
        console.warn(`[MEXC] Conexão WebSocket fechada. Código: ${code}, Motivo: ${reason}. Tentando reconectar em 5 segundos...`);
        this.isConnected = false;
        this.stopPing();
        setTimeout(() => this.connect(), 5000);
    }
    onError(error) {
        console.error('[MEXC] Erro no WebSocket:', error.message);
        // O evento 'close' será chamado em seguida, tratando a reconexão.
    }
    startPing() {
        this.stopPing(); // Garante que não haja múltiplos intervalos
        this.pingInterval = setInterval(() => {
            if (this.ws?.readyState === ws_1.default.OPEN) {
                // A API da MEXC usa um ping vindo do servidor, então o cliente só precisa responder.
                // Mas podemos enviar um PING para verificar a latência ou se a conexão ainda está de pé.
                this.ws.send(JSON.stringify({ method: "ping" }));
            }
        }, 20 * 1000); // A cada 20 segundos
    }
    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
}
exports.MexcConnector = MexcConnector;
