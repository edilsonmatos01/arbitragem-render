const WebSocket = require('ws');
const fetch = require('node-fetch');

// Configurações
const WS_URL = 'wss://api.gateio.ws/ws/v4/';
const REST_URL = 'https://api.gateio.ws/api/v4/spot/currency_pairs';
const MARKET_TYPE = 'spot';

async function getSymbols() {
    try {
        const response = await fetch(REST_URL);
        const pairs = await response.json();
        return pairs
            .filter(pair => pair.quote === 'USDT' && pair.trade_status === 'tradable')
            .map(pair => `${pair.base}/${pair.quote}`);
    } catch (error) {
        console.error('Erro ao buscar símbolos:', error);
        return [
            'BTC/USDT',
            'ETH/USDT',
            'SOL/USDT',
            'XRP/USDT',
            'BNB/USDT'
        ];
    }
}

async function connect() {
    const symbols = await getSymbols();
    console.log(`Símbolos encontrados: ${symbols.length}`);
    console.log('Primeiros 5 símbolos:', symbols.slice(0, 5));

    // Criar conexão WebSocket
    const ws = new WebSocket(WS_URL);

    // Eventos do WebSocket
    ws.on('open', () => {
        console.log(`Conectado ao WebSocket da Gate.io (${MARKET_TYPE.toUpperCase()})`);
        
        // Enviar mensagem de subscrição para cada símbolo
        const channel = 'spot.tickers';
        const subscribeMessage = {
            time: Math.floor(Date.now() / 1000),
            channel: channel,
            event: 'subscribe',
            payload: symbols.map(symbol => symbol.replace('/', '_'))
        };
        
        console.log('Enviando mensagem de subscrição:', JSON.stringify(subscribeMessage));
        ws.send(JSON.stringify(subscribeMessage));

        // Iniciar ping a cada 20 segundos
        setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ 
                    time: Math.floor(Date.now() / 1000), 
                    channel: 'spot.ping' 
                }));
                console.log('Ping enviado');
            }
        }, 20000);
    });

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            
            // Ignora mensagens de ping
            if (message.channel === 'spot.ping') {
                console.log('Pong recebido');
                return;
            }

            // Log da mensagem de subscrição
            if (message.event === 'subscribe') {
                console.log('Status da subscrição:', message.result.status);
                return;
            }

            // Processa atualizações de preço
            if (message.event === 'update' && message.result) {
                const ticker = message.result;
                const pair = ticker.currency_pair.replace('_', '/');
                
                const bestAsk = parseFloat(ticker.lowest_ask);
                const bestBid = parseFloat(ticker.highest_bid);

                if (!bestAsk || !bestBid) return;

                const spread = ((bestAsk - bestBid) / bestBid * 100).toFixed(4);
                
                console.log(`Preços atualizados para ${pair}:`, {
                    bestAsk,
                    bestBid,
                    spread: spread + '%'
                });
            }
        } catch (error) {
            console.error('Erro ao processar mensagem:', error);
        }
    });

    ws.on('error', (error) => {
        console.error('Erro na conexão:', error);
    });

    ws.on('close', (code, reason) => {
        console.log('Conexão fechada:', code, reason);
        // Tenta reconectar após 5 segundos
        setTimeout(connect, 5000);
    });
}

// Inicia a conexão
connect(); 