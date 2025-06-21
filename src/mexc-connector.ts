const WebSocket = require('ws');
import fetch from 'node-fetch';

export class MexcConnector {
    private ws: WebSocket | null = null;
    private readonly identifier: string;
    private readonly onPriceUpdate: Function;
    private readonly onConnect: Function;
    private isConnected: boolean = false;
    private isConnecting: boolean = false;
    private reconnectAttempts: number = 0;
    private readonly baseReconnectDelay: number = 5000; // 5 segundos
    private readonly maxReconnectDelay: number = 300000; // 5 minutos
    private readonly WS_URL = 'wss://wbs.mexc.com/ws';
    private readonly REST_URL = 'https://api.mexc.com/api/v3/ticker/price';
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private heartbeatTimeout: NodeJS.Timeout | null = null;
    private subscribedSymbols: Set<string> = new Set();
    private fallbackRestInterval: NodeJS.Timeout | null = null;
    private connectionStartTime: number = 0;
    private lastPongTime: number = 0;
    private readonly HEARTBEAT_INTERVAL = 30000; // 30 segundos
    private readonly HEARTBEAT_TIMEOUT = 10000; // 10 segundos
    private readonly REST_FALLBACK_INTERVAL = 30000; // 30 segundos
    private isBlocked: boolean = false;

    constructor(identifier: string, onPriceUpdate: Function, onConnect: Function) {
        this.identifier = identifier;
        this.onPriceUpdate = onPriceUpdate;
        this.onConnect = onConnect;
    }

    async connect() {
        if (this.isConnecting) {
            console.log('[MEXC] Já existe uma tentativa de conexão em andamento');
            return;
        }

        try {
            this.isConnecting = true;
            this.connectionStartTime = Date.now();
            
            // Limpa conexão anterior se existir
            await this.cleanup();

            console.log('[MEXC] Iniciando conexão WebSocket...');
            console.log('[MEXC] URL:', this.WS_URL);
            this.ws = new WebSocket(this.WS_URL);

            this.ws.on('open', () => {
                console.log('[MEXC] WebSocket conectado com sucesso');
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

            this.ws.on('message', (data: WebSocket.Data) => {
                try {
                    const message = JSON.parse(data.toString());
                    
                    // Log da mensagem recebida para debug
                    console.log('[MEXC] Mensagem recebida:', JSON.stringify(message));

                    // Verifica se a mensagem indica bloqueio
                    if (message.msg && message.msg.includes('Blocked')) {
                        console.error('[MEXC] Conexão bloqueada por restrição geográfica');
                        this.isBlocked = true;
                        this.startRestFallback();
                        return;
                    }

                    // Processa ping/pong
                    if (message.method === 'PING') {
                        console.log('[MEXC] Ping recebido, enviando pong');
                        this.ws?.send(JSON.stringify({ method: 'PONG' }));
                        this.updateLastPongTime();
                        return;
                    }

                    // Processa dados do ticker
                    if (message.channel?.startsWith('spot.ticker')) {
                        const symbol = message.symbol.replace('_', '/');
                        const bestAsk = parseFloat(message.ask || message.lastPrice);
                        const bestBid = parseFloat(message.bid || message.lastPrice);

                        if (isNaN(bestAsk) || isNaN(bestBid)) {
                            console.warn('[MEXC] Valores inválidos recebidos:', message);
                            return;
                        }

                        this.onPriceUpdate({
                            type: 'price-update',
                            symbol: symbol,
                            marketType: 'spot',
                            bestAsk: bestAsk,
                            bestBid: bestBid,
                            identifier: this.identifier
                        });
                    }
                } catch (error) {
                    console.error('[MEXC] Erro ao processar mensagem:', error);
                }
            });

            this.ws.on('close', (code: number, reason: string) => {
                console.log(`[MEXC] WebSocket desconectado (${code}): ${reason}`);
                this.handleDisconnect('Conexão fechada pelo servidor');
            });

            this.ws.on('error', (error: Error) => {
                console.error('[MEXC] Erro no WebSocket:', error);
                this.handleDisconnect('Erro na conexão');
            });

            // Configura timeout para a conexão inicial
            setTimeout(() => {
                if (!this.isConnected) {
                    this.handleDisconnect('Timeout na conexão inicial');
                }
            }, 10000);

        } catch (error) {
            console.error('[MEXC] Erro ao conectar:', error);
            this.handleDisconnect('Erro ao iniciar conexão');
        }
    }

    private async cleanup() {
        if (this.ws) {
            try {
                this.ws.removeAllListeners();
                if (this.ws.readyState === WebSocket.OPEN) {
                    this.ws.close();
                }
                this.ws.terminate();
                this.ws = null;
            } catch (error) {
                console.error('[MEXC] Erro ao limpar conexão:', error);
            }
        }
        this.stopHeartbeat();
        this.isConnected = false;
    }

    private handleDisconnect(reason: string) {
        console.log(`[MEXC] Desconectado: ${reason}`);
        this.cleanup();
        this.isConnected = false;
        this.isConnecting = false;

        // Se estiver bloqueado, vai direto para o fallback REST
        if (this.isBlocked) {
            console.log('[MEXC] Usando fallback REST devido a bloqueio geográfico');
            this.startRestFallback();
            return;
        }

        // Inicia fallback REST se a reconexão demorar muito
        if (Date.now() - this.connectionStartTime > 60000) { // 1 minuto
            this.startRestFallback();
        }

        this.scheduleReconnect();
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
        console.log(`[MEXC] Tentativa de reconexão ${this.reconnectAttempts} em ${delay/1000}s`);

        if (Date.now() - this.connectionStartTime > 300000) { // 5 minutos
            console.log('[MEXC] WebSocket não reconectou após múltiplas tentativas. Verifique a conexão.');
        }

        setTimeout(() => this.connect(), delay);
    }

    private startHeartbeat() {
        this.stopHeartbeat();
        
        // Envia ping a cada 30 segundos
        this.heartbeatInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                console.log('[MEXC] Enviando ping');
                this.ws.send(JSON.stringify({ method: 'PING' }));
                
                // Define timeout para receber pong
                this.heartbeatTimeout = setTimeout(() => {
                    if (Date.now() - this.lastPongTime > this.HEARTBEAT_TIMEOUT) {
                        console.log('[MEXC] Timeout no heartbeat, reconectando...');
                        this.handleDisconnect('Timeout no heartbeat');
                    }
                }, this.HEARTBEAT_TIMEOUT);
            }
        }, this.HEARTBEAT_INTERVAL);
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

        console.log('[MEXC] Iniciando fallback para REST API');
        this.fallbackRestInterval = setInterval(async () => {
            try {
                for (const symbol of this.subscribedSymbols) {
                    const formattedSymbol = symbol.replace('/', '');
                    const response = await fetch(`${this.REST_URL}?symbol=${formattedSymbol}`);
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
                console.error('[MEXC] Erro ao buscar preços via REST:', error);
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
            console.log(`[MEXC] Reinscrevendo em ${symbols.length} pares...`);
            this.subscribe(symbols);
        }
    }

    subscribe(symbols: string[]) {
        if (!this.ws || !this.isConnected) {
            console.error('[MEXC] Tentativa de inscrição sem conexão ativa');
            return;
        }

        try {
            console.log(`[MEXC] Inscrevendo em ${symbols.length} pares...`);
            
            symbols.forEach(symbol => {
                const formattedSymbol = symbol.replace('/', '').toUpperCase();
                this.subscribedSymbols.add(symbol);

                const subscribeMessage = {
                    "method": "SUBSCRIPTION",
                    "params": [`spot.ticker.${formattedSymbol}`],
                    "id": Date.now()
                };

                console.log(`[MEXC] Enviando subscrição para ${formattedSymbol}:`, JSON.stringify(subscribeMessage));
                this.ws?.send(JSON.stringify(subscribeMessage));
            });
        } catch (error) {
            console.error('[MEXC] Erro ao se inscrever:', error);
        }
    }

    async getTradablePairs(): Promise<string[]> {
        try {
            console.log('[MEXC] Buscando pares negociáveis...');
            const response = await fetch(`${this.REST_URL}`);
            const data = await response.json();
            
            if (!Array.isArray(data)) {
                throw new Error('Formato de resposta inválido');
            }

            const pairs = data
                .map((ticker: any) => ticker.symbol.replace(/([A-Z0-9]+)([A-Z0-9]+)$/, '$1/$2'));

            console.log(`[MEXC] ${pairs.length} pares encontrados`);
            return pairs;
        } catch (error) {
            console.error('[MEXC] Erro ao buscar pares:', error);
            return [];
        }
    }
} 