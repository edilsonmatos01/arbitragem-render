const WebSocket = require('ws');

// Configurações
const WS_URL = 'wss://fx-ws.gateio.ws/v4/ws/usdt';
const SYMBOL = 'BTC/USDT';

// Criar conexão WebSocket
const ws = new WebSocket(WS_URL);

// Eventos do WebSocket
ws.on('open', () => {
    console.log('Conectado ao WebSocket da Gate.io Futures');
    
    // Enviar mensagem de subscrição
    const subscribeMessage = {
        time: Math.floor(Date.now() / 1000),
        channel: 'futures.book_ticker',
        event: 'subscribe',
        payload: [SYMBOL.replace('/', '_')]
    };
    
    console.log('Enviando mensagem de subscrição:', JSON.stringify(subscribeMessage));
    ws.send(JSON.stringify(subscribeMessage));
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());
        console.log('Mensagem recebida:', message);
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