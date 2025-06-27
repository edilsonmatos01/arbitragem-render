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
            this.symbols = await this.getSymbols();
            console.log('Conectando ao WebSocket do Gate.io...');
            
            this.ws = new WebSocket(this.wsUrl, {
                handshakeTimeout: 30000,
                perMessageDeflate: false,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            }) as CustomWebSocket;

            this.ws.on('open', () => {
                console.log('Conexão estabelecida com Gate.io!');
                this.setupHeartbeat();
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
        this.symbols.forEach(symbol => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                const msg = {
                    time: Math.floor(Date.now() / 1000),
                    channel: "futures.tickers",
                    event: "subscribe",
                    payload: [symbol]
                };
                
                console.log('Enviando subscrição Gate.io:', JSON.stringify(msg));
                this.ws.send(JSON.stringify(msg));
            }
        });
    }

    private handleMessage(data: WebSocket.Data) {
        try {
            const message = JSON.parse(data.toString());
            
            // Log todas as mensagens para debug
            console.log('[GATEIO DEBUG] Mensagem recebida:', JSON.stringify(message).substring(0, 200));
            
            // Verifica diferentes tipos de resposta
            if (message.channel === 'futures.tickers' && message.result) {
                const ticker = message.result;
                console.log('[GATEIO DEBUG] Ticker recebido:', JSON.stringify(ticker));
                
                // Usar ask e bid reais ao invés do last price
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
                    
                    console.log(`[GATEIO] Enviando update para ${ticker.contract}: Ask ${bestAsk}, Bid ${bestBid}`);
                    this.priceUpdateCallback(update);
                }
            }
            
            // Verifica se é resposta de subscrição
            if (message.event === 'subscribe' || message.event === 'update') {
                console.log('[GATEIO DEBUG] Evento de subscrição/update:', message.event, message.result);
            }
            
        } catch (error) {
            console.error('Erro ao processar mensagem Gate.io:', error);
            console.error('Dados brutos:', data.toString().substring(0, 200));
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