const WebSocket = require('ws');

// Configurações
const WS_URL = 'wss://wbs.mexc.com/ws';
const SYMBOL = 'BTC/USDT';

// Criar conexão WebSocket
const ws = new WebSocket(WS_URL);

// Eventos do WebSocket
ws.on('open', () => {
    console.log('Conectado ao WebSocket Spot da MEXC');
    
    // Enviar mensagem de subscrição
    const subscribeMessage = {
        method: 'sub.ticker',
        param: {
            symbol: SYMBOL.replace('/', '_')
        }
    };
    
    console.log('Enviando mensagem de subscrição:', JSON.stringify(subscribeMessage));
    ws.send(JSON.stringify(subscribeMessage));

    // Iniciar ping a cada 20 segundos
    setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ method: "ping" }));
        }
    }, 20000);
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());
        if (message.channel === 'push.ticker' && message.data) {
            const ticker = message.data;
            console.log('Preços Spot:', {
                symbol: ticker.symbol,
                bestAsk: parseFloat(ticker.ask1),
                bestBid: parseFloat(ticker.bid1)
            });
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