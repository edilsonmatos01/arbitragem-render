import WebSocket from 'ws';
import { MarketPrices } from './types';

const MEXC_FUTURES_WS_URL = 'wss://contract.mexc.com/edge';

export class MexcConnector {
    private ws: WebSocket | null = null;
    private subscriptions: Set<string> = new Set();
    private pingInterval: NodeJS.Timeout | null = null;
    private marketPrices: MarketPrices;
    private onConnectedCallback: (() => void) | null;
    private isConnected: boolean = false;
    private marketIdentifier: string;

    constructor(identifier: string, marketPrices: MarketPrices, onConnected: () => void) {
        this.marketIdentifier = identifier;
        this.marketPrices = marketPrices;
        this.onConnectedCallback = onConnected;
        console.log(`[${this.marketIdentifier}] Conector instanciado.`);
    }

    public connect(): void {
        if (this.ws) {
            this.ws.close();
        }
        console.log(`[${this.marketIdentifier}] Conectando a ${MEXC_FUTURES_WS_URL}`);
        this.ws = new WebSocket(MEXC_FUTURES_WS_URL);
        this.ws.on('open', this.onOpen.bind(this));
        this.ws.on('message', this.onMessage.bind(this));
        this.ws.on('close', this.onClose.bind(this));
        this.ws.on('error', this.onError.bind(this));
    }

    public subscribe(symbols: string[]): void {
        symbols.forEach(symbol => this.subscriptions.add(symbol));
        if (this.isConnected) {
            this.sendSubscriptionRequests(Array.from(this.subscriptions));
        }
    }

    private onOpen(): void {
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

    private sendSubscriptionRequests(symbols: string[]): void {
        const ws = this.ws;
        if (!ws) return;
        symbols.forEach(symbol => {
            const msg = { method: 'sub.ticker', param: { symbol: symbol.replace('/', '_') } };
            ws.send(JSON.stringify(msg));
        });
    }

    private onMessage(data: WebSocket.Data): void {
        try {
            const message = JSON.parse(data.toString());
            if (message.channel === 'push.ticker' && message.data) {
                const ticker = message.data;
                const pair = ticker.symbol.replace('_', '/');
                if (!this.marketPrices[this.marketIdentifier]) {
                    this.marketPrices[this.marketIdentifier] = {};
                }
                this.marketPrices[this.marketIdentifier][pair] = {
                    bestAsk: parseFloat(ticker.ask1),
                    bestBid: parseFloat(ticker.bid1),
                    timestamp: ticker.timestamp,
                };
            }
        } catch (error) {
            console.error(`[${this.marketIdentifier}] Erro ao processar mensagem:`, error);
        }
    }

    private onClose(): void {
        console.warn(`[${this.marketIdentifier}] Conexão fechada. Reconectando...`);
        this.isConnected = false;
        this.stopPing();
        setTimeout(() => this.connect(), 5000);
    }

    private onError(error: Error): void {
        console.error(`[${this.marketIdentifier}] Erro no WebSocket:`, error.message);
        this.ws?.close();
    }

    private startPing(): void {
        this.stopPing();
        this.pingInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ method: "ping" }));
            }
        }, 20000);
    }

    private stopPing(): void {
        if (this.pingInterval) clearInterval(this.pingInterval);
    }
} 