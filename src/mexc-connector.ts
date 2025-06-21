import WebSocket from 'ws';
import { MarketPrices } from './types';

const MEXC_FUTURES_WS_URL = 'wss://contract.mexc.com/edge';

type PriceUpdateCallback = (update: { 
    type: string;
    symbol: string;
    marketType: string;
    bestAsk: number;
    bestBid: number;
    identifier: string;
}) => void;

export class MexcConnector {
    private ws: WebSocket | null = null;
    private subscriptions: Set<string> = new Set();
    private pingInterval: NodeJS.Timeout | null = null;
    private onPriceUpdate: PriceUpdateCallback;
    private onConnectedCallback: (() => void) | null;
    private isConnected: boolean = false;
    private marketIdentifier: string;

    constructor(identifier: string, onPriceUpdate: PriceUpdateCallback, onConnected: () => void) {
        this.marketIdentifier = identifier;
        this.onPriceUpdate = onPriceUpdate;
        this.onConnectedCallback = onConnected;
        console.log(`[${this.marketIdentifier}] Conector instanciado.`);
    }

    public connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.ws) {
                console.log(`[${this.marketIdentifier}] Conexão já existe. Fechando a antiga...`);
                this.ws.close();
            }

            console.log(`[${this.marketIdentifier}] Conectando a ${MEXC_FUTURES_WS_URL}`);
            this.ws = new WebSocket(MEXC_FUTURES_WS_URL);

            this.ws.once('open', () => {
                this.onOpen();
                resolve();
            });

            this.ws.once('error', (error) => {
                reject(error);
            });

            this.ws.on('message', (data) => this.onMessage(data));
            this.ws.on('close', (code, reason) => this.onClose(code, reason));
        });
    }

    public subscribe(symbols: string[]): void {
        symbols.forEach(symbol => {
            this.subscriptions.add(symbol);
            if (this.isConnected) {
                this.sendSubscriptionRequest(symbol);
            }
        });
    }

    private sendSubscriptionRequest(symbol: string): void {
        const ws = this.ws;
        if (!ws) return;

        const subscriptionMessage = {
            method: 'sub.ticker',
            param: { symbol: symbol.replace('/', '_') }
        };
        console.log(`[${this.marketIdentifier}] Inscrevendo-se em: ${symbol}`);
        ws.send(JSON.stringify(subscriptionMessage));
    }

    private onOpen(): void {
        console.log(`[${this.marketIdentifier}] Conexão WebSocket estabelecida.`);
        this.isConnected = true;
        this.startPing();

        // Inscreve-se em todos os pares registrados
        this.subscriptions.forEach(symbol => {
            this.sendSubscriptionRequest(symbol);
        });

        if (this.onConnectedCallback) {
            this.onConnectedCallback();
        }
    }

    private onMessage(data: WebSocket.Data): void {
        const ws = this.ws;
        if (!ws) return;

        try {
            const message = JSON.parse(data.toString());

            // Resposta ao ping do servidor
            if (message.method === 'ping') {
                ws.send(JSON.stringify({ method: 'pong' }));
                return;
            }

            // Confirmação de inscrição
            if (message.channel === 'rs.sub.ticker') {
                console.log(`[${this.marketIdentifier}] Inscrição confirmada para: ${message.data}`);
                return;
            }

            // Processamento de dados do ticker
            if (message.channel === 'push.ticker' && message.data) {
                const ticker = message.data;
                const symbol = ticker.symbol.replace('_', '/');
                const bestAsk = parseFloat(ticker.ask1);
                const bestBid = parseFloat(ticker.bid1);

                this.onPriceUpdate({
                    type: 'price-update',
                    symbol,
                    marketType: 'futures',
                    bestAsk,
                    bestBid,
                    identifier: this.marketIdentifier
                });
            }
        } catch (error) {
            console.error(`[${this.marketIdentifier}] Erro ao processar mensagem:`, error);
        }
    }

    private startPing(): void {
        this.stopPing();
        this.pingInterval = setInterval(() => {
            const ws = this.ws;
            if (ws?.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ method: "ping" }));
            }
        }, 20 * 1000);
    }

    private stopPing(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    private onClose(code: number, reason: string): void {
        console.warn(`[${this.marketIdentifier}] Conexão fechada. Código: ${code}. Reconectando em 5s...`);
        this.isConnected = false;
        this.stopPing();
        setTimeout(() => this.connect(), 5000);
    }

    private onError(error: Error): void {
        console.error(`[${this.marketIdentifier}] Erro no WebSocket:`, error.message);
    }
} 