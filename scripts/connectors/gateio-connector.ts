import WebSocket from 'ws';
import fetch from 'node-fetch';

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

/**
 * Gerencia a conexão WebSocket e as inscrições para os feeds da Gate.io.
 * Pode ser configurado para SPOT ou FUTURES.
 */
export class GateIoConnector {
    private ws: WebSocket | null = null;
    private readonly baseUrl = 'https://api.gateio.ws/api/v4';
    private readonly wsUrl = 'wss://api.gateio.ws/ws/v4/';
    private readonly identifier: string;
    private readonly onPriceUpdate: (update: PriceUpdate) => void;

    constructor(identifier: string, onPriceUpdate: (update: PriceUpdate) => void) {
        this.identifier = identifier;
        this.onPriceUpdate = onPriceUpdate;
    }

    public async getAvailablePairs(): Promise<ExchangePair[]> {
        try {
            const response = await fetch(`${this.baseUrl}/spot/currency_pairs`);
            const data = await response.json() as any[];
            
            return data
                .filter(pair => pair.trade_status === 'tradable')
                .map(pair => ({
                    symbol: pair.id.replace('_', '/').toUpperCase(),
                    active: true
                }));
        } catch (error) {
            console.error('Erro ao obter pares do Gate.io:', error);
            return [];
        }
    }

    public async connect(symbols: string[]): Promise<void> {
        if (this.ws) {
            await this.disconnect();
        }

        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.wsUrl);

                this.ws.on('open', () => {
                    console.log('[GATEIO_SPOT] Conexão WebSocket estabelecida.');

                    // Inscreve em todos os pares fornecidos
                    const subscribePayload = {
                        time: Math.floor(Date.now() / 1000),
                        channel: 'spot.order_book',
                        event: 'subscribe',
                        payload: symbols.map(symbol => symbol.replace('/', '_').toLowerCase())
                    };

                    if (this.ws) {
                        this.ws.send(JSON.stringify(subscribePayload));
                        console.log(`[GATEIO_SPOT] Enviada inscrição para ${symbols.length} pares.`);
                    }

                    resolve();
                });

                this.ws.on('message', (data: Buffer) => {
                    try {
                        const message = JSON.parse(data.toString());
                        
                        if (message.event === 'update' && message.channel === 'spot.order_book') {
                            const symbol = message.result?.s?.replace('_', '/').toUpperCase();
                            if (symbol && message.result?.b?.[0] && message.result?.a?.[0]) {
                                const update: PriceUpdate = {
                                    identifier: this.identifier,
                                    symbol,
                                    marketType: 'spot',
                                    bestBid: parseFloat(message.result.b[0][0]),
                                    bestAsk: parseFloat(message.result.a[0][0])
                                };
                                this.onPriceUpdate(update);
                            }
                        }
                    } catch (error) {
                        console.error('[GATEIO_SPOT] Erro ao processar mensagem:', error);
                    }
                });

                this.ws.on('error', (error) => {
                    console.error('[GATEIO_SPOT] Erro na conexão WebSocket:', error);
                    reject(error);
                });

                this.ws.on('close', () => {
                    console.log('[GATEIO_SPOT] Conexão WebSocket fechada.');
                    this.reconnect(symbols);
                });

            } catch (error) {
                console.error('[GATEIO_SPOT] Erro ao conectar:', error);
                reject(error);
            }
        });
    }

    private async reconnect(symbols: string[]): Promise<void> {
        console.log('[GATEIO_SPOT] Tentando reconectar...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        await this.connect(symbols);
    }

    public async disconnect(): Promise<void> {
        return new Promise((resolve) => {
            if (this.ws) {
                this.ws.on('close', () => {
                    this.ws = null;
                    resolve();
                });
                this.ws.close();
            } else {
                resolve();
            }
        });
    }
} 