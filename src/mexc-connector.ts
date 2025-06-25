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

const MEXC_FUTURES_WS_URL = 'wss://contract.mexc.com/ws';

export class MexcConnector extends EventEmitter {
    private ws: WebSocket | null = null;
    private subscriptions: Set<string> = new Set();
    private pingInterval: NodeJS.Timeout | null = null;
    private priceUpdateCallback: (data: PriceUpdate) => void;
    private onConnectedCallback: (() => void) | null;
    private isConnected: boolean = false;
    private marketIdentifier: string;
    private readonly identifier: string;
    private readonly REST_URL = 'https://contract.mexc.com/api/v1/contract/detail';

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
        if (this.ws?.readyState === WebSocket.OPEN) {
            console.log(`[${this.marketIdentifier}] WebSocket já está conectado.`);
            return;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
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
        if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
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
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        
        symbols.forEach(symbol => {
            const futuresSymbol = symbol.replace('/', '').toUpperCase();
            const msg = {
                "method": "sub.ticker",
                "param": {
                    "symbol": futuresSymbol
                }
            };
            console.log(`[${this.marketIdentifier}] Enviando subscrição para ${futuresSymbol}`);
            ws.send(JSON.stringify(msg));
        });
    }

    private onMessage(data: WebSocket.Data): void {
        try {
            const message = JSON.parse(data.toString());
            
            // Resposta do ping
            if (message.channel === 'pong') {
                return;
            }

            if (message.channel === 'push.ticker' && message.data) {
                const ticker = message.data;
                const pair = `${ticker.symbol.slice(0, -4)}/${ticker.symbol.slice(-4)}`;

                const priceData = {
                    bestAsk: parseFloat(ticker.ask),
                    bestBid: parseFloat(ticker.bid),
                };

                if (!priceData.bestAsk || !priceData.bestBid) {
                    console.log(`[${this.marketIdentifier}] Preços inválidos para ${pair}:`, ticker);
                    return;
                }

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
        console.log(`[${this.marketIdentifier}] Conexão WebSocket fechada.`);
        this.isConnected = false;
        this.stopPing();
        
        // Só reconecta se não foi um fechamento intencional
        if (this.ws !== null) {
            console.log(`[${this.marketIdentifier}] Tentando reconectar...`);
            setTimeout(() => this.connect(), 5000);
        }
    }

    private onError(error: Error): void {
        console.error(`[${this.marketIdentifier}] Erro na conexão WebSocket:`, error.message);
    }

    private startPing(): void {
        this.stopPing();
        this.pingInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ "method": "ping" }));
            }
        }, 20000);
    }

    private stopPing(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
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
            console.log(`[${this.identifier}] Buscando pares negociáveis do MEXC Futures...`);
            const response = await fetch(this.REST_URL);
            const data = await response.json();
            
            console.log(`[${this.identifier}] Resposta da API MEXC Futures:`, JSON.stringify(data).slice(0, 200) + '...');
            
            if (!data.data || !Array.isArray(data.data)) {
                console.error(`[${this.identifier}] Resposta inválida da API MEXC Futures:`, data);
                return [];
            }

            const pairs = data.data
                .filter((contract: any) => {
                    return contract.state === 1 && // 1 = ativo
                           contract.quoteCoin === 'USDT';
                })
                .map((contract: any) => `${contract.baseCoin}/${contract.quoteCoin}`);

            console.log(`[${this.identifier}] Total de pares encontrados: ${pairs.length}`);
            if (pairs.length > 0) {
                console.log(`[${this.identifier}] Primeiros 5 pares:`, pairs.slice(0, 5));
            }
            
            return pairs;
        } catch (error) {
            console.error(`[${this.identifier}] Erro ao buscar pares negociáveis:`, error);
            return [];
        }
    }
} 