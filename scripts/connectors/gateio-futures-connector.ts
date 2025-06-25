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

export class GateIoFuturesConnector {
    private ws: WebSocket | null = null;
    private readonly baseUrl = 'https://api.gateio.ws/api/v4';
    private readonly wsUrl = 'wss://api.gateio.ws/ws/v4/';
    private readonly identifier: string;
    private readonly onPriceUpdate: (update: PriceUpdate) => void;
    private readonly onConnect: () => void;
    private isConnected: boolean = false;
    private reconnectAttempts: number = 0;
    private readonly maxReconnectAttempts: number = 5;
    private readonly reconnectDelay: number = 5000;
    private subscribedSymbols: Set<string> = new Set();

    constructor(
        identifier: string,
        onPriceUpdate: (update: PriceUpdate) => void,
        onConnect: () => void
    ) {
        this.identifier = identifier;
        this.onPriceUpdate = onPriceUpdate;
        this.onConnect = onConnect;
        console.log(`[${this.identifier}] Conector instanciado.`);
    }

    public async getAvailablePairs(): Promise<ExchangePair[]> {
        try {
            const response = await fetch(`${this.baseUrl}/futures/usdt/contracts`);
            const data = await response.json() as any[];
            
            return data
                .filter(pair => !pair.in_delisting && pair.trade_status !== 'delisting')
                .map(pair => ({
                    symbol: pair.name.replace('_', '/').toUpperCase(),
                    active: true
                }));
        } catch (error) {
            console.error('Erro ao obter pares do Gate.io Futures:', error);
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
                    console.log('[GATEIO_FUTURES] Conexão WebSocket estabelecida.');

                    // Inscreve em todos os pares fornecidos
                    const subscribePayload = {
                        time: Math.floor(Date.now() / 1000),
                        channel: 'futures.order_book',
                        event: 'subscribe',
                        payload: symbols.map(symbol => symbol.replace('/', '_').toLowerCase())
                    };

                    if (this.ws) {
                        this.ws.send(JSON.stringify(subscribePayload));
                        console.log(`[GATEIO_FUTURES] Enviada inscrição para ${symbols.length} pares.`);
                    }

                    this.onConnect();
                    resolve();
                });

                this.ws.on('message', (data: Buffer) => {
                    try {
                        const message = JSON.parse(data.toString());
                        
                        if (message.event === 'update' && message.channel === 'futures.order_book') {
                            const symbol = message.result?.s?.replace('_', '/').toUpperCase();
                            if (symbol && message.result?.b?.[0] && message.result?.a?.[0]) {
                                const update: PriceUpdate = {
                                    identifier: this.identifier,
                                    symbol,
                                    marketType: 'futures',
                                    bestBid: parseFloat(message.result.b[0][0]),
                                    bestAsk: parseFloat(message.result.a[0][0])
                                };
                                this.onPriceUpdate(update);
                            }
                        }
                    } catch (error) {
                        console.error('[GATEIO_FUTURES] Erro ao processar mensagem:', error);
                    }
                });

                this.ws.on('error', (error) => {
                    console.error('[GATEIO_FUTURES] Erro na conexão WebSocket:', error);
                    reject(error);
                });

                this.ws.on('close', () => {
                    console.log('[GATEIO_FUTURES] Conexão WebSocket fechada.');
                    this.reconnect(symbols);
                });

            } catch (error) {
                console.error('[GATEIO_FUTURES] Erro ao conectar:', error);
                reject(error);
            }
        });
    }

    private async reconnect(symbols: string[]): Promise<void> {
        console.log('[GATEIO_FUTURES] Tentando reconectar...');
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

    async getTradablePairs(): Promise<string[]> {
        try {
            console.log(`[${this.identifier}] Buscando pares negociáveis...`);
            const response = await fetch(`${this.baseUrl}/futures/usdt/contracts`);
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

    subscribe(pairs: string[]) {
        if (!this.ws || !this.isConnected) {
            console.error(`[${this.identifier}] WebSocket não está conectado`);
            return;
        }

        try {
            console.log(`\n[${this.identifier}] Inscrevendo-se em ${pairs.length} pares`);
            
            pairs.forEach(symbol => {
                const formattedSymbol = symbol.replace('/', '_');
                this.subscribedSymbols.add(symbol);

                const subscribeMessage = {
                    time: Math.floor(Date.now() / 1000),
                    channel: 'futures.book_ticker',
                    event: 'subscribe',
                    payload: [formattedSymbol]
                };

                this.ws.send(JSON.stringify(subscribeMessage));
            });

            console.log(`[${this.identifier}] Mensagens de inscrição enviadas`);
            console.log('Primeiros 5 pares inscritos:', pairs.slice(0, 5));
        } catch (error) {
            console.error(`[${this.identifier}] Erro ao se inscrever nos pares:`, error);
        }
    }

    private resubscribeAll() {
        const pairs = Array.from(this.subscribedSymbols);
        if (pairs.length > 0) {
            console.log(`[${this.identifier}] Reinscrevendo em ${pairs.length} pares...`);
            this.subscribe(pairs);
        }
    }
} 