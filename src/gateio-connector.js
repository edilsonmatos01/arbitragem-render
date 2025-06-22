"use strict";

const WebSocket = require('ws');
const fetch = require('node-fetch');

const GATEIO_WS_URL = 'wss://api.gateio.ws/ws/v4/';

/**
 * Gerencia a conexão WebSocket e as inscrições para os feeds da Gate.io.
 * Pode ser configurado para SPOT ou FUTURES.
 */
class GateIoConnector {
    constructor(identifier, onPriceUpdate) {
        this.ws = null;
        this.subscriptionQueue = [];
        this.isConnected = false;
        this.pingInterval = null;
        this.reconnectTimeout = null;
        this.marketIdentifier = identifier;
        this.marketType = identifier.includes('_SPOT') ? 'spot' : 'futures';
        this.onPriceUpdate = onPriceUpdate;
        console.log(`[${this.marketIdentifier}] Conector inicializado.`);
    }

    async getTradablePairs() {
        const endpoint = this.marketType === 'spot'
            ? 'https://api.gateio.ws/api/v4/spot/currency_pairs'
            : 'https://api.gateio.ws/api/v4/futures/usdt/contracts';

        try {
            console.log(`[${this.marketIdentifier}] Buscando pares negociáveis de ${endpoint}`);
            const response = await fetch(endpoint);
            
            if (!response.ok) {
                throw new Error(`Falha na API: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!Array.isArray(data)) {
                console.warn(`[${this.marketIdentifier}] A resposta da API não foi uma lista (possível geoblocking).`);
                return [];
            }

            if (this.marketType === 'spot') {
                return data
                    .filter(p => p.trade_status === 'tradable' && p.quote === 'USDT')
                    .map(p => p.id.replace('_', '/')); // Converte 'BTC_USDT' para 'BTC/USDT'
            } else {
                return data
                    .filter(c => c.in_delisting === false)
                    .map(c => c.name.replace('_', '/')); // Converte 'BTC_USDT' para 'BTC/USDT'
            }
        } catch (error) {
            console.error(`[${this.marketIdentifier}] Erro ao buscar pares negociáveis:`, error);
            return [];
        }
    }

    connect(pairs) {
        this.subscriptionQueue = pairs.map(p => p.replace('/', '_')); // Gate.io usa '_'
        
        if (this.ws) {
            this.ws.close();
        }

        console.log(`[${this.marketIdentifier}] Conectando a ${GATEIO_WS_URL}`);
        this.ws = new WebSocket(GATEIO_WS_URL);
        this.ws.on('open', this.onOpen.bind(this));
        this.ws.on('message', this.onMessage.bind(this));
        this.ws.on('close', this.onClose.bind(this));
        this.ws.on('error', this.onError.bind(this));
    }

    onOpen() {
        console.log(`[${this.marketIdentifier}] Conexão WebSocket estabelecida.`);
        this.isConnected = true;
        this.startPinging();
        this.processSubscriptionQueue();
    }

    onMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            
            if (message.channel === 'spot.ping' || message.channel === 'futures.ping') {
                return; // Ignora pongs
            }

            if (message.event === 'update' && message.result) {
                this.handleTickerUpdate(message.result);
            }
        } catch (error) {
            console.error(`[${this.marketIdentifier}] Erro ao processar mensagem:`, error);
        }
    }

    handleTickerUpdate(ticker) {
        const symbol = ticker.s ? ticker.s.replace('_', '/') : null;
        if (!symbol) return;

        const update = {
            type: 'price-update',
            symbol,
            bestBid: parseFloat(ticker.b || '0'),
            bestAsk: parseFloat(ticker.a || '0'),
            marketType: this.marketType,
            identifier: this.marketIdentifier
        };

        this.onPriceUpdate(update);
    }

    processSubscriptionQueue() {
        if (!this.isConnected || !this.ws) return;

        const channel = this.marketType === 'spot' ? 'spot.book_ticker' : 'futures.book_ticker';
        console.log(`[${this.marketIdentifier}] Enviada inscrição para ${this.subscriptionQueue.length} pares.`);
        
        const subscribeMessage = {
            time: Math.floor(Date.now() / 1000),
            channel,
            event: 'subscribe',
            payload: this.subscriptionQueue
        };

        this.ws.send(JSON.stringify(subscribeMessage));
    }

    onClose() {
        console.log(`[${this.marketIdentifier}] Conexão WebSocket fechada.`);
        this.isConnected = false;
        this.stopPinging();
        
        // Tenta reconectar após 5 segundos
        this.reconnectTimeout = setTimeout(() => this.connect(this.subscriptionQueue.map(p => p.replace('_', '/'))), 5000);
    }

    onError(error) {
        console.error(`[${this.marketIdentifier}] Erro na conexão WebSocket:`, error);
    }

    startPinging() {
        this.pingInterval = setInterval(() => {
            if (this.ws && this.isConnected) {
                const pingMessage = { time: Date.now(), channel: 'spot.ping' };
                this.ws.send(JSON.stringify(pingMessage));
            }
        }, 20000);
    }

    stopPinging() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
    }
}

module.exports = { GateIoConnector };
