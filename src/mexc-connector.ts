import WebSocket from 'ws';
<<<<<<< HEAD
import fetch from 'node-fetch';
import { EventEmitter } from 'events';

interface MexcWebSocket {
    removeAllListeners: () => void;
    terminate: () => void;
    on: (event: string, listener: (...args: any[]) => void) => this;
    send: (data: string) => void;
    readyState: number;
    close: () => void;
    ping: () => void;
}

const MEXC_FUTURES_WS_URL = 'wss://contract.mexc.com/edge';

export class MexcConnector extends EventEmitter {
=======

const MEXC_FUTURES_WS_URL = 'wss://contract.mexc.com/edge';

export class MexcConnector {
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
    private ws: WebSocket | null = null;
    private subscriptions: Set<string> = new Set();
    private pingInterval: NodeJS.Timeout | null = null;
    private priceUpdateCallback: (data: any) => void;
    private onConnectedCallback: (() => void) | null;
    private isConnected: boolean = false;
    private marketIdentifier: string;
<<<<<<< HEAD
    private readonly identifier: string;
    private readonly onPriceUpdate: Function;
    private readonly onConnect: Function;
    private isConnecting: boolean = false;
    private reconnectAttempts: number = 0;
    private readonly baseReconnectDelay: number = 5000; // 5 segundos
    private readonly maxReconnectDelay: number = 300000; // 5 minutos
    private readonly WS_URL = 'wss://contract.mexc.com/ws';
    private readonly REST_URL = 'https://api.mexc.com/api/v3/exchangeInfo';
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private heartbeatTimeout: NodeJS.Timeout | null = null;
    private subscribedSymbols: Set<string> = new Set();
    private fallbackRestInterval: NodeJS.Timeout | null = null;
    private connectionStartTime: number = 0;
    private lastPongTime: number = 0;
    private readonly HEARTBEAT_INTERVAL = 20000; // 20 seconds
    private readonly HEARTBEAT_TIMEOUT = 10000; // 10 segundos
    private readonly REST_FALLBACK_INTERVAL = 30000; // 30 segundos
    private isBlocked: boolean = false;
    private readonly maxReconnectAttempts: number = 5;
    private readonly reconnectDelay: number = 5000;
=======
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc

    constructor(
        identifier: string, 
        priceUpdateCallback: (data: any) => void,
        onConnected: () => void
    ) {
<<<<<<< HEAD
        super();
        this.marketIdentifier = identifier;
        this.priceUpdateCallback = priceUpdateCallback;
        this.onConnectedCallback = onConnected;
        this.identifier = identifier;
        this.onPriceUpdate = priceUpdateCallback;
        this.onConnect = onConnected;
=======
        this.marketIdentifier = identifier;
        this.priceUpdateCallback = priceUpdateCallback;
        this.onConnectedCallback = onConnected;
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
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

                // Chama o callback centralizado no servidor
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
<<<<<<< HEAD

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
                    // Filtra apenas pares ativos e que terminam em USDT
                    return symbol.status === 'ENABLED' && 
                           symbol.quoteAsset === 'USDT' &&
                           // Adiciona validações extras para garantir que são pares válidos
                           symbol.symbol.endsWith('USDT');
                })
                .map((symbol: any) => {
                    const base = symbol.symbol.slice(0, -4); // Remove 'USDT'
                    return `${base}/USDT`;
                });

            console.log(`[${this.identifier}] ${pairs.length} pares encontrados`);
            if (pairs.length > 0) {
                console.log('Primeiros 5 pares:', pairs.slice(0, 5));
            }
            return pairs;
        } catch (error) {
            console.error(`[${this.identifier}] Erro ao buscar pares:`, error);
            return [];
        }
    }
=======
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
} 