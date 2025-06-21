const WebSocket = require('ws');

// Configurações
const WS_URL = 'wss://wbs.mexc.com/ws';
const SYMBOL = 'BTC/USDT';

// Criar conexão WebSocket
const ws = new WebSocket(WS_URL);

// Eventos do WebSocket
ws.on('open', () => {
    console.log('Conectado ao WebSocket da MEXC');
    
    // Enviar mensagem de subscrição
    const subscribeMessage = {
        "method": "SUBSCRIPTION",
        "params": [
            `spot.ticker.${SYMBOL.replace('/', '')}`
        ],
        "id": Date.now()
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