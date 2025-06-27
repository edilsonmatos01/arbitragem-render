import WebSocket from 'ws';
import fetch from 'node-fetch';
import { CustomWebSocket, ExchangeConnector, PriceUpdate } from './types';

interface GateioContract {
    name: string;
    settle: string;
}

const GATEIO_WS_URL = 'wss://api.gateio.ws/ws/v4/';

/**
 * Gerencia a conexão WebSocket e as inscrições para os feeds da Gate.io.
 * Pode ser configurado para SPOT ou FUTURES.
 */
export class GateioConnector implements ExchangeConnector {
    private ws: CustomWebSocket | null = null;
    private priceUpdateCallback: ((update: PriceUpdate) => void) | null = null;
    private readonly wsUrl = 'wss://api.gateio.ws/ws/v4/';
    private readonly restUrl = 'https://api.gateio.ws/api/v4/futures/usdt/contracts';
    private symbols: string[] = [];
    private pingInterval: NodeJS.Timeout | null = null;

    async connect(): Promise<void> {
        try {
            console.log('[GATEIO CONNECT] Iniciando conexão...');
            this.symbols = await this.getSymbols();
            console.log(`[GATEIO CONNECT] ${this.symbols.length} símbolos obtidos`);
            console.log('[GATEIO CONNECT] Conectando ao WebSocket do Gate.io...');
            
            this.ws = new WebSocket(this.wsUrl, {
                handshakeTimeout: 30000,
                perMessageDeflate: false,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            }) as CustomWebSocket;

            this.ws.on('open', () => {
                console.log('[GATEIO CONNECT] ✅ Conexão estabelecida com Gate.io!');
                console.log('[GATEIO CONNECT] Configurando heartbeat...');
                this.setupHeartbeat();
                console.log('[GATEIO CONNECT] Iniciando subscrições...');
                this.subscribeToSymbols();
            });

            this.ws.on('message', (data) => this.handleMessage(data));
            
            this.ws.on('error', (error) => {
                console.error('Erro na conexão Gate.io:', error);
            });

            this.ws.on('close', (code, reason) => {
                console.log('Conexão Gate.io fechada:', code, reason?.toString());
                this.cleanup();
                // Reconecta após 5 segundos
                setTimeout(() => this.connect(), 5000);
            });

        } catch (error) {
            console.error('Erro ao conectar com Gate.io:', error);
            throw error;
        }
    }

    private async getSymbols(): Promise<string[]> {
        try {
            const response = await fetch(this.restUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (Array.isArray(data)) {
                return data
                    .filter((contract: GateioContract) => 
                        contract.settle === 'usdt' && 
                        !contract.name.includes('_INDEX')
                    )
                    .map((contract: GateioContract) => contract.name);
            }
            
            console.warn('Formato de resposta inválido do Gate.io, usando lista padrão');
            return [
                'BTC_USDT',
                'ETH_USDT',
                'SOL_USDT',
                'XRP_USDT',
                'BNB_USDT'
            ];
        } catch (error) {
            console.error('Erro ao buscar símbolos do Gate.io:', error);
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
                console.log('Ping enviado para Gate.io');
            }
        }, 20000);

        this.ws?.on('pong', () => {
            console.log('Pong recebido do Gate.io');
        });
    }

    private subscribeToSymbols() {
        console.log(`[GATEIO] Iniciando subscrições para ${this.symbols.length} símbolos`);
        
        this.symbols.forEach((symbol, index) => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                // Usar formato correto da API v4
                const msg = {
                    time: Math.floor(Date.now() / 1000),
                    channel: "futures.tickers",
                    event: "subscribe",
                    payload: [symbol]
                };
                
                console.log(`[GATEIO] (${index + 1}/${this.symbols.length}) Enviando subscrição para ${symbol}:`, JSON.stringify(msg));
                this.ws.send(JSON.stringify(msg));
                
                // Pequeno delay entre subscrições para evitar rate limit
                if (index < this.symbols.length - 1) {
                    setTimeout(() => {}, 10);
                }
            }
        });
        
        console.log(`[GATEIO] Todas as ${this.symbols.length} subscrições enviadas!`);
    }

    private handleMessage(data: WebSocket.Data) {
        try {
            const message = JSON.parse(data.toString());
            
            // Log simplificado para não sobrecarregar
            console.log(`[GATEIO MSG] Recebida:`, Object.keys(message).join(','));
            
            // Verifica se é resposta de subscrição
            if (message.event) {
                console.log(`[GATEIO EVENT] ${message.event}: ${message.result || message.error || 'sem resultado'}`);
            }
            
            // Verifica diferentes tipos de resposta de dados
            if (message.channel === 'futures.tickers' && message.result) {
                const ticker = message.result;
                const bestAsk = parseFloat(ticker.ask) || parseFloat(ticker.last);
                const bestBid = parseFloat(ticker.bid) || parseFloat(ticker.last);
                
                if (bestAsk && bestBid && this.priceUpdateCallback) {
                    const update: PriceUpdate = {
                        identifier: 'gateio',
                        symbol: ticker.contract,
                        type: 'futures',
                        marketType: 'futures',
                        bestAsk,
                        bestBid
                    };
                    
                    console.log(`[GATEIO PRICE] ${ticker.contract}: ${bestAsk}/${bestBid}`);
                    this.priceUpdateCallback(update);
                } else {
                    console.log(`[GATEIO SKIP] ${ticker.contract}: dados inválidos`);
                }
            }
            
        } catch (error) {
            console.error('[GATEIO ERROR]:', error instanceof Error ? error.message : String(error));
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