const WebSocket = require('ws');
const fetch = require('node-fetch');

const GATEIO_WS_URL = 'wss://api.gateio.ws/ws/v4/';
const REST_URL = 'https://api.gateio.ws/api/v4/spot/currency_pairs';

async function getSpotSymbols() {
    try {
        console.log('\n=== Buscando Lista de Símbolos SPOT ===');
        console.log('Tentando buscar lista dinâmica da API...');
        console.log('URL:', REST_URL);
        
        const response = await fetch(REST_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        console.log('Status da resposta:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('\nTipo de resposta:', Array.isArray(data) ? 'Array' : typeof data);
        console.log('Total de itens:', Array.isArray(data) ? data.length : 'N/A');
        
        if (Array.isArray(data)) {
            const usdtPairs = data
                .filter(pair => 
                    pair.quote === 'USDT' && 
                    pair.trade_status === 'tradable'
                )
                .map(pair => `${pair.base}_${pair.quote}`);
            
            console.log('\n=== Lista SPOT Obtida com Sucesso! ===');
            console.log(`Total de pares USDT encontrados: ${usdtPairs.length}`);
            console.log('Primeiros 10 pares:', usdtPairs.slice(0, 10));
            console.log('...');
            console.log('Últimos 5 pares:', usdtPairs.slice(-5));
            console.log('=====================================\n');
            
            // Focar apenas nos pares principais
            const targetPairs = usdtPairs.filter(symbol => 
                ['BTC_USDT', 'ETH_USDT', 'SOL_USDT', 'XRP_USDT', 'BNB_USDT'].includes(symbol)
            );
            
            console.log('Pares principais encontrados:', targetPairs);
            return targetPairs.length > 0 ? targetPairs : ['BTC_USDT', 'ETH_USDT'];
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
    const symbols = await getSpotSymbols();
    console.log('Conectando ao WebSocket SPOT do Gate.io...');
    
    const ws = new WebSocket(GATEIO_WS_URL, {
        handshakeTimeout: 30000,
        timeout: 30000,
        perMessageDeflate: false,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    });

    ws.on('open', () => {
        console.log('Conexão SPOT estabelecida!');

        // Envia subscrições para todos os símbolos
        symbols.forEach((symbol, index) => {
            const msg = {
                time: Math.floor(Date.now() / 1000),
                channel: "spot.tickers",
                event: "subscribe",
                payload: [symbol]
            };
            
            console.log(`Enviando subscrição SPOT (${index + 1}/${symbols.length}):`, JSON.stringify(msg));
            ws.send(JSON.stringify(msg));
        });

        // Inicia heartbeat com intervalo de 20 segundos
        setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.ping();
                console.log('Ping enviado para Gate.io SPOT');
            }
        }, 20000);
    });

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            
            // Log de eventos
            if (message.event) {
                console.log(`[EVENTO] ${message.event}: ${message.result || message.error || 'ok'}`);
                return;
            }
            
            // Se for uma atualização de ticker SPOT
            if (message.channel === 'spot.tickers' && message.result) {
                const ticker = message.result;
                const symbol = ticker.currency_pair;
                const bestAsk = parseFloat(ticker.lowest_ask);
                const bestBid = parseFloat(ticker.highest_bid);
                
                if (bestAsk && bestBid && bestAsk > 0 && bestBid > 0) {
                    const spread = ((bestAsk - bestBid) / bestBid * 100).toFixed(4);
                    console.log(`Preços SPOT atualizados para ${symbol}:`, {
                        bestAsk,
                        bestBid,
                        spread: spread + '%'
                    });
                } else {
                    console.log(`[SKIP] ${symbol}: Ask=${bestAsk}, Bid=${bestBid} (inválido)`);
                }
            } else {
                // Log de outras mensagens
                console.log('[MSG]', Object.keys(message).join(','), ':', JSON.stringify(message).substring(0, 100));
            }
        } catch (error) {
            console.error('Erro ao processar mensagem:', error);
        }
    });

    ws.on('pong', () => {
        console.log('Pong recebido do Gate.io SPOT');
    });

    ws.on('close', (code, reason) => {
        console.log('Conexão SPOT fechada:', code, reason);
        // Tenta reconectar após 5 segundos
        setTimeout(connect, 5000);
    });

    ws.on('error', (error) => {
        console.error('Erro na conexão SPOT:', error);
    });
}

// Inicia a conexão
connect(); 