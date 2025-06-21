const WebSocket = require('ws');
import fetch from 'node-fetch';

export class GateIoFuturesConnector {
    private ws: any = null;
    private readonly identifier: string;
    private readonly onPriceUpdate: Function;
    private readonly onConnect: Function;
    private isConnected: boolean = false;
    private reconnectAttempts: number = 0;
    private readonly maxReconnectAttempts: number = 5;
    private readonly reconnectDelay: number = 5000;
    private readonly WS_URL = 'wss://fx-ws.gateio.ws/v4/ws/usdt';
    private readonly REST_URL = 'https://api.gateio.ws/api/v4';
    private subscribedSymbols: Set<string> = new Set();

    constructor(identifier: string, onPriceUpdate: Function, onConnect: Function) {
        this.identifier = identifier;
        this.onPriceUpdate = onPriceUpdate;
        this.onConnect = onConnect;
        console.log(`[${this.identifier}] Conector instanciado.`);
    }

    async connect() {
        try {
            console.log(`\n[${this.identifier}] Iniciando conexão WebSocket...`);
            this.ws = new WebSocket(this.WS_URL);

            this.ws.on('open', () => {
                console.log(`[${this.identifier}] WebSocket conectado`);
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.resubscribeAll();
                this.onConnect();
            });

            this.ws.on('message', (data: any) => {
                try {
                    const message = JSON.parse(data.toString());
                    
                    // Log para debug
                    console.log(`\n[${this.identifier}] Mensagem recebida:`, message);

                    // Processa atualizações de ticker
                    if (message.event === 'update' && message.channel === 'futures.book_ticker') {
                        const { s: symbol, a: ask, b: bid } = message.result;
                        const formattedSymbol = symbol.replace('_', '/');

                        if (ask && bid) {
                            this.onPriceUpdate({
                                type: 'price-update',
                                symbol: formattedSymbol,
                                marketType: 'futures',
                                bestAsk: parseFloat(ask),
                                bestBid: parseFloat(bid),
                                identifier: this.identifier
                            });
                        }
                    }
                } catch (error) {
                    console.error(`[${this.identifier}] Erro ao processar mensagem:`, error);
                }
            });

            this.ws.on('close', (code: number, reason: string) => {
                console.log(`[${this.identifier}] WebSocket fechado. Código: ${code}, Razão: ${reason}`);
                this.isConnected = false;

                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    console.log(`[${this.identifier}] Tentando reconectar em ${this.reconnectDelay}ms...`);
                    setTimeout(() => this.connect(), this.reconnectDelay);
                    this.reconnectAttempts++;
                } else {
                    console.error(`[${this.identifier}] Número máximo de tentativas de reconexão atingido`);
                }
            });

            this.ws.on('error', (error: Error) => {
                console.error(`[${this.identifier}] Erro na conexão WebSocket:`, error);
            });

        } catch (error) {
            console.error(`[${this.identifier}] Erro ao conectar:`, error);
            throw error;
        }
    }

    async getTradablePairs(): Promise<string[]> {
        try {
            console.log(`[${this.identifier}] Buscando pares negociáveis...`);
            const response = await fetch(`${this.REST_URL}/futures/usdt/contracts`);
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