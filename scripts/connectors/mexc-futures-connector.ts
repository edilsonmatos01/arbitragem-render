const WebSocket = require('ws');
import fetch from 'node-fetch';

interface MexcWebSocket {
    removeAllListeners: () => void;
    terminate: () => void;
    on: (event: string, listener: (...args: any[]) => void) => this;
    send: (data: string) => void;
    readyState: number;
    close: () => void;
    ping: () => void;
}

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

export class MexcFuturesConnector {
    private ws: MexcWebSocket | null = null;
    private readonly identifier: string;
    private readonly onPriceUpdate: (update: PriceUpdate) => void;
    private readonly onConnect: () => void;
    private isConnected: boolean = false;
    private reconnectAttempts: number = 0;
    private readonly maxReconnectAttempts: number = 10;
    private readonly reconnectDelay: number = 5000;
    private readonly WS_URL = 'wss://contract.mexc.com/edge';
    private readonly REST_URL = 'https://contract.mexc.com/api/v1/contract/detail';
    private subscribedSymbols: Set<string> = new Set();
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private readonly HEARTBEAT_INTERVAL = 20000;
    private reconnectTimeout: NodeJS.Timeout | null = null;

    constructor(identifier: string, onPriceUpdate: (update: PriceUpdate) => void, onConnect: () => void) {
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
                    const pingMessage = { "op": "ping" };
                    this.ws.send(JSON.stringify(pingMessage));
                    console.log(`[${this.identifier}] Ping enviado`);
                } catch (error) {
                    console.error(`[${this.identifier}] Erro ao enviar ping:`, error);
                    this.handleDisconnect('Erro ao enviar ping');
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
        
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        
        if (this.ws) {
            try {
                this.ws.removeAllListeners();
                if (this.ws.readyState === WebSocket.OPEN) {
                    this.ws.close();
                } else {
                    this.ws.terminate();
                }
                this.ws = null;
            } catch (error) {
                console.error(`[${this.identifier}] Erro ao limpar conexão:`, error);
            }
        }
        
        this.isConnected = false;
    }

    private handleDisconnect(reason: string = 'Desconexão') {
        console.log(`[${this.identifier}] Desconectado: ${reason}`);
        
        this.cleanup().then(() => {
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                const delay = Math.min(this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts), 30000);
                console.log(`[${this.identifier}] Tentando reconectar em ${delay}ms... (Tentativa ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
                
                this.reconnectTimeout = setTimeout(() => {
                    this.connect().catch((error: unknown) => {
                        console.error(`[${this.identifier}] Erro na tentativa de reconexão:`, error);
                    });
                }, delay);
                
                this.reconnectAttempts++;
            } else {
                console.error(`[${this.identifier}] Número máximo de tentativas de reconexão atingido`);
            }
        });
    }

    async connect(): Promise<void> {
        try {
            await this.cleanup();
            console.log(`\n[${this.identifier}] Iniciando conexão WebSocket...`);
            
            this.ws = new WebSocket(this.WS_URL, {
                handshakeTimeout: 10000,
                timeout: 10000
            }) as MexcWebSocket;

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
                    if (message.op === 'pong') {
                        console.log(`[${this.identifier}] Pong recebido`);
                        return;
                    }

                    // Handle subscription data
                    if (message.channel === 'push.ticker') {
                        const { symbol, bestAsk, bestBid } = message.data;
                        
                        if (bestAsk && bestBid) {
                            this.onPriceUpdate({
                                identifier: this.identifier,
                                symbol: symbol.replace('_', '/'),
                                marketType: 'futures',
                                bestAsk: parseFloat(bestAsk),
                                bestBid: parseFloat(bestBid)
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

    async getAvailablePairs(): Promise<ExchangePair[]> {
        try {
            console.log(`[${this.identifier}] Buscando pares negociáveis...`);
            
            // Lista fixa de pares comuns
            const commonPairs = [
                'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'XRP/USDT', 'ADA/USDT',
                'DOGE/USDT', 'MATIC/USDT', 'SOL/USDT', 'DOT/USDT', 'SHIB/USDT',
                'TRX/USDT', 'LTC/USDT', 'AVAX/USDT', 'LINK/USDT', 'UNI/USDT',
                'ATOM/USDT', 'XLM/USDT', 'BCH/USDT', 'NEAR/USDT', 'ETC/USDT'
            ];

            const pairs = commonPairs.map(symbol => ({
                symbol,
                active: true
            }));

            console.log(`[${this.identifier}] Usando ${pairs.length} pares comuns`);
            console.log(`[${this.identifier}] Pares disponíveis:`, pairs.map(p => p.symbol).join(', '));
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
            
            // Converte os pares para o formato do MEXC (BTC/USDT -> BTC_USDT)
            const formattedPairs = pairs.map(pair => pair.replace('/', '_'));
            
            const subscribeMessage = {
                "op": "sub.ticker",
                "symbol": formattedPairs
            };

            this.ws.send(JSON.stringify(subscribeMessage));
            pairs.forEach(symbol => this.subscribedSymbols.add(symbol));
            console.log(`[${this.identifier}] Mensagem de inscrição enviada`);
            console.log('Primeiros 5 pares inscritos:', formattedPairs.slice(0, 5));
        } catch (error) {
            console.error(`[${this.identifier}] Erro ao se inscrever nos pares:`, error);
        }
    }

    private resubscribeAll() {
        const symbols = Array.from(this.subscribedSymbols);
        if (symbols.length > 0) {
            console.log(`[${this.identifier}] Reinscrevendo em ${symbols.length} pares...`);
            this.subscribe(symbols);
        }
    }

    public async disconnect(): Promise<void> {
        console.log(`[${this.identifier}] Desconectando...`);
        await this.cleanup();
    }
} 