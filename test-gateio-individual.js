const WebSocket = require('ws');
const https = require('https');
const http = require('http');

// URLs da Gate.io
const GATEIO_SPOT_URL = 'wss://api.gateio.ws/ws/v4/';
const GATEIO_FUTURES_URL = 'wss://fx-ws.gateio.ws/v4/ws/usdt';

// Cria servidor proxy local
const proxyServer = http.createServer();
const wss = new WebSocket.Server({ server: proxyServer });

wss.on('connection', (ws, req) => {
    const targetUrl = req.url === '/spot' ? GATEIO_SPOT_URL : GATEIO_FUTURES_URL;
    const name = req.url === '/spot' ? 'Gate.io Spot' : 'Gate.io Futures';
    const marketType = req.url === '/spot' ? 'spot' : 'futures';
    
    console.log(`[${name}] Cliente conectado ao proxy`);
    
    const gateWs = new WebSocket(targetUrl, {
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

    gateWs.on('open', () => {
        console.log(`[${name}] Conexão com Gate.io estabelecida`);
        
        // Envia mensagem de subscrição
        const channel = marketType === 'spot' ? 'spot.tickers' : 'futures.book_ticker';
        const subscribeMessage = {
            time: Math.floor(Date.now() / 1000),
            channel: channel,
            event: 'subscribe',
            payload: ['BTC_USDT']
        };

        console.log(`[${name}] Enviando subscrição:`, JSON.stringify(subscribeMessage, null, 2));
        gateWs.send(JSON.stringify(subscribeMessage));

        // Envia ping a cada 20 segundos para manter a conexão viva
        const pingInterval = setInterval(() => {
            if (gateWs.readyState === WebSocket.OPEN) {
                const pingChannel = marketType === 'spot' ? 'spot.ping' : 'futures.ping';
                const pingMessage = {
                    time: Math.floor(Date.now() / 1000),
                    channel: pingChannel
                };
                console.log(`[${name}] Enviando ping:`, JSON.stringify(pingMessage, null, 2));
                gateWs.send(JSON.stringify(pingMessage));
            } else {
                clearInterval(pingInterval);
            }
        }, 20000);
    });

    gateWs.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log(`[${name}] Mensagem recebida:`, JSON.stringify(message, null, 2));
            
            // Processa atualizações de preço
            if (message.event === 'update') {
                if (marketType === 'spot' && message.result) {
                    const ticker = message.result;
                    const pair = ticker.currency_pair.replace('_', '/');
                    
                    const priceData = {
                        symbol: pair,
                        bestAsk: parseFloat(ticker.lowest_ask),
                        bestBid: parseFloat(ticker.highest_bid),
                        marketType: marketType
                    };

                    if (priceData.bestAsk && priceData.bestBid) {
                        console.log(`[${name}] Preços atualizados:`, priceData);
                    }
                } else if (marketType === 'futures' && message.result) {
                    const ticker = message.result;
                    const priceData = {
                        symbol: ticker.s,
                        bestAsk: parseFloat(ticker.a),
                        bestBid: parseFloat(ticker.b),
                        askSize: parseFloat(ticker.A),
                        bidSize: parseFloat(ticker.B),
                        marketType: marketType
                    };

                    if (priceData.bestAsk && priceData.bestBid) {
                        console.log(`[${name}] Preços atualizados:`, priceData);
                    }
                }
            }
            
            ws.send(data); // Repassa para o cliente
        } catch (error) {
            console.error(`[${name}] Erro ao processar mensagem:`, error);
            console.log(`[${name}] Mensagem raw:`, data.toString());
        }
    });

    gateWs.on('error', (error) => {
        console.error(`[${name}] Erro WebSocket:`, error);
    });

    gateWs.on('close', (code, reason) => {
        console.log(`[${name}] Conexão fechada - Código: ${code}, Razão: ${reason}`);
        ws.close();
    });

    ws.on('message', (data) => {
        if (gateWs.readyState === WebSocket.OPEN) {
            gateWs.send(data);
        }
    });

    ws.on('close', () => {
        console.log(`[${name}] Cliente desconectado do proxy`);
        gateWs.close();
    });
});

// Inicia o servidor proxy
const PORT = 8080;
proxyServer.listen(PORT, () => {
    console.log(`Servidor proxy iniciado na porta ${PORT}`);
    
    // Conecta ao proxy para testar
    console.log('\n=== Testando Gate.io Spot ===');
    const spotWs = new WebSocket(`ws://localhost:${PORT}/spot`);
    
    setTimeout(() => {
        console.log('\n=== Testando Gate.io Futures ===');
        const futuresWs = new WebSocket(`ws://localhost:${PORT}/futures`);
    }, 5000);
});

// Mantém o script rodando
process.on('SIGINT', () => {
    console.log('\nEncerrando servidor proxy...');
    proxyServer.close();
    process.exit();
}); 