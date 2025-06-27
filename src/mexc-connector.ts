import WebSocket from 'ws';
import fetch from 'node-fetch';
import { CustomWebSocket, ExchangeConnector, PriceUpdate } from './types';

interface MexcContract {
    symbol: string;
    quoteCoin: string;
    futureType: number;
}

export class MexcConnector implements ExchangeConnector {
    private ws: CustomWebSocket | null = null;
    private priceUpdateCallback: ((update: PriceUpdate) => void) | null = null;
    private readonly wsUrl = 'wss://contract.mexc.com/ws';
    private readonly restUrl = 'https://contract.mexc.com/api/v1/contract/detail';
    private symbols: string[] = [];
    private pingInterval: NodeJS.Timeout | null = null;
    private reconnectAttempts = 0;
    private readonly maxReconnectAttempts = 10;
    private readonly reconnectDelay = 5000;
    private readonly relevantPairs = [
        'BTC_USDT',
        'ETH_USDT',
        'SOL_USDT',
        'XRP_USDT',
        'BNB_USDT'
    ];

    async connect(): Promise<void> {
        try {
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                console.error('Número máximo de tentativas de reconexão atingido. Aguardando 1 minuto antes de tentar novamente.');
                this.reconnectAttempts = 0;
                setTimeout(() => this.connect(), 60000);
                return;
            }

            this.symbols = await this.getSymbols();
            console.log('Conectando ao WebSocket da MEXC...');
            
            this.ws = new WebSocket(this.wsUrl, {
                perMessageDeflate: false,
                handshakeTimeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Origin': 'https://contract.mexc.com'
                }
            }) as CustomWebSocket;

            this.ws.on('open', () => {
                console.log('Conexão estabelecida com MEXC!');
                this.reconnectAttempts = 0;
                this.setupHeartbeat();
                this.subscribeToSymbols();
            });

            this.ws.on('message', (data) => this.handleMessage(data));
            
            this.ws.on('error', (error) => {
                console.error('Erro na conexão MEXC:', error);
                this.cleanup();
                this.reconnectAttempts++;
                setTimeout(() => this.connect(), this.reconnectDelay);
            });

            this.ws.on('close', (code, reason) => {
                console.log('Conexão MEXC fechada:', code, reason?.toString());
                this.cleanup();
                this.reconnectAttempts++;
                setTimeout(() => this.connect(), this.reconnectDelay);
            });

            this.ws.on('pong', () => {
                if (this.ws) {
                    this.ws.isAlive = true;
                    console.log('Pong recebido da MEXC - Conexão ativa');
                }
            });

        } catch (error) {
            console.error('Erro ao conectar com MEXC:', error);
            this.reconnectAttempts++;
            setTimeout(() => this.connect(), this.reconnectDelay);
        }
    }

    private async getSymbols(): Promise<string[]> {
        try {
            const response = await fetch(this.restUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data && data.data && Array.isArray(data.data)) {
                return data.data
                    .filter((contract: MexcContract) => 
                        contract.quoteCoin === 'USDT' && 
                        contract.futureType === 1 && 
                        !contract.symbol.includes('_INDEX_')
                    )
                    .map((contract: MexcContract) => contract.symbol);
            }
            
            console.warn('Formato de resposta inválido da MEXC, usando lista padrão');
            return this.relevantPairs;
        } catch (error) {
            console.error('Erro ao buscar símbolos da MEXC:', error);
            return this.relevantPairs;
        }
    }

    private setupHeartbeat() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }

        this.pingInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                if (this.ws.isAlive === false) {
                    console.log('MEXC não respondeu ao ping anterior, reconectando...');
                    this.cleanup();
                    this.connect();
                    return;
                }

                this.ws.isAlive = false;
                const pingMsg = {
                    "method": "ping"
                };
                this.ws.send(JSON.stringify(pingMsg));
                console.log('Ping enviado para MEXC');
            }
        }, 10000);
    }

    private subscribeToSymbols() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log('WebSocket não está pronto para subscrição, tentando reconectar...');
            this.cleanup();
            this.connect();
            return;
        }

        this.symbols.forEach(symbol => {
            const formattedSymbol = symbol.toLowerCase().replace('_', '');
            const msg = {
                "method": "sub.deal",
                "param": {
                    "symbol": formattedSymbol
                },
                "id": Date.now()
            };
            
            try {
                console.log('Enviando subscrição MEXC:', JSON.stringify(msg));
                this.ws?.send(JSON.stringify(msg));

                // Também assina o ticker
                const tickerMsg = {
                    "method": "sub.depth",
                    "param": {
                        "symbol": formattedSymbol,
                        "level": 20
                    },
                    "id": Date.now() + 1
                };
                console.log('Enviando subscrição de profundidade MEXC:', JSON.stringify(tickerMsg));
                this.ws?.send(JSON.stringify(tickerMsg));
            } catch (error) {
                console.error('Erro ao enviar subscrição para MEXC:', error);
            }
        });
    }

    private handleMessage(data: WebSocket.Data) {
        try {
            const message = JSON.parse(data.toString());
            
            // Responde ao ping do servidor
            if (message.method === "ping") {
                const pongMsg = {
                    "method": "pong"
                };
                this.ws?.send(JSON.stringify(pongMsg));
                return;
            }

            // Processa mensagens de profundidade do livro de ordens
            if (message.channel === "push.depth" && message.data) {
                const depth = message.data;
                if (depth.asks && depth.asks.length > 0 && depth.bids && depth.bids.length > 0) {
                    const bestAsk = parseFloat(depth.asks[0][0]);
                    const bestBid = parseFloat(depth.bids[0][0]);

                    if (bestAsk && bestBid && this.priceUpdateCallback) {
                        const symbol = message.symbol.toUpperCase();
                        const formattedSymbol = symbol.slice(0, -4) + '_' + symbol.slice(-4);
                        
                        const update: PriceUpdate = {
                            identifier: 'mexc',
                            symbol: formattedSymbol,
                            type: 'futures',
                            marketType: 'futures',
                            bestAsk,
                            bestBid
                        };

                        const spreadPercent = ((bestBid - bestAsk) / bestAsk) * 100;
                        if (this.relevantPairs.includes(formattedSymbol) && Math.abs(spreadPercent) > 0.1) {
                            const spreadColor = spreadPercent > 0.5 ? '\x1b[32m' : '\x1b[36m';
                            const resetColor = '\x1b[0m';
                            console.log(`
${spreadColor}┌──────────────────────────────────────────────
│ 📊 MEXC Atualização - ${new Date().toLocaleTimeString('pt-BR')}
│ 🔸 Par: ${update.symbol}
│ 📉 Compra (Ask): ${bestAsk.toFixed(8)} USDT
│ 📈 Venda (Bid): ${bestBid.toFixed(8)} USDT
│ 📊 Spread: ${spreadPercent.toFixed(4)}%
└──────────────────────────────────────────────${resetColor}`);
                        }
                        
                        this.priceUpdateCallback(update);
                    }
                }
            }
        } catch (error) {
            console.error('\x1b[31mErro ao processar mensagem MEXC:', error, '\x1b[0m');
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