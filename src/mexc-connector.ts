import WebSocket from 'ws';
import fetch from 'node-fetch';
import { EventEmitter } from 'events';
import { CustomWebSocket, ExchangeConnector, PriceUpdate } from './types';

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

export class MexcConnector extends EventEmitter implements ExchangeConnector {
    private ws: CustomWebSocket | null = null;
    private subscriptions: Set<string> = new Set();
    private readonly identifier: string;
    private readonly onPriceUpdate: (data: PriceUpdate) => void;
    private readonly onConnect: () => void;
    private isConnected: boolean = false;
    private isConnecting: boolean = false;
    private reconnectAttempts: number = 0;
    private readonly maxReconnectAttempts: number = 5;
    private readonly reconnectDelay: number = 5000;
    private readonly baseReconnectDelay: number = 5000;
    private readonly maxReconnectDelay: number = 300000;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private readonly HEARTBEAT_INTERVAL = 20000;
    private readonly WS_URL = 'wss://contract.mexc.com/ws';
    private readonly REST_URL = 'https://api.mexc.com/api/v3/exchangeInfo';
    private heartbeatTimeout: NodeJS.Timeout | null = null;
    private subscribedSymbols: Set<string> = new Set();
    private fallbackRestInterval: NodeJS.Timeout | null = null;
    private connectionStartTime: number = 0;
    private lastPongTime: number = 0;
    private readonly HEARTBEAT_TIMEOUT = 10000;
    private readonly REST_FALLBACK_INTERVAL = 30000;
    private isBlocked: boolean = false;

    constructor(
        identifier: string,
        onPriceUpdate: (data: PriceUpdate) => void,
        onConnect: () => void
    ) {
        super();
        this.identifier = identifier;
        this.onPriceUpdate = onPriceUpdate;
        this.onConnect = onConnect;
        console.log(`[${this.identifier}] Conector instanciado.`);
    }

    public connect(): void {
        if (this.isConnecting) {
            console.log(`[${this.identifier}] Conexão já em andamento.`);
            return;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.isConnecting = true;
        console.log(`[${this.identifier}] Conectando a ${MEXC_FUTURES_WS_URL}`);
        
        try {
            this.ws = new WebSocket(MEXC_FUTURES_WS_URL) as CustomWebSocket;
            this.ws.isAlive = true;

            this.ws.on('open', this.onOpen.bind(this));
            this.ws.on('message', this.onMessage.bind(this));
            this.ws.on('close', this.onClose.bind(this));
            this.ws.on('error', this.onError.bind(this));
            this.ws.on('pong', this.onPong.bind(this));
        } catch (error) {
            console.error(`[${this.identifier}] Erro ao criar WebSocket:`, error);
            this.handleDisconnect();
        }
    }

    public subscribe(symbols: string[]): void {
        symbols.forEach(symbol => this.subscriptions.add(symbol));
        if (this.isConnected && this.ws) {
            this.sendSubscriptionRequests(Array.from(this.subscriptions));
        }
    }

    public async getTradablePairs(): Promise<string[]> {
        try {
            const response = await fetch('https://api.mexc.com/api/v3/exchangeInfo');
            const data = await response.json();
            
            if (!Array.isArray(data.symbols)) {
                throw new Error('Formato de resposta inválido');
            }

            return data.symbols
                .filter((s: any) => s.status === 'ENABLED' && s.quoteAsset === 'USDT')
                .map((s: any) => `${s.baseAsset}/${s.quoteAsset}`);
        } catch (error) {
            console.error(`[${this.identifier}] Erro ao buscar pares negociáveis:`, error);
            return [];
        }
    }

    private sendSubscriptionRequests(symbols: string[]): void {
        if (!this.ws || !this.isConnected) return;

        symbols.forEach(symbol => {
            const msg = {
                method: 'sub.ticker',
                param: { symbol: symbol.replace('/', '_') }
            };
            this.ws?.send(JSON.stringify(msg));
            console.log(`[${this.identifier}] Inscrito em ${symbol}`);
        });
    }

    private onOpen(): void {
        console.log(`[${this.identifier}] Conexão estabelecida`);
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        
        if (this.subscriptions.size > 0) {
            this.sendSubscriptionRequests(Array.from(this.subscriptions));
        }

        this.onConnect();
    }

    private onMessage(data: WebSocket.Data): void {
        try {
            const message = JSON.parse(data.toString());
            
            if (message.channel === 'push.ticker' && message.data) {
                const ticker = message.data;
                const pair = ticker.symbol.replace('_', '/');

                const bestAsk = parseFloat(ticker.ask1);
                const bestBid = parseFloat(ticker.bid1);

                if (!bestAsk || !bestBid) return;

                this.onPriceUpdate({
                    identifier: this.identifier,
                    symbol: pair,
                    marketType: 'futures',
                    bestAsk,
                    bestBid
                });
            }
        } catch (error) {
            console.error(`[${this.identifier}] Erro ao processar mensagem:`, error);
        }
    }

    private onClose(): void {
        console.log(`[${this.identifier}] Conexão fechada`);
        this.cleanup();
        this.handleDisconnect();
    }

    private onError(error: Error): void {
        console.error(`[${this.identifier}] Erro na conexão:`, error);
        this.cleanup();
        this.handleDisconnect();
    }

    private onPong(): void {
        if (this.ws) {
            this.ws.isAlive = true;
        }
    }

    private startHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        this.heartbeatInterval = setInterval(() => {
            if (!this.ws) return;

            if (this.ws.isAlive === false) {
                console.log(`[${this.identifier}] Heartbeat falhou, reconectando...`);
                this.ws.terminate();
                return;
            }

            this.ws.isAlive = false;
            this.ws.ping();
        }, this.HEARTBEAT_INTERVAL);
    }

    private cleanup(): void {
        this.isConnected = false;
        this.isConnecting = false;
        
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        if (this.ws) {
            this.ws.removeAllListeners();
            this.ws = null;
        }
    }

    private handleDisconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error(`[${this.identifier}] Máximo de tentativas de reconexão atingido`);
            return;
        }

        const delay = Math.min(
            this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
            this.maxReconnectDelay
        );

        console.log(`[${this.identifier}] Tentando reconectar em ${delay/1000} segundos...`);
        
        setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
        }, delay);
    }

    public disconnect(): void {
        console.log(`[${this.identifier}] Desconectando...`);
        this.cleanup();
    }
} 