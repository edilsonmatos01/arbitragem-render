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
    private readonly wsUrl = 'wss://contract.mexc.com/edge';
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

        console.log(`[MEXC SUB] Iniciando subscrições para ${this.symbols.length} símbolos`);

        this.symbols.forEach((symbol, index) => {
            // Usar o símbolo EXATO da API (não converter formato)
            const msg = {
                "method": "sub.ticker",
                "param": {
                    "symbol": symbol  // Usar símbolo exato da API
                }
            };
            
            try {
                // Log apenas os primeiros 5 e últimos 5 para não sobrecarregar
                if (index < 5 || index >= this.symbols.length - 5) {
                    console.log(`[MEXC SUB] (${index + 1}/${this.symbols.length}) ${symbol}:`, JSON.stringify(msg));
                }
                this.ws?.send(JSON.stringify(msg));
            } catch (error) {
                console.error('Erro ao enviar subscrição para MEXC:', error);
            }
        });

        console.log(`[MEXC SUB] ✅ Todas as ${this.symbols.length} subscrições enviadas!`);
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
                console.log(`[MEXC] Respondeu ping do servidor`);
                return;
            }

            // Log de confirmação de subscrições
            if (message.id && message.result) {
                console.log(`[MEXC] Subscrição confirmada - ID: ${message.id}, Result: ${message.result}`);
                return;
            }

            // Processa mensagens de ticker (formato correto)
            if (message.channel === "push.ticker" && message.data) {
                const ticker = message.data;
                const bestAsk = parseFloat(ticker.ask1);
                const bestBid = parseFloat(ticker.bid1);

                if (bestAsk && bestBid && this.priceUpdateCallback) {
                    // Converter formato do símbolo: BTC_USDT -> BTC_USDT (manter formato padrão)
                    const symbol = ticker.symbol;
                    
                    const update: PriceUpdate = {
                        identifier: 'mexc',
                        symbol: symbol,
                        type: 'futures',
                        marketType: 'futures',
                        bestAsk,
                        bestBid
                    };

                    // Log apenas para pares prioritários para reduzir verbosidade
                    if (this.relevantPairs.includes(symbol)) {
                        console.log(`[MEXC PRICE] ${symbol}: Ask=${bestAsk}, Bid=${bestBid}`);
                    }
                    this.priceUpdateCallback(update);
                } else {
                    console.log(`[MEXC] Dados de ticker inválidos - Symbol: ${ticker.symbol}, Ask: ${bestAsk}, Bid: ${bestBid}`);
                }
            } else {
                // Log de outros tipos de mensagem (apenas erros importantes)
                if (message.channel && message.channel.startsWith('rs.error')) {
                    console.log(`[MEXC ERROR] ${message.data}`);
                } else if (message.error) {
                    console.log(`[MEXC ERROR] Erro recebido:`, JSON.stringify(message.error));
                } else {
                    // Log detalhado apenas para debug quando necessário
                    console.log(`[MEXC DEBUG] Mensagem não processada - Channel: ${message.channel || 'N/A'}, Method: ${message.method || 'N/A'}`);
                }
            }
        } catch (error) {
            console.error('[MEXC ERROR] Erro ao processar mensagem:', error);
            console.error('[MEXC ERROR] Dados brutos:', data.toString().substring(0, 200));
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