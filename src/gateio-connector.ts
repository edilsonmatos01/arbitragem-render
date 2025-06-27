import WebSocket from 'ws';
import fetch from 'node-fetch';
import { CustomWebSocket, ExchangeConnector, PriceUpdate } from './types';

const GATEIO_WS_URL = 'wss://api.gateio.ws/ws/v4/';

/**
 * Gerencia a conexão WebSocket e as inscrições para os feeds da Gate.io.
 * Pode ser configurado para SPOT ou FUTURES.
 */
export class GateIoConnector implements ExchangeConnector {
    private ws: CustomWebSocket | null = null;
    private readonly identifier: string;
    private readonly marketType: 'spot' | 'futures';
    private readonly onPriceUpdate: (data: PriceUpdate) => void;
    private readonly onConnect: () => void;
    
    private subscriptionQueue: string[] = [];
    private isConnected: boolean = false;
    private isConnecting: boolean = false;
    private reconnectAttempts: number = 0;
    private readonly maxReconnectAttempts: number = 5;
    private readonly baseReconnectDelay: number = 5000;
    private readonly maxReconnectDelay: number = 300000;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private readonly HEARTBEAT_INTERVAL = 20000;

    constructor(
        identifier: string,
        onPriceUpdate: (data: PriceUpdate) => void,
        onConnect: () => void
    ) {
        this.identifier = identifier;
        this.marketType = identifier.includes('_SPOT') ? 'spot' : 'futures';
        this.onPriceUpdate = onPriceUpdate;
        this.onConnect = onConnect;
        console.log(`[${this.identifier}] Conector inicializado.`);
    }

    public async getTradablePairs(): Promise<string[]> {
        const endpoint = this.marketType === 'spot'
            ? 'https://api.gateio.ws/api/v4/spot/currency_pairs'
            : 'https://api.gateio.ws/api/v4/futures/usdt/contracts';

        try {
            console.log(`[${this.identifier}] Buscando pares negociáveis de ${endpoint}`);
            const response = await fetch(endpoint);
            
            if (!response.ok) {
                throw new Error(`Falha na API: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!Array.isArray(data)) {
                console.warn(`[${this.identifier}] A resposta da API não foi uma lista (possível geoblocking).`);
                return [];
            }

            if (this.marketType === 'spot') {
                return data
                    .filter((p: any) => p.trade_status === 'tradable' && p.quote === 'USDT')
                    .map((p: any) => p.id.replace('_', '/'));
            } else {
                return data
                    .filter((c: any) => c.in_delisting === false)
                    .map((c: any) => c.name.replace('_', '/'));
            }
        } catch (error) {
            console.error(`[${this.identifier}] Erro ao buscar pares negociáveis:`, error);
            return [];
        }
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
        console.log(`[${this.identifier}] Conectando a ${GATEIO_WS_URL}`);
        
        try {
            this.ws = new WebSocket(GATEIO_WS_URL) as CustomWebSocket;
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
        if (!symbols || symbols.length === 0) {
            console.warn(`[${this.identifier}] Lista de pares vazia ou inválida`);
            return;
        }

        this.subscriptionQueue = symbols.map(p => p.replace('/', '_'));
        
        if (this.isConnected && this.ws) {
            this.sendSubscriptions();
        }
    }

    private sendSubscriptions(): void {
        if (!this.ws || !this.isConnected) return;

        const channel = this.marketType === 'spot' ? 'spot.book_ticker' : 'futures.book_ticker';
        
        this.subscriptionQueue.forEach(symbol => {
            const subscription = {
                time: Math.floor(Date.now() / 1000),
                channel,
                event: 'subscribe',
                payload: [symbol]
            };

            this.ws?.send(JSON.stringify(subscription));
            console.log(`[${this.identifier}] Inscrito em ${symbol}`);
        });
    }

    private onOpen(): void {
        console.log(`[${this.identifier}] Conexão estabelecida`);
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeat();

        if (this.subscriptionQueue.length > 0) {
            this.sendSubscriptions();
        }

        this.onConnect();
    }

    private onMessage(data: WebSocket.Data): void {
        try {
            const message = JSON.parse(data.toString());

            if (message.event === 'update' && (message.channel === 'spot.book_ticker' || message.channel === 'futures.book_ticker')) {
                const ticker = message.result;
                const symbol = ticker.s || ticker.currency_pair;
                const pair = symbol.replace('_', '/');

                const bestAsk = parseFloat(ticker.a || ticker.ask);
                const bestBid = parseFloat(ticker.b || ticker.bid);

                if (!bestAsk || !bestBid) return;

                this.onPriceUpdate({
                    identifier: this.identifier,
                    symbol: pair,
                    marketType: this.marketType,
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