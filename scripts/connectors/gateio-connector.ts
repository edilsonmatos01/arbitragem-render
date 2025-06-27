import WebSocket from 'ws';
import fetch from 'node-fetch';
import { EventEmitter } from 'events';

const GATEIO_WS_URL = 'wss://api.gateio.ws/ws/v4/';

interface PriceUpdate {
    identifier: string;
    symbol: string;
    marketType: 'spot' | 'futures';
    bestAsk: number;
    bestBid: number;
}

/**
 * Gerencia a conexão WebSocket e as inscrições para os feeds da Gate.io.
 * Pode ser configurado para SPOT ou FUTURES.
 */
export class GateIoConnector extends EventEmitter {
    private ws: WebSocket | null = null;
    private marketIdentifier: string; // Ex: 'GATEIO_SPOT' ou 'GATEIO_FUTURES'
    private marketType: 'spot' | 'futures';
    private priceUpdateCallback: (data: PriceUpdate) => void;
    
    private subscriptionQueue: string[] = [];
    private pingInterval: NodeJS.Timeout | null = null;
    private reconnectTimeout: NodeJS.Timeout | null = null;

    constructor(identifier: string, priceUpdateCallback: (data: PriceUpdate) => void) {
        super();
        this.marketIdentifier = identifier;
        this.marketType = identifier.includes('_SPOT') ? 'spot' : 'futures';
        this.priceUpdateCallback = priceUpdateCallback;
        console.log(`[${this.marketIdentifier}] Conector inicializado.`);
    }

    public async getTradablePairs(): Promise<string[]> {
        const endpoint = this.marketType === 'spot'
            ? 'https://api.gateio.ws/api/v4/spot/currency_pairs'
            : 'https://api.gateio.ws/api/v4/futures/usdt/contracts';

        try {
            console.log(`[${this.marketIdentifier}] Buscando pares negociáveis de ${endpoint}`);
            const response = await fetch(endpoint);
            if (!response.ok) {
                throw new Error(`Falha na API: ${response.statusText}`);
            }
            const data = await response.json();

            if (!Array.isArray(data)) {
                 console.warn(`[${this.marketIdentifier}] A resposta da API não foi uma lista (possível geoblocking).`);
                 return [];
            }

            if (this.marketType === 'spot') {
                return data
                    .filter(p => p.trade_status === 'tradable' && p.quote === 'USDT')
                    .map(p => p.id.replace('_', '/')); // Converte 'BTC_USDT' para 'BTC/USDT'
            } else {
                return data
                    .filter(c => c.in_delisting === false)
                    .map(c => c.name.replace('_', '/')); // Converte 'BTC_USDT' para 'BTC/USDT'
            }
        } catch (error) {
            console.error(`[${this.marketIdentifier}] Erro ao buscar pares negociáveis:`, error);
            return [];
        }
    }

    public connect(pairs: string[]): void {
        if (!pairs || pairs.length === 0) {
            console.warn(`[${this.marketIdentifier}] Lista de pares vazia ou inválida`);
            return;
        }
        
        this.subscriptionQueue = pairs.map(p => p.replace('/', '_')); // Gate.io usa '_'

        if (this.ws) {
            this.ws.close();
        }

        console.log(`[${this.marketIdentifier}] Conectando a ${GATEIO_WS_URL}`);
        this.ws = new WebSocket(GATEIO_WS_URL);

        this.ws.on('open', this.onOpen.bind(this));
        this.ws.on('message', this.onMessage.bind(this));
        this.ws.on('close', this.onClose.bind(this));
        this.ws.on('error', this.onError.bind(this));
    }

    private onOpen(): void {
        console.log(`[${this.marketIdentifier}] Conexão WebSocket estabelecida.`);
        this.startPinging();
        this.processSubscriptionQueue();
    }

    private onMessage(data: any): void {
        try {
            const message = JSON.parse(data.toString());
            
            if (message.channel === 'spot.ping' || message.channel === 'futures.ping') {
                return; // Ignora pongs
            }

            if (message.event === 'update' && message.result) {
                this.handleTickerUpdate(message.result);
            }
        } catch (error) {
            console.error(`[${this.marketIdentifier}] Erro ao processar mensagem:`, error);
        }
    }

    private handleTickerUpdate(ticker: any): void {
        const pair = (ticker.currency_pair || ticker.contract).replace('_', '/');
        
        const priceData = {
            bestAsk: parseFloat(ticker.lowest_ask || ticker.ask1),
            bestBid: parseFloat(ticker.highest_bid || ticker.bid1),
        };

        if (!priceData.bestAsk || !priceData.bestBid) return;

        this.priceUpdateCallback({
            identifier: this.marketIdentifier,
            symbol: pair,
            marketType: this.marketType,
            bestAsk: priceData.bestAsk,
            bestBid: priceData.bestBid,
        });
    }

    private processSubscriptionQueue(): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.subscriptionQueue.length === 0) {
            return;
        }

        const channel = this.marketType === 'spot' ? 'spot.tickers' : 'futures.tickers';
        
        const payload = this.subscriptionQueue;
        this.subscriptionQueue = []; // Limpa a fila

        const msg = {
            time: Math.floor(Date.now() / 1000),
            channel: channel,
            event: 'subscribe',
            payload: payload,
        };

        this.ws.send(JSON.stringify(msg));
        console.log(`[${this.marketIdentifier}] Enviada inscrição para ${payload.length} pares.`);
    }

    private onClose(): void {
        console.warn(`[${this.marketIdentifier}] Conexão fechada. Tentando reconectar em 5s...`);
        this.stopPinging();
        this.ws = null;
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        
        if (this.subscriptionQueue && this.subscriptionQueue.length > 0) {
            this.reconnectTimeout = setTimeout(() => this.connect(this.subscriptionQueue.map(p => p.replace('_','/'))), 5000);
        }
    }

    private onError(error: Error): void {
        console.error(`[${this.marketIdentifier}] Erro no WebSocket:`, error.message);
    }

    private startPinging(): void {
        this.stopPinging();
        this.pingInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                const channel = this.marketType === 'spot' ? 'spot.ping' : 'futures.ping';
                this.ws.send(JSON.stringify({ time: Math.floor(Date.now() / 1000), channel }));
            }
        }, 20000);
    }

    private stopPinging(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    public disconnect(): void {
        console.log(`[${this.marketIdentifier}] Desconectando...`);
        this.stopPinging();
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
} 