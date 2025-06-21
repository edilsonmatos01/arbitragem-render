const WebSocket = require('ws');
import fetch from 'node-fetch';
import { EventEmitter } from 'events';

interface MexcWebSocket {
    removeAllListeners: () => void;
    terminate: () => void;
    on: (event: string, listener: (...args: any[]) => void) => this;
    send: (data: string) => void;
    readyState: number;
    close: () => void;
    ping: () => void;
}

export class MexcConnector extends EventEmitter {
    private ws: MexcWebSocket | null = null;
    private readonly identifier: string;
    private readonly onPriceUpdate: Function;
    private readonly onConnect: Function;
    private isConnected: boolean = false;
    private isConnecting: boolean = false;
    private reconnectAttempts: number = 0;
    private readonly baseReconnectDelay: number = 5000; // 5 segundos
    private readonly maxReconnectDelay: number = 300000; // 5 minutos
    private readonly WS_URL = 'wss://wbs.mexc.com/ws';
    private readonly REST_URL = 'https://api.mexc.com/api/v3/exchangeInfo';
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private heartbeatTimeout: NodeJS.Timeout | null = null;
    private subscribedSymbols: Set<string> = new Set();
    private fallbackRestInterval: NodeJS.Timeout | null = null;
    private connectionStartTime: number = 0;
    private lastPongTime: number = 0;
    private readonly HEARTBEAT_INTERVAL = 20000; // 20 seconds
    private readonly HEARTBEAT_TIMEOUT = 10000; // 10 segundos
    private readonly REST_FALLBACK_INTERVAL = 30000; // 30 segundos
    private isBlocked: boolean = false;
    private readonly maxReconnectAttempts: number = 5;
    private readonly reconnectDelay: number = 5000;

    constructor(identifier: string, onPriceUpdate: Function, onConnect: Function) {
        super();
        this.identifier = identifier;
        this.onPriceUpdate = onPriceUpdate;
        this.onConnect = onConnect;
        console.log(`[${this.identifier}] Conector instanciado.`);
    }

    async connect() {
        if (this.isConnecting) {
            console.log(`[${this.identifier}] Já existe uma tentativa de conexão em andamento`);
            return;
        }

        try {
            this.isConnecting = true;
            this.connectionStartTime = Date.now();
            
            // Limpa conexão anterior se existir
            await this.cleanup();

            console.log(`\n[${this.identifier}] Iniciando conexão WebSocket...`);
            this.ws = new WebSocket(this.WS_URL) as MexcWebSocket;

            if (!this.ws) {
                throw new Error('Falha ao criar WebSocket');
            }

            this.ws.on('open', () => {
                console.log(`[${this.identifier}] WebSocket conectado`);
                this.isConnected = true;
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                this.lastPongTime = Date.now();
                this.startHeartbeat();
                
                if (this.subscribedSymbols.size > 0) {
                    this.resubscribeAll();
                }
                
                this.onConnect();
                this.stopRestFallback();
            });

            this.ws.on('message', (data: any) => {
                try {
                    const message = JSON.parse(data.toString());
                    
                    // Log para debug
                    console.log(`\n[${this.identifier}] Mensagem recebida:`, message);

                    // Handle pong response
                    if (message.method === 'PONG') {
                        console.log(`[${this.identifier}] Pong recebido`);
                        return;
                    }

                    // Handle subscription data
                    if (message.stream && message.stream.endsWith('@bookTicker')) {
                        const { s: symbol, a: ask, b: bid } = message.data;
                        
                        if (ask && bid) {
                            this.onPriceUpdate({
                                type: 'price-update',
                                symbol: symbol.replace('_', '/'),
                                marketType: 'spot',
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
                this.handleDisconnect();
            });

            this.ws.on('error', (error: Error) => {
                console.error(`[${this.identifier}] Erro na conexão WebSocket:`, error);
                this.handleDisconnect();
            });

            // Configura timeout para a conexão inicial
            setTimeout(() => {
                if (!this.isConnected) {
                    this.handleDisconnect();
                }
            }, 10000);

        } catch (error) {
            console.error(`[${this.identifier}] Erro ao conectar:`, error);
            this.handleDisconnect();
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
        console.log(`[${this.identifier}] Desconectado: Conexão fechada pelo servidor`);
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

    private scheduleReconnect() {
        // Não tenta reconectar se estiver bloqueado
        if (this.isBlocked) {
            return;
        }

        const delay = Math.min(
            this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
            this.maxReconnectDelay
        );

        this.reconnectAttempts++;
        console.log(`[${this.identifier}] Tentativa de reconexão ${this.reconnectAttempts} em ${delay/1000}s`);

        if (Date.now() - this.connectionStartTime > 300000) { // 5 minutos
            console.log(`[${this.identifier}] WebSocket não reconectou após múltiplas tentativas. Verifique a conexão.`);
        }

        setTimeout(() => this.connect(), delay);
    }

    private startHeartbeat() {
        this.stopHeartbeat();
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                const pingMessage = { "method": "PING" };
                this.ws.send(JSON.stringify(pingMessage));
                console.log(`[${this.identifier}] Ping enviado`);
            } catch (error) {
                console.error(`[${this.identifier}] Erro ao enviar ping:`, error);
                this.handleDisconnect();
            }
        }
    }

    private stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
        }
    }

    private updateLastPongTime() {
        this.lastPongTime = Date.now();
        if (this.heartbeatTimeout) {
            clearTimeout(this.heartbeatTimeout);
            this.heartbeatTimeout = null;
        }
    }

    private startRestFallback() {
        if (this.fallbackRestInterval) return;

        console.log(`[${this.identifier}] Iniciando fallback para REST API`);
        this.fallbackRestInterval = setInterval(async () => {
            try {
                for (const symbol of this.subscribedSymbols) {
                    const formattedSymbol = symbol.replace('/', '');
                    const response = await fetch(`${this.REST_URL}/ticker/price?symbol=${formattedSymbol}`);
                    const data = await response.json();
                    
                    if (data.price) {
                        const price = parseFloat(data.price);
                        this.onPriceUpdate({
                            type: 'price-update',
                            symbol: symbol,
                            marketType: 'spot',
                            bestAsk: price,
                            bestBid: price,
                            identifier: this.identifier
                        });
                    }
                }
            } catch (error) {
                console.error(`[${this.identifier}] Erro ao buscar preços via REST:`, error);
            }
        }, this.REST_FALLBACK_INTERVAL);
    }

    private stopRestFallback() {
        if (this.fallbackRestInterval) {
            clearInterval(this.fallbackRestInterval);
            this.fallbackRestInterval = null;
        }
    }

    private resubscribeAll() {
        const symbols = Array.from(this.subscribedSymbols);
        if (symbols.length > 0) {
            console.log(`[${this.identifier}] Reinscrevendo em ${symbols.length} pares...`);
            this.subscribe(symbols);
        }
    }

    async subscribe(symbols: string[]) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log(`[${this.identifier}] WebSocket não está conectado. Tentando reconectar...`);
            await this.connect();
            return;
        }

        for (const symbol of symbols) {
            try {
                const subscriptionMessage = {
                    method: "SUBSCRIPTION",
                    params: [
                        `${symbol.replace('/', '').toLowerCase()}@bookTicker`
                    ]
                };
                
                console.log(`[${this.identifier}] Inscrevendo-se em ${symbol}:`, subscriptionMessage);
                this.ws.send(JSON.stringify(subscriptionMessage));
            } catch (error) {
                console.error(`[${this.identifier}] Erro ao se inscrever em ${symbol}:`, error);
            }
        }
    }

    async getTradablePairs(): Promise<string[]> {
        try {
            console.log(`[${this.identifier}] Buscando pares negociáveis...`);
            const response = await fetch(this.REST_URL);
            const data = await response.json();
            
            console.log(`[${this.identifier}] Resposta da API:`, JSON.stringify(data).slice(0, 200) + '...');
            
            if (!data.symbols || !Array.isArray(data.symbols)) {
                console.error(`[${this.identifier}] Resposta inválida:`, data);
                return [];
            }

            const pairs = data.symbols
                .filter((symbol: any) => {
                    // Filtra apenas pares ativos e que terminam em USDT
                    return symbol.status === 'ENABLED' && 
                           symbol.quoteAsset === 'USDT' &&
                           // Adiciona validações extras para garantir que são pares válidos
                           symbol.symbol.endsWith('USDT');
                })
                .map((symbol: any) => {
                    const base = symbol.symbol.slice(0, -4); // Remove 'USDT'
                    return `${base}/USDT`;
                });

            console.log(`[${this.identifier}] ${pairs.length} pares encontrados`);
            if (pairs.length > 0) {
                console.log('Primeiros 5 pares:', pairs.slice(0, 5));
            }
            return pairs;
        } catch (error) {
            console.error(`[${this.identifier}] Erro ao buscar pares:`, error);
            return [];
        }
    }
} 