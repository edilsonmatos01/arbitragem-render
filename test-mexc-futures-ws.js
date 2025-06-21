const WebSocket = require('ws');

// Configurações
const WS_URL = 'wss://contract.mexc.com/edge';
const SYMBOL = 'BTC_USDT';

// Criar conexão WebSocket
const ws = new WebSocket(WS_URL);

// Eventos do WebSocket
ws.on('open', () => {
    console.log('Conectado ao WebSocket da MEXC Futures');
    
    // Enviar mensagem de subscrição
    const subscribeMessage = {
        "method": "sub.ticker",
        "param": {
            "symbol": SYMBOL
        }
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