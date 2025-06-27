import WebSocket from 'ws';
import fetch from 'node-fetch';
import { CustomWebSocket, ExchangeConnector, PriceUpdate } from './types';

export class MexcConnector implements ExchangeConnector {
    private ws: CustomWebSocket | null = null;
    private priceUpdateCallback: ((update: PriceUpdate) => void) | null = null;
    private readonly wsUrl = 'wss://contract.mexc.com/edge';
    private readonly restUrl = 'https://contract.mexc.com/api/v1/contract/detail';
    private symbols: string[] = [];
    private pingInterval: NodeJS.Timeout | null = null;

    async connect(): Promise<void> {
        try {
            this.symbols = await this.getSymbols();
            console.log('Conectando ao WebSocket da MEXC...');
            
            this.ws = new WebSocket(this.wsUrl, {
                handshakeTimeout: 30000,
                timeout: 30000,
                perMessageDeflate: false,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            }) as CustomWebSocket;

            this.ws.on('open', () => {
                console.log('Conexão estabelecida com MEXC!');
                this.setupHeartbeat();
                this.subscribeToSymbols();
            });

            this.ws.on('message', (data) => this.handleMessage(data));
            
            this.ws.on('error', (error) => {
                console.error('Erro na conexão MEXC:', error);
            });

            this.ws.on('close', (code, reason) => {
                console.log('Conexão MEXC fechada:', code, reason?.toString());
                this.cleanup();
                // Reconecta após 5 segundos
                setTimeout(() => this.connect(), 5000);
            });

        } catch (error) {
            console.error('Erro ao conectar com MEXC:', error);
            throw error;
        }
    }

    private async getSymbols(): Promise<string[]> {
        try {
            const response = await fetch(this.restUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                timeout: 15000
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (Array.isArray(data)) {
                return data
                    .filter(contract => 
                        contract.quoteCoin === 'USDT' && 
                        contract.futureType === 1 && 
                        !contract.symbol.includes('_INDEX_')
                    )
                    .map(contract => contract.symbol);
            }
            
            throw new Error('Formato de resposta inválido');
        } catch (error) {
            console.error('Erro ao buscar símbolos:', error);
            return [
                'BTC_USDT',
                'ETH_USDT',
                'SOL_USDT',
                'XRP_USDT',
                'BNB_USDT'
            ];
        }
    }

    private setupHeartbeat() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }

        this.pingInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                this.ws.ping();
                console.log('Ping enviado para MEXC');
            }
        }, 20000);

        this.ws?.on('pong', () => {
            console.log('Pong recebido da MEXC');
        });
    }

    private subscribeToSymbols() {
        this.symbols.forEach(symbol => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                const msg = {
                    method: "sub.ticker",
                    param: { symbol }
                };
                
                console.log('Enviando subscrição MEXC:', JSON.stringify(msg));
                this.ws.send(JSON.stringify(msg));
            }
        });
    }

    private handleMessage(data: WebSocket.Data) {
        try {
            const message = JSON.parse(data.toString());
            
            if (message.channel === 'push.ticker' && message.data) {
                const ticker = message.data;
                const bestAsk = parseFloat(ticker.ask1);
                const bestBid = parseFloat(ticker.bid1);
                
                if (bestAsk && bestBid && this.priceUpdateCallback) {
                    const update: PriceUpdate = {
                        identifier: 'mexc',
                        symbol: ticker.symbol,
                        type: 'futures',
                        marketType: 'futures',
                        bestAsk,
                        bestBid
                    };
                    
                    this.priceUpdateCallback(update);
                }
            }
        } catch (error) {
            console.error('Erro ao processar mensagem MEXC:', error);
        }
    }

    public disconnect(): void {
        this.cleanup();
    }

    private cleanup(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }

        if (this.ws) {
            this.ws.removeAllListeners();
            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.close();
            }
            this.ws = null;
        }
    }

    public onPriceUpdate(callback: (update: PriceUpdate) => void): void {
        this.priceUpdateCallback = callback;
    }
} 