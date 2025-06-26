const WebSocket = require('ws');
const https = require('https');
const http = require('http');

// URLs da MEXC
const MEXC_SPOT_URL = 'wss://contract.mexc.com/edge';
const MEXC_FUTURES_URL = 'wss://contract.mexc.com/edge';

// Cria servidor proxy local
const proxyServer = http.createServer();
const wss = new WebSocket.Server({ server: proxyServer });

wss.on('connection', (ws, req) => {
    const targetUrl = req.url === '/spot' ? MEXC_SPOT_URL : MEXC_FUTURES_URL;
    const name = req.url === '/spot' ? 'MEXC Spot' : 'MEXC Futures';
    
    console.log(`[${name}] Cliente conectado ao proxy`);
    
    const mexcWs = new WebSocket(targetUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Connection': 'Upgrade',
            'Upgrade': 'websocket'
        },
        followRedirects: true,
        handshakeTimeout: 30000,
        perMessageDeflate: false
    });

    mexcWs.on('open', () => {
        console.log(`[${name}] Conexão com MEXC estabelecida`);
        
        // Envia mensagem de subscrição
        const message = {
            method: 'sub.ticker',
            param: {
                symbol: 'BTC_USDT'
            }
        };

        console.log(`[${name}] Enviando subscrição:`, JSON.stringify(message, null, 2));
        mexcWs.send(JSON.stringify(message));

        // Envia ping a cada 20 segundos para manter a conexão viva
        const pingInterval = setInterval(() => {
            if (mexcWs.readyState === WebSocket.OPEN) {
                const pingMessage = { method: "ping" };
                console.log(`[${name}] Enviando ping:`, JSON.stringify(pingMessage, null, 2));
                mexcWs.send(JSON.stringify(pingMessage));
            } else {
                clearInterval(pingInterval);
            }
        }, 20000);
    });

    mexcWs.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log(`[${name}] Mensagem recebida:`, JSON.stringify(message, null, 2));
            
            if (message.channel === 'push.ticker' && message.data) {
                const ticker = message.data;
                console.log(`[${name}] Preços:`, {
                    symbol: ticker.symbol,
                    bestAsk: parseFloat(ticker.ask1),
                    bestBid: parseFloat(ticker.bid1)
                });
            }
            
            ws.send(data); // Repassa para o cliente
        } catch (error) {
            console.error(`[${name}] Erro ao processar mensagem:`, error);
            console.log(`[${name}] Mensagem raw:`, data.toString());
        }
    });

    mexcWs.on('error', (error) => {
        console.error(`[${name}] Erro WebSocket:`, error);
    });

    mexcWs.on('close', (code, reason) => {
        console.log(`[${name}] Conexão fechada - Código: ${code}, Razão: ${reason}`);
        ws.close();
    });

    ws.on('message', (data) => {
        if (mexcWs.readyState === WebSocket.OPEN) {
            mexcWs.send(data);
        }
    });

    ws.on('close', () => {
        console.log(`[${name}] Cliente desconectado do proxy`);
        mexcWs.close();
    });
});

// Inicia o servidor proxy
const PORT = 8080;
proxyServer.listen(PORT, () => {
    console.log(`Servidor proxy iniciado na porta ${PORT}`);
    
    // Conecta ao proxy para testar
    console.log('\n=== Testando MEXC Spot ===');
    const spotWs = new WebSocket(`ws://localhost:${PORT}/spot`);
    
    setTimeout(() => {
        console.log('\n=== Testando MEXC Futures ===');
        const futuresWs = new WebSocket(`ws://localhost:${PORT}/futures`);
    }, 5000);
});

// Mantém o script rodando
process.on('SIGINT', () => {
    console.log('\nEncerrando servidor proxy...');
    proxyServer.close();
    process.exit();
}); 