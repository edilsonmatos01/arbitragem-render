const WebSocket = require('ws');

// Configurações
const WS_URL = 'wss://api.gateio.ws/ws/v4/';
const SYMBOL = 'BTC/USDT';
const MARKET_TYPE = 'spot'; // ou 'futures'

// Criar conexão WebSocket
const ws = new WebSocket(WS_URL);

// Eventos do WebSocket
ws.on('open', () => {
    console.log(`Conectado ao WebSocket da Gate.io (${MARKET_TYPE.toUpperCase()})`);
    
    // Enviar mensagem de subscrição
    const channel = MARKET_TYPE === 'spot' ? 'spot.tickers' : 'futures.tickers';
    const subscribeMessage = {
        time: Math.floor(Date.now() / 1000),
        channel: channel,
        event: 'subscribe',
        payload: [SYMBOL.replace('/', '_')]
    };
    
    console.log('Enviando mensagem de subscrição:', JSON.stringify(subscribeMessage));
    ws.send(JSON.stringify(subscribeMessage));

    // Iniciar ping a cada 20 segundos
    setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            const pingChannel = MARKET_TYPE === 'spot' ? 'spot.ping' : 'futures.ping';
            ws.send(JSON.stringify({ 
                time: Math.floor(Date.now() / 1000), 
                channel: pingChannel 
            }));
        }
    }, 20000);
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());
        
        // Ignora mensagens de ping
        if (message.channel === 'spot.ping' || message.channel === 'futures.ping') {
            return;
        }

        // Processa atualizações de preço
        if (message.event === 'update' && message.result) {
            const ticker = message.result;
            const pair = (ticker.currency_pair || ticker.contract).replace('_', '/');
            
            const priceData = {
                symbol: pair,
                bestAsk: parseFloat(ticker.lowest_ask || ticker.ask1),
                bestBid: parseFloat(ticker.highest_bid || ticker.bid1),
                marketType: MARKET_TYPE
            };

            if (!priceData.bestAsk || !priceData.bestBid) return;

            console.log('Preços atualizados:', priceData);
        } else {
            console.log('Outra mensagem recebida:', message);
        }
    } catch (error) {
        console.error('Erro ao processar mensagem:', error);
    }
});

ws.on('error', (error) => {
    console.error('Erro na conexão:', error);
});

ws.on('close', () => {
    console.log('Conexão fechada');
}); 