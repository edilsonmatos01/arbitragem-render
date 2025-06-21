const WebSocket = require('ws');
import fetch from 'node-fetch';

export class MexcFuturesConnector {
    private ws: any = null;
    private readonly identifier: string;
    private readonly onPriceUpdate: Function;
    private readonly onConnect: Function;
    private isConnected: boolean = false;
    private reconnectAttempts: number = 0;
    private readonly maxReconnectAttempts: number = 5;
    private readonly reconnectDelay: number = 5000;
    private readonly WS_URL = 'wss://contract.mexc.com/edge';
    private readonly REST_URL = 'https://contract.mexc.com/api/v1';
    private subscribedSymbols: Set<string> = new Set();
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private readonly HEARTBEAT_INTERVAL = 20000; // 20 seconds

    constructor(identifier: string, onPriceUpdate: Function, onConnect: Function) {
        this.identifier = identifier;
        this.onPriceUpdate = onPriceUpdate;
        this.onConnect = onConnect;
        console.log(`[${this.identifier}] Conector instanciado.`);
    }

    private startHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        this.heartbeatInterval = setInterval(() => {
            if (this.ws && this.isConnected) {
                try {
                    const pingMessage = { "method": "ping" };
                    this.ws.send(JSON.stringify(pingMessage));
                    console.log(`[${this.identifier}] Ping enviado`);
                } catch (error) {
                    console.error(`[${this.identifier}] Erro ao enviar ping:`, error);
                    this.handleDisconnect();
                }
            }
        }, this.HEARTBEAT_INTERVAL);
    }

    private stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    private async cleanup() {
        this.stopHeartbeat();
        
        if (this.ws) {
            try {
                this.ws.removeAllListeners();
                if (this.ws.readyState === WebSocket.OPEN) {
                    this.ws.close();
                }
                this.ws = null;
            } catch (error) {
                console.error(`[${this.identifier}] Erro ao limpar conexão:`, error);
            }
        }
        
        this.isConnected = false;
    }

    private handleDisconnect() {
        this.cleanup().then(() => {
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                console.log(`[${this.identifier}] Tentando reconectar em ${this.reconnectDelay}ms...`);
                setTimeout(() => this.connect(), this.reconnectDelay);
                this.reconnectAttempts++;
            } else {
                console.error(`[${this.identifier}] Número máximo de tentativas de reconexão atingido`);
            }
        });
    }

    async connect() {
        try {
            await this.cleanup(); // Clean up before connecting
            console.log(`\n[${this.identifier}] Iniciando conexão WebSocket...`);
            this.ws = new WebSocket(this.WS_URL);

            this.ws.on('open', () => {
                console.log(`[${this.identifier}] WebSocket conectado`);
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.startHeartbeat();
                this.resubscribeAll();
                this.onConnect();
            });

            this.ws.on('message', (data: any) => {
                try {
                    const message = JSON.parse(data.toString());
                    
                    // Log para debug
                    console.log(`\n[${this.identifier}] Mensagem recebida:`, message);

                    // Handle pong response
                    if (message.method === 'pong') {
                        console.log(`[${this.identifier}] Pong recebido`);
                        return;
                    }

                    // Handle subscription confirmation
                    if (message.channel === 'rs.sub.ticker') {
                        if (message.code === 0) {
                            console.log(`[${this.identifier}] Subscrição confirmada para:`, message.data);
                        } else {
                            console.error(`[${this.identifier}] Erro na subscrição:`, message);
                            // Try to resubscribe if it's a temporary error
                            if (message.code === 1) {
                                const symbol = message.data?.symbol;
                                if (symbol) {
                                    setTimeout(() => {
                                        console.log(`[${this.identifier}] Tentando reinscrever em ${symbol}...`);
                                        this.subscribe([symbol.replace('_', '/')]);
                                    }, 5000);
                                }
                            }
                        }
                        return;
                    }

                    // Processa atualizações de ticker
                    if (message.symbol && message.data) {
                        const symbol = message.symbol.replace('_', '/');
                        const { ask1: bestAsk, bid1: bestBid } = message.data;

                        if (bestAsk && bestBid) {
                            this.onPriceUpdate({
                                type: 'price-update',
                                symbol: symbol,
                                marketType: 'futures',
                                bestAsk: parseFloat(bestAsk),
                                bestBid: parseFloat(bestBid),
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
                this.handleDisconnect();
            });

            this.ws.on('error', (error: Error) => {
                console.error(`[${this.identifier}] Erro na conexão WebSocket:`, error);
                this.handleDisconnect();
            });

        } catch (error) {
            console.error(`[${this.identifier}] Erro ao conectar:`, error);
            this.handleDisconnect();
        }
    }

    async getTradablePairs(): Promise<string[]> {
        try {
            console.log(`[${this.identifier}] Buscando pares negociáveis...`);
            const response = await fetch(`${this.REST_URL}/contract/detail`);
            const data = await response.json();
            
            if (!Array.isArray(data)) {
                throw new Error('Formato de resposta inválido');
            }

            const pairs = data
                .filter((contract: any) => contract.state === 'ENABLED')
                .map((contract: any) => contract.symbol.replace('_', '/'));

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
                    "method": "sub.ticker",
                    "param": {
                        "symbol": formattedSymbol
                    }
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