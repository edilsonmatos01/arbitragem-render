import WebSocket from 'ws';
import fetch from 'node-fetch';
import { EventEmitter } from 'events';

interface PriceUpdate {
    identifier: string;
    symbol: string;
    marketType: 'spot' | 'futures';
    bestAsk: number;
    bestBid: number;
}

const MEXC_FUTURES_WS_URL = 'wss://contract.mexc.com/edge';

export class MexcConnector extends EventEmitter {
    private ws: WebSocket | null = null;
    private subscriptions: Set<string> = new Set();
    private pingInterval: NodeJS.Timeout | null = null;
    private priceUpdateCallback: (data: PriceUpdate) => void;
    private onConnectedCallback: (() => void) | null;
    private isConnected: boolean = false;
    private marketIdentifier: string;
    private readonly identifier: string;
    private readonly REST_URL = 'https://api.mexc.com/api/v3/exchangeInfo';

    constructor(
        identifier: string, 
        priceUpdateCallback: (data: PriceUpdate) => void,
        onConnected: () => void
    ) {
        super();
        this.marketIdentifier = identifier;
        this.priceUpdateCallback = priceUpdateCallback;
        this.onConnectedCallback = onConnected;
        this.identifier = identifier;
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

                const priceData = {
                    bestAsk: parseFloat(ticker.ask1),
                    bestBid: parseFloat(ticker.bid1),
                };

                if (!priceData.bestAsk || !priceData.bestBid) return;

                this.priceUpdateCallback({
                    identifier: this.marketIdentifier,
                    symbol: pair,
                    marketType: 'futures',
                    bestAsk: priceData.bestAsk,
                    bestBid: priceData.bestBid,
                });
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

    public disconnect(): void {
        console.log(`[${this.marketIdentifier}] Desconectando...`);
        this.isConnected = false;
        this.stopPing();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    async getTradablePairs(): Promise<string[]> {
        try {
            console.log(`[${this.identifier}] Buscando pares negociáveis...`);
            const response = await fetch(this.REST_URL);
            const data = await response.json();
            
            console.log(`[${this.identifier}] Resposta da API:`, JSON.stringify(data).slice(0, 200) + '...');
            
            if (!data.symbols || !Array.isArray(data.symbols)) {
                console.error(`[${this.identifier}] Resposta inválida:`, data);
                return [];
            }

            const pairs = data.symbols
                .filter((symbol: any) => {
                    return symbol.status === 'ENABLED' && 
                           symbol.quoteAsset === 'USDT' &&
                           symbol.baseAsset !== 'USDT';
                })
                .map((symbol: any) => `${symbol.baseAsset}/USDT`);

            console.log(`[${this.identifier}] Pares negociáveis encontrados:`, pairs.length);
            return pairs;
        } catch (error) {
            console.error(`[${this.identifier}] Erro ao buscar pares negociáveis:`, error);
            return [];
        }
    }
} 