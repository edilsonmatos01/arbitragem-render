const WS = require('ws');
import { EventEmitter } from 'events';

const MEXC_SPOT_WS_URL = 'wss://wbs.mexc.com/ws';

export class MexcConnector extends EventEmitter {
    private ws: any = null;
    private readonly marketIdentifier: string;
    private readonly onPriceUpdate: (data: any) => void;
    private readonly onConnectedCallback: (() => void) | null;
    private isConnected: boolean = false;
    private isConnecting: boolean = false;
    private reconnectAttempts: number = 0;
    private readonly maxReconnectAttempts: number = 10;
    private readonly reconnectDelay: number = 3000;
    private subscriptions: Set<string> = new Set();
    private pingInterval: NodeJS.Timeout | null = null;
    private pingTimeout: NodeJS.Timeout | null = null;
    private pendingSubscriptions: string[] = [];
    private lastPingTime: number = 0;

    constructor(identifier: string, onPriceUpdate: (data: any) => void, onConnect: () => void) {
        super();
        this.marketIdentifier = identifier;
        this.onPriceUpdate = onPriceUpdate;
        this.onConnectedCallback = onConnect;
        
        if (process && typeof process.on === 'function') {
            process.on('SIGINT', () => {
                console.log(`[${this.marketIdentifier}] Recebido SIGINT, desconectando...`);
                this.disconnect();
                process.exit(0);
            });
        }
        
        console.log(`[${this.marketIdentifier}] Conector instanciado.`);
    }

    public connect(): void {
        if (this.isConnecting) {
            console.log(`[${this.marketIdentifier}] Conexão já em andamento.`);
            return;
        }

        if (this.ws) {
            console.log(`[${this.marketIdentifier}] Fechando conexão existente...`);
            this.ws.terminate();
            this.ws = null;
        }

        this.isConnecting = true;
        console.log(`[${this.marketIdentifier}] Conectando a ${MEXC_SPOT_WS_URL}`);
        
        try {
            this.ws = new WS(MEXC_SPOT_WS_URL);

            if (!this.ws) {
                throw new Error('Falha ao criar WebSocket');
            }

            const connectionTimeout = setTimeout(() => {
                if (!this.isConnected) {
                    console.log(`[${this.marketIdentifier}] Timeout na conexão inicial`);
                    this.handleDisconnect();
                }
            }, 30000);

            this.ws.on('open', () => {
                clearTimeout(connectionTimeout);
                console.log(`[${this.marketIdentifier}] Conexão WebSocket estabelecida.`);
                this.isConnected = true;
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                this.startHeartbeat();
                
                if (this.pendingSubscriptions.length > 0) {
                    console.log(`[${this.marketIdentifier}] Processando ${this.pendingSubscriptions.length} subscrições pendentes...`);
                    setTimeout(() => {
                        this.sendSubscriptionRequests(this.pendingSubscriptions);
                        this.pendingSubscriptions = [];
                    }, 1000);
                }
                
                if (this.onConnectedCallback) {
                    this.onConnectedCallback();
                }
            });

            this.ws.on('pong', () => {
                this.lastPingTime = Date.now();
                if (this.pingTimeout) {
                    clearTimeout(this.pingTimeout);
                    this.pingTimeout = null;
                }
                console.log(`[${this.marketIdentifier}] Pong recebido`);
            });

            this.ws.on('message', (data: Buffer) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.lastPingTime = Date.now();
                    
                    if (message.c === 'spot.ticker') {
                        const ticker = message.d;
                        const pair = ticker.s.replace('_', '/').toUpperCase();
                        
                        const priceData = {
                            bestAsk: parseFloat(ticker.a),
                            bestBid: parseFloat(ticker.b),
                        };

                        if (!priceData.bestAsk || !priceData.bestBid) {
                            console.log(`[${this.marketIdentifier}] Preços inválidos recebidos:`, ticker);
                            return;
                        }

                        this.onPriceUpdate({
                            type: 'price-update',
                            symbol: pair,
                            marketType: 'spot',
                            bestAsk: priceData.bestAsk,
                            bestBid: priceData.bestBid,
                            identifier: this.marketIdentifier
                        });
                    } else if (message.code !== undefined) {
                        console.log(`[${this.marketIdentifier}] Resposta da API:`, message);
                        if (message.code !== 0) {
                            console.error(`[${this.marketIdentifier}] Erro na resposta:`, message);
                        }
                    }
                } catch (error) {
                    console.error(`[${this.marketIdentifier}] Erro ao processar mensagem:`, error);
                }
            });

            this.ws.on('close', (code: number, reason: string) => {
                clearTimeout(connectionTimeout);
                console.log(`[${this.marketIdentifier}] Conexão fechada. Código: ${code}, Razão: ${reason || 'Não especificada'}`);
                this.handleDisconnect();
            });

            this.ws.on('error', (error: Error) => {
                clearTimeout(connectionTimeout);
                console.error(`[${this.marketIdentifier}] Erro na conexão:`, error);
                this.handleDisconnect();
            });

        } catch (error) {
            console.error(`[${this.marketIdentifier}] Erro ao criar WebSocket:`, error);
            this.handleDisconnect();
        }
    }

    private startHeartbeat(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }

        this.pingInterval = setInterval(() => {
            if (this.isConnected && this.ws?.readyState === 1) { // 1 = OPEN
                try {
                    const pingMsg = { method: "ping" };
                    console.log(`[${this.marketIdentifier}] Enviando ping`);
                    this.ws.ping();
                    
                    if (this.pingTimeout) {
                        clearTimeout(this.pingTimeout);
                    }
                    
                    this.pingTimeout = setTimeout(() => {
                        console.error(`[${this.marketIdentifier}] Timeout no ping`);
                        this.handleDisconnect();
                    }, 5000);
                    
                    this.ws.send(JSON.stringify(pingMsg));
                } catch (error) {
                    console.error(`[${this.marketIdentifier}] Erro ao enviar ping:`, error);
                    this.handleDisconnect();
                }
            }
        }, 15000);
    }

    private handleDisconnect(): void {
        this.isConnected = false;
        this.isConnecting = false;

        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }

        if (this.pingTimeout) {
            clearTimeout(this.pingTimeout);
            this.pingTimeout = null;
        }

        if (this.ws) {
            try {
                this.ws.terminate();
            } catch (error) {
                console.error(`[${this.marketIdentifier}] Erro ao terminar WebSocket:`, error);
            }
            this.ws = null;
        }

        this.pendingSubscriptions = Array.from(this.subscriptions);

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
            console.log(`[${this.marketIdentifier}] Tentando reconectar em ${delay}ms... (Tentativa ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => this.connect(), delay);
        } else {
            console.error(`[${this.marketIdentifier}] Máximo de tentativas de reconexão atingido. Reiniciando contador...`);
            this.reconnectAttempts = 0;
            setTimeout(() => this.connect(), this.reconnectDelay);
        }
    }

    public subscribe(symbols: string[]): void {
        console.log(`[${this.marketIdentifier}] Inscrevendo nos símbolos:`, symbols);
        symbols.forEach(symbol => this.subscriptions.add(symbol));
        
        if (this.isConnected && this.ws?.readyState === 1) { // 1 = OPEN
            setTimeout(() => {
                this.sendSubscriptionRequests(Array.from(this.subscriptions));
            }, 1000);
        } else {
            console.log(`[${this.marketIdentifier}] WebSocket não está pronto. Adicionando à fila de subscrições pendentes.`);
            this.pendingSubscriptions = Array.from(this.subscriptions);
            if (!this.isConnecting) {
                this.connect();
            }
        }
    }

    private sendSubscriptionRequests(symbols: string[]): void {
        if (!this.ws || this.ws.readyState !== 1) { // 1 = OPEN
            console.log(`[${this.marketIdentifier}] WebSocket não está pronto para subscrição`);
            this.pendingSubscriptions = symbols;
            return;
        }
        
        symbols.forEach((symbol, index) => {
            setTimeout(() => {
                if (!this.ws || this.ws.readyState !== 1) return; // 1 = OPEN
                
                const formattedSymbol = symbol.replace('/', '').toLowerCase();
                const msg = {
                    method: 'sub.ticker',
                    param: {
                        symbol: formattedSymbol
                    },
                    id: Date.now()
                };
                
                try {
                    console.log(`[${this.marketIdentifier}] Enviando subscrição:`, JSON.stringify(msg));
                    this.ws.send(JSON.stringify(msg));
                } catch (error) {
                    console.error(`[${this.marketIdentifier}] Erro ao enviar subscrição para ${symbol}:`, error);
                    this.pendingSubscriptions.push(symbol);
                }
            }, index * 100);
        });
    }

    public disconnect(): void {
        console.log(`[${this.marketIdentifier}] Desconectando...`);
        this.isConnected = false;
        this.isConnecting = false;
        
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }

        if (this.pingTimeout) {
            clearTimeout(this.pingTimeout);
            this.pingTimeout = null;
        }
        
        if (this.ws) {
            try {
                this.ws.terminate();
                this.ws = null;
            } catch (error) {
                console.error(`[${this.marketIdentifier}] Erro ao fechar WebSocket:`, error);
            }
        }
    }

    public async getTradablePairs(): Promise<string[]> {
        return [
            'BTC/USDT',
            'ETH/USDT',
            'SOL/USDT',
            'XRP/USDT',
            'BNB/USDT'
        ];
    }
} 