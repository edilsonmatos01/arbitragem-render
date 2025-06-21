import WebSocket from 'ws';
import fetch from 'node-fetch';

const GATEIO_WS_URL = 'wss://api.gateio.ws/ws/v4/';

type PriceUpdateCallback = (update: { 
    type: string;
    symbol: string;
    marketType: string;
    bestAsk: number;
    bestBid: number;
    identifier: string;
}) => void;

/**
 * Gerencia a conexão WebSocket e as inscrições para os feeds da Gate.io.
 * Pode ser configurado para SPOT ou FUTURES.
 */
export class GateIoConnector {
    private ws: WebSocket | null = null;
    private readonly identifier: string;
    private readonly onPriceUpdate: Function;
    private readonly onConnect: Function;
    private isConnected: boolean = false;
    private reconnectAttempts: number = 0;
    private readonly maxReconnectAttempts: number = 5;
    private readonly reconnectDelay: number = 5000;

    constructor(identifier: string, onPriceUpdate: Function, onConnect: Function) {
        this.identifier = identifier;
        this.onPriceUpdate = onPriceUpdate;
        this.onConnect = onConnect;
    }

    async connect() {
        try {
            console.log('\n[GateIO] Iniciando conexão WebSocket...');
            this.ws = new WebSocket('wss://api.gateio.ws/ws/v4/');

            this.ws.on('open', () => {
                console.log('[GateIO] WebSocket conectado');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.onConnect();
            });

            this.ws.on('message', (data: WebSocket.Data) => {
                try {
                    const message = JSON.parse(data.toString());
                    
                    if (message.event === 'update' && message.channel === 'spot.book_ticker') {
                        const { currency_pair, ask, bid } = message.result;
                        console.log(`\n[GateIO] Atualização de preço para ${currency_pair}`);
                        console.log(`Ask: ${ask}, Bid: ${bid}`);
                        
                        this.onPriceUpdate({
                            type: 'price-update',
                            symbol: currency_pair,
                            marketType: 'spot',
                            bestAsk: parseFloat(ask),
                            bestBid: parseFloat(bid),
                            identifier: this.identifier
                        });
                    }
                } catch (error) {
                    console.error('[GateIO] Erro ao processar mensagem:', error);
                }
            });

            this.ws.on('close', (code: number, reason: string) => {
                console.log(`[GateIO] WebSocket fechado. Código: ${code}, Razão: ${reason}`);
                this.isConnected = false;

                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    console.log(`[GateIO] Tentando reconectar em ${this.reconnectDelay}ms...`);
                    setTimeout(() => this.connect(), this.reconnectDelay);
                    this.reconnectAttempts++;
                } else {
                    console.error('[GateIO] Número máximo de tentativas de reconexão atingido');
                }
            });

            this.ws.on('error', (error: Error) => {
                console.error('[GateIO] Erro na conexão WebSocket:', error);
            });

        } catch (error) {
            console.error('[GateIO] Erro ao conectar:', error);
            throw error;
        }
    }

    async getTradablePairs(): Promise<string[]> {
        try {
            console.log('[GateIO] Buscando pares negociáveis...');
            const response = await fetch('https://api.gateio.ws/api/v4/spot/currency_pairs');
            const data = await response.json();
            const pairs = data
                .filter((pair: any) => pair.trade_status === 'tradable')
                .map((pair: any) => pair.id);
            console.log(`[GateIO] ${pairs.length} pares encontrados`);
            console.log('Primeiros 5 pares:', pairs.slice(0, 5));
            return pairs;
        } catch (error) {
            console.error('[GateIO] Erro ao buscar pares:', error);
            throw error;
        }
    }

    subscribe(pairs: string[]) {
        if (!this.ws || !this.isConnected) {
            console.error('[GateIO] WebSocket não está conectado');
            return;
        }

        try {
            console.log(`\n[GateIO] Inscrevendo-se em ${pairs.length} pares`);
            const subscribeMessage = {
                time: Math.floor(Date.now() / 1000),
                channel: 'spot.book_ticker',
                event: 'subscribe',
                payload: pairs
            };

            this.ws.send(JSON.stringify(subscribeMessage));
            console.log('[GateIO] Mensagem de inscrição enviada');
            console.log('Primeiros 5 pares inscritos:', pairs.slice(0, 5));
        } catch (error) {
            console.error('[GateIO] Erro ao se inscrever nos pares:', error);
        }
    }
} 