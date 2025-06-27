const WebSocket = require('ws');
const fetch = require('node-fetch');

const MEXC_FUTURES_WS_URL = 'wss://contract.mexc.com/edge';
const REST_URL = 'https://contract.mexc.com/api/v1/contract/detail';

async function getSymbols() {
    try {
        console.log('\n=== Buscando Lista de Símbolos ===');
        console.log('Tentando buscar lista dinâmica da API...');
        console.log('URL:', REST_URL);
        
        const response = await fetch(REST_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 15000
        });
        
        console.log('Status da resposta:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const text = await response.text();
        console.log('\nResposta bruta da API:', text.substring(0, 1000), '...');
        
        const data = JSON.parse(text);
        console.log('\nEstrutura da resposta:', Object.keys(data));
        
        if (data.data && Array.isArray(data.data)) {
            const symbols = data.data
                .filter(contract => 
                    contract.quoteCoin === 'USDT' && 
                    contract.futureType === 1 && 
                    !contract.symbol.includes('_INDEX_')
                )
                .map(contract => contract.symbol);
            
            console.log('\n=== Lista Dinâmica Obtida com Sucesso! ===');
            console.log(`Total de pares encontrados: ${symbols.length}`);
            console.log('Primeiros 10 pares:', symbols.slice(0, 10));
            console.log('...');
            console.log('Últimos 5 pares:', symbols.slice(-5));
            console.log('=====================================\n');
            return symbols;
        }
        
        throw new Error(`Formato de resposta inválido. Estrutura recebida: ${JSON.stringify(data).substring(0, 200)}...`);
    } catch (error) {
        console.error('\n=== ERRO NA BUSCA DINÂMICA ===');
        console.error('Detalhes do erro:', error.message);
        console.log('\n=== USANDO LISTA DE FALLBACK ===');
        console.log('Motivo: Falha na busca dinâmica, usando lista fixa de segurança');
        
        const fallbackList = [
            'BTC_USDT',
            'ETH_USDT',
            'SOL_USDT',
            'XRP_USDT',
            'BNB_USDT'
        ];
        
        console.log('Pares no fallback:', fallbackList);
        console.log('=====================================\n');
        return fallbackList;
    }
}

async function connect() {
    const symbols = await getSymbols();
    console.log('Conectando ao WebSocket da MEXC...');
    
    const ws = new WebSocket(MEXC_FUTURES_WS_URL, {
        handshakeTimeout: 30000,
        timeout: 30000,
        perMessageDeflate: false,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });

    ws.on('open', () => {
        console.log('Conexão estabelecida!');

        // Envia subscrições para todos os símbolos
        symbols.forEach(symbol => {
            const msg = {
                method: "sub.ticker",
                param: { symbol }
            };
            
            console.log('Enviando subscrição:', JSON.stringify(msg));
            ws.send(JSON.stringify(msg));
        });

        // Inicia heartbeat com intervalo de 20 segundos
        setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.ping();
                console.log('Ping enviado');
            }
        }, 20000);
    });

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            
            // Se for uma atualização de ticker
            if (message.channel === 'push.ticker' && message.data) {
                const ticker = message.data;
                const bestAsk = parseFloat(ticker.ask1);
                const bestBid = parseFloat(ticker.bid1);
                
                if (bestAsk && bestBid) {
                    const spread = ((bestAsk - bestBid) / bestBid * 100).toFixed(4);
                    console.log(`Preços atualizados para ${ticker.symbol}:`, {
                        bestAsk,
                        bestBid,
                        spread: spread + '%'
                    });
                }
            }
        } catch (error) {
            console.error('Erro ao processar mensagem:', error);
        }
    });

    ws.on('pong', () => {
        console.log('Pong recebido');
    });

    ws.on('close', (code, reason) => {
        console.log('Conexão fechada:', code, reason);
        // Tenta reconectar após 5 segundos
        setTimeout(connect, 5000);
    });

    ws.on('error', (error) => {
        console.error('Erro na conexão:', error);
    });
}

// Inicia a conexão
connect(); 