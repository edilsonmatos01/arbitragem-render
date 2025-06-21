import WebSocket from 'ws';
import fetch from 'node-fetch';

export class MexcConnector {
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
            console.log('\n[MEXC] Iniciando conexão WebSocket...');
            this.ws = new WebSocket('wss://contract.mexc.com/ws');

            this.ws.on('open', () => {
                console.log('[MEXC] WebSocket conectado');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.onConnect();
            });

            this.ws.on('message', (data: WebSocket.Data) => {
                try {
                    const message = JSON.parse(data.toString());
                    
                    if (message.channel === 'push.ticker') {
                        const { symbol, bestAsk, bestBid } = message.data;
                        console.log(`\n[MEXC] Atualização de preço para ${symbol}`);
                        console.log(`Ask: ${bestAsk}, Bid: ${bestBid}`);
                        
                        this.onPriceUpdate({
                            type: 'price-update',
                            symbol: symbol.replace('_', '/'),
                            marketType: 'futures',
                            bestAsk: parseFloat(bestAsk),
                            bestBid: parseFloat(bestBid),
                            identifier: this.identifier
                        });
                    }
                } catch (error) {
                    console.error('[MEXC] Erro ao processar mensagem:', error);
                }
            });

            this.ws.on('close', (code: number, reason: string) => {
                console.log(`[MEXC] WebSocket fechado. Código: ${code}, Razão: ${reason}`);
                this.isConnected = false;

                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    console.log(`[MEXC] Tentando reconectar em ${this.reconnectDelay}ms...`);
                    setTimeout(() => this.connect(), this.reconnectDelay);
                    this.reconnectAttempts++;
                } else {
                    console.error('[MEXC] Número máximo de tentativas de reconexão atingido');
                }
            });

            this.ws.on('error', (error: Error) => {
                console.error('[MEXC] Erro na conexão WebSocket:', error);
            });

        } catch (error) {
            console.error('[MEXC] Erro ao conectar:', error);
            throw error;
        }
    }

    async getTradablePairs(): Promise<string[]> {
        try {
            console.log('[MEXC] Buscando pares negociáveis...');
            const response = await fetch('https://contract.mexc.com/api/v1/contract/detail');
            const data = await response.json();
            const pairs = data.data
                .filter((pair: any) => !pair.maintainMarginRate)
                .map((pair: any) => pair.symbol);
            console.log(`[MEXC] ${pairs.length} pares encontrados`);
            console.log('Primeiros 5 pares:', pairs.slice(0, 5));
            return pairs;
        } catch (error) {
            console.error('[MEXC] Erro ao buscar pares:', error);
            throw error;
        }
    }

    subscribe(pairs: string[]) {
        if (!this.ws || !this.isConnected) {
            console.error('[MEXC] WebSocket não está conectado');
            return;
        }

        try {
            console.log(`\n[MEXC] Inscrevendo-se em ${pairs.length} pares`);
            pairs.forEach(pair => {
                const subscribeMessage = {
                    method: 'SUBSCRIPTION',
                    params: [`spot.ticker.${pair}`]
                };

                this.ws?.send(JSON.stringify(subscribeMessage));
            });
            console.log('[MEXC] Mensagens de inscrição enviadas');
            console.log('Primeiros 5 pares inscritos:', pairs.slice(0, 5));
        } catch (error) {
            console.error('[MEXC] Erro ao se inscrever nos pares:', error);
        }
    }
} 