import WebSocket from 'ws';
import { EventEmitter } from 'events';
import fetch from 'node-fetch';

const GATEIO_WS_URL = 'wss://fx-ws.gateio.ws/v4/ws/usdt';

export class MexcFuturesConnector extends EventEmitter {
    private ws: WebSocket | null = null;
    private readonly identifier: string;
    private readonly onPriceUpdate: (data: any) => void;
    private readonly onConnect: () => void;
    private isConnected: boolean = false;
    private isConnecting: boolean = false;
    private reconnectAttempts: number = 0;
    private readonly maxReconnectAttempts: number = 5;
    private readonly reconnectDelay: number = 5000;
    private readonly REST_URL = 'https://api.gateio.ws/api/v4/futures/usdt/contracts';
    private subscribedSymbols: Set<string> = new Set();

    constructor(identifier: string, onPriceUpdate: (data: any) => void, onConnect: () => void) {
        super();
        this.identifier = identifier;
        this.onPriceUpdate = onPriceUpdate;
        this.onConnect = onConnect;
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
        console.log(`[${this.identifier}] Conectando...`);
        
        try {
            this.ws = new WebSocket('wss://contract.mexc.com/edge');

            this.ws.on('open', () => {
                console.log(`[${this.identifier}] Conexão estabelecida`);
                this.isConnected = true;
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                this.onConnect();
            });

            this.ws.on('message', (data: WebSocket.Data) => {
                try {
                    const message = JSON.parse(data.toString());
                    if (message.channel === 'push.ticker') {
                        const ticker = message.data;
                        this.onPriceUpdate({
                            identifier: this.identifier,
                            symbol: ticker.symbol.replace('_', '/').toUpperCase(),
                            marketType: 'futures',
                            bestAsk: parseFloat(ticker.ask),
                            bestBid: parseFloat(ticker.bid)
                        });
                    }
                } catch (error) {
                    console.error(`[${this.identifier}] Erro ao processar mensagem:`, error);
                }
            });

            this.ws.on('close', () => {
                console.log(`[${this.identifier}] Conexão fechada`);
                this.handleDisconnect();
            });

            this.ws.on('error', (error: Error) => {
                console.error(`[${this.identifier}] Erro na conexão:`, error);
                this.handleDisconnect();
            });

            // Inicia heartbeat
            this.startHeartbeat();

        } catch (error) {
            console.error(`[${this.identifier}] Erro ao criar WebSocket:`, error);
            this.handleDisconnect();
        }
    }

    private startHeartbeat(): void {
        if (!this.ws) return;

        setInterval(() => {
            if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
                this.ws.ping();
            }
        }, 20000);
    }

    private handleDisconnect(): void {
        this.isConnected = false;
        this.isConnecting = false;

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            console.log(`[${this.identifier}] Tentando reconectar em ${delay}ms...`);
            setTimeout(() => this.connect(), delay);
        } else {
            console.error(`[${this.identifier}] Máximo de tentativas de reconexão atingido`);
        }
    }

    public subscribe(symbols: string[]): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log(`[${this.identifier}] WebSocket não está pronto para subscrição`);
            return;
        }

        symbols.forEach(symbol => {
            const formattedSymbol = symbol.replace('/', '').toLowerCase();
            const msg = { method: 'sub.ticker', param: { symbol: formattedSymbol } };
            this.ws?.send(JSON.stringify(msg));
        });
    }

    public disconnect(): void {
        console.log(`[${this.identifier}] Desconectando...`);
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
        this.isConnecting = false;
    }

    async getTradablePairs(): Promise<string[]> {
        try {
            console.log(`[${this.identifier}] Buscando pares negociáveis...`);
            const response = await fetch(this.REST_URL);
            const data = await response.json();
            
            if (!Array.isArray(data)) {
                throw new Error('Formato de resposta inválido');
            }

            const pairs = data
                .filter((contract: any) => contract.in_delisting === false)
                .map((contract: any) => contract.name.replace('_', '/'));

            console.log(`[${this.identifier}] ${pairs.length} pares encontrados`);
            console.log('Primeiros 5 pares:', pairs.slice(0, 5));
            return pairs;
        } catch (error) {
            console.error(`[${this.identifier}] Erro ao buscar pares:`, error);
            return [];
        }
    }
} 