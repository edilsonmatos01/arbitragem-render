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

interface ExchangePair {
    symbol: string;
    active: boolean;
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
    private readonly baseUrl = 'https://contract.mexc.com';

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

    public async getAvailablePairs(): Promise<ExchangePair[]> {
        try {
            const response = await fetch(`${this.baseUrl}/api/v1/contract/detail`);
            const data = await response.json() as any;
            
            return Object.values(data.data)
                .filter((pair: any) => pair.state === 'ONLINE')
                .map((pair: any) => ({
                    symbol: pair.symbol.replace('_', '/'),
                    active: true
                }));
        } catch (error) {
            console.error('Erro ao obter pares do MEXC:', error);
            return [];
        }
    }

    public async connect(): Promise<void> {
        if (this.ws) {
            await this.disconnect();
        }

        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(MEXC_FUTURES_WS_URL);

                this.ws.on('open', () => {
                    console.log(`[${this.marketIdentifier}] Conexão WebSocket estabelecida.`);
                    
                    // Inscreve no canal de book de ordens para todos os pares
                    const subscribePayload = {
                        method: 'sub.depth',
                        param: {}
                    };

                    if (this.ws) {
                        this.ws.send(JSON.stringify(subscribePayload));
                    }

                    this.isConnected = true;
                    this.startPing();
                    if (this.subscriptions.size > 0) {
                        this.sendSubscriptionRequests(Array.from(this.subscriptions));
                    }
                    if (this.onConnectedCallback) {
                        this.onConnectedCallback();
                        this.onConnectedCallback = null;
                    }
                    resolve();
                });

                this.ws.on('message', (data: Buffer) => {
                    try {
                        const message = JSON.parse(data.toString());
                        
                        if (message.channel === 'push.depth' && message.data && message.data.asks && message.data.bids) {
                            const symbol = message.symbol.replace('_', '/');
                            const update: PriceUpdate = {
                                identifier: this.marketIdentifier,
                                symbol,
                                marketType: 'futures',
                                bestBid: parseFloat(message.data.bids[0][0]),
                                bestAsk: parseFloat(message.data.asks[0][0])
                            };
                            this.priceUpdateCallback(update);
                        }
                    } catch (error) {
                        console.error(`[${this.marketIdentifier}] Erro ao processar mensagem:`, error);
                    }
                });

                this.ws.on('error', (error) => {
                    console.error(`[${this.marketIdentifier}] Erro na conexão WebSocket:`, error);
                    this.ws?.close();
                    reject(error);
                });

                this.ws.on('close', () => {
                    console.log(`[${this.marketIdentifier}] Conexão WebSocket fechada.`);
                    this.reconnect();
                });

            } catch (error) {
                console.error(`[${this.marketIdentifier}] Erro ao conectar:`, error);
                reject(error);
            }
        });
    }

    private async reconnect(): Promise<void> {
        console.log(`[${this.marketIdentifier}] Tentando reconectar...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        await this.connect();
    }

    public async disconnect(): Promise<void> {
        return new Promise((resolve) => {
            if (this.ws) {
                this.ws.on('close', () => {
                    this.ws = null;
                    this.isConnected = false;
                    this.stopPing();
                    resolve();
                });
                this.ws.close();
            } else {
                resolve();
            }
        });
    }

    public subscribe(symbols: string[]): void {
        symbols.forEach(symbol => this.subscriptions.add(symbol));
        if (this.isConnected) {
            this.sendSubscriptionRequests(Array.from(this.subscriptions));
        }
    }

    private sendSubscriptionRequests(symbols: string[]): void {
        const ws = this.ws;
        if (!ws) return;
        symbols.forEach(symbol => {
            const msg = {
                method: 'sub.depth',
                param: {
                    symbol: symbol.replace('/', '_')
                }
            };
            ws.send(JSON.stringify(msg));
        });
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