const WebSocket = require('ws');
const { WebSocketServer } = require('ws');
const http = require('http');

// Configurações
const GATEIO_WS_URL = 'wss://api.gateio.ws/ws/v4/';
const MEXC_FUTURES_WS_URL = 'wss://contract.mexc.com/edge';
const LOCAL_PORT = 10000;

// Armazena os preços mais recentes
const marketPrices = {
    'GATEIO_SPOT': {},
    'GATEIO_FUTURES': {},
    'MEXC_FUTURES': {}
};

let targetPairs = [];
let clients = [];

// Função para calcular o spread usando preços médios
function calculateSpread(spotAsk, spotBid, futuresAsk, futuresBid) {
    if (!spotAsk || !spotBid || !futuresAsk || !futuresBid) return null;
    if (spotAsk <= 0 || spotBid <= 0 || futuresAsk <= 0 || futuresBid <= 0) return null;

    // Calcular preços médios para comparação mais justa
    const spotMidPrice = (spotAsk + spotBid) / 2;
    const futuresMidPrice = (futuresAsk + futuresBid) / 2;
    
    // Spread (%) = ((Futures - Spot) / Spot) × 100
    return ((futuresMidPrice - spotMidPrice) / spotMidPrice) * 100;
}

// Função para formatar preço
function formatPrice(price) {
    return price.toFixed(price >= 100 ? 2 : 4);
}

// Função para broadcast
function broadcast(data) {
    const serializedData = JSON.stringify(data);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(serializedData);
        }
    });
}

// Função para enviar oportunidade
function broadcastOpportunity(opportunity) {
    console.log(`[DEBUG] Verificando ${opportunity.baseSymbol} | Spread: ${opportunity.profitPercentage.toFixed(2)}%`);

    if (!isFinite(opportunity.profitPercentage) || opportunity.profitPercentage > 100) {
        console.warn(`[FILTRO] Spread >100% IGNORADO para ${opportunity.baseSymbol}: ${opportunity.profitPercentage.toFixed(2)}%`);
        return;
    }
    
    broadcast({ ...opportunity, type: 'arbitrage' });
    console.log(`[Broadcast] Oportunidade VÁLIDA enviada: ${opportunity.baseSymbol} ${opportunity.profitPercentage.toFixed(2)}%`);
}

// Função para identificar oportunidades de arbitragem
function checkArbitrageOpportunities() {
    targetPairs.forEach(symbol => {
        const baseSymbol = symbol.replace('_', '/');
        
        // Obter preços de todos os mercados
        const gateioSpot = marketPrices['GATEIO_SPOT'][symbol];
        const gateioFutures = marketPrices['GATEIO_FUTURES'][symbol];
        const mexcFutures = marketPrices['MEXC_FUTURES'][symbol];

        // Gate.io Spot <-> MEXC Futures
        if (gateioSpot && mexcFutures) {
            const spread = calculateSpread(
                gateioSpot.bestAsk,
                gateioSpot.bestBid,
                mexcFutures.bestAsk,
                mexcFutures.bestBid
            );

            if (spread && Math.abs(spread) >= 0.1 && Math.abs(spread) <= 10) {
                if (spread > 0) {
                    // Futures > Spot: Comprar Spot, Vender Futures
                    const opportunity = {
                        type: 'arbitrage',
                        baseSymbol,
                        buyAt: {
                            exchange: 'GATEIO',
                            price: gateioSpot.bestAsk,
                            marketType: 'spot'
                        },
                        sellAt: {
                            exchange: 'MEXC',
                            price: mexcFutures.bestBid,
                            marketType: 'futures'
                        },
                        arbitrageType: 'spot_to_futures',
                        profitPercentage: spread,
                        timestamp: Date.now()
                    };
                    broadcastOpportunity(opportunity);
                } else {
                    // Spot > Futures: Comprar Futures, Vender Spot
                    const opportunity = {
                        type: 'arbitrage',
                        baseSymbol,
                        buyAt: {
                            exchange: 'MEXC',
                            price: mexcFutures.bestAsk,
                            marketType: 'futures'
                        },
                        sellAt: {
                            exchange: 'GATEIO',
                            price: gateioSpot.bestBid,
                            marketType: 'spot'
                        },
                        arbitrageType: 'futures_to_spot',
                        profitPercentage: Math.abs(spread),
                        timestamp: Date.now()
                    };
                    broadcastOpportunity(opportunity);
                }
            }
        }

        // Gate.io Intra (Spot <-> Futures)
        if (gateioSpot && gateioFutures) {
            const spread = calculateSpread(
                gateioSpot.bestAsk,
                gateioSpot.bestBid,
                gateioFutures.bestAsk,
                gateioFutures.bestBid
            );

            if (spread && Math.abs(spread) >= 0.1 && Math.abs(spread) <= 10) {
                if (spread > 0) {
                    const opportunity = {
                        type: 'arbitrage',
                        baseSymbol,
                        buyAt: {
                            exchange: 'GATEIO',
                            price: gateioSpot.bestAsk,
                            marketType: 'spot'
                        },
                        sellAt: {
                            exchange: 'GATEIO',
                            price: gateioFutures.bestBid,
                            marketType: 'futures'
                        },
                        arbitrageType: 'spot_futures_intra_exchange',
                        profitPercentage: spread,
                        timestamp: Date.now()
                    };
                    broadcastOpportunity(opportunity);
                }
            }
        }
    });
}

// Inicializar servidor WebSocket local
const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', message: 'WebSocket server is running' }));
    } else {
        res.writeHead(404);
        res.end();
    }
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
    });
    
    clients.push(ws);
    console.log(`[WS Server] Cliente conectado. Total: ${clients.length}`);

    if (Object.keys(marketPrices).length > 0) {
        ws.send(JSON.stringify({ type: 'full_book', data: marketPrices }));
    }

    ws.on('close', () => {
        clients = clients.filter(c => c !== ws);
        console.log(`[WS Server] Cliente desconectado. Total: ${clients.length}`);
    });
});

// Conectar ao Gate.io
const gateioWs = new WebSocket(GATEIO_WS_URL);

gateioWs.on('open', () => {
    console.log('Conectado ao WebSocket da Gate.io');
    
    // Primeiro, vamos buscar os pares disponíveis
    const spotListMessage = {
        time: Math.floor(Date.now() / 1000),
        channel: 'spot.book_ticker',
        event: 'subscribe',
        payload: ['BTC_USDT'] // Começa com BTC para obter a lista completa
    };
    
    gateioWs.send(JSON.stringify(spotListMessage));
});

gateioWs.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());
        
        if (message.channel === 'spot.book_ticker' && message.event === 'update') {
            const ticker = message.result;
            const symbol = ticker.s || ticker.currency_pair;
            marketPrices['GATEIO_SPOT'][symbol] = {
                bestAsk: parseFloat(ticker.a || ticker.ask),
                bestBid: parseFloat(ticker.b || ticker.bid)
            };

            // Se ainda não temos pares alvo, vamos usar este para iniciar
            if (targetPairs.length === 0 && symbol) {
                targetPairs.push(symbol);
                
                // Subscrever aos canais de spot e futures para este par
                const spotSubscribeMessage = {
                    time: Math.floor(Date.now() / 1000),
                    channel: 'spot.book_ticker',
                    event: 'subscribe',
                    payload: [symbol]
                };
                
                const futuresSubscribeMessage = {
                    time: Math.floor(Date.now() / 1000),
                    channel: 'futures.book_ticker',
                    event: 'subscribe',
                    payload: [symbol]
                };
                
                gateioWs.send(JSON.stringify(spotSubscribeMessage));
                gateioWs.send(JSON.stringify(futuresSubscribeMessage));

                // Subscrever na MEXC também
                if (mexcWs.readyState === WebSocket.OPEN) {
                    const mexcSubscribeMessage = {
                        method: 'sub.ticker',
                        param: {
                            symbol: symbol
                        }
                    };
                    mexcWs.send(JSON.stringify(mexcSubscribeMessage));
                }
            }

            // Broadcast da atualização de preço
            broadcast({
                type: 'price-update',
                symbol,
                marketType: 'spot',
                bestAsk: parseFloat(ticker.a || ticker.ask),
                bestBid: parseFloat(ticker.b || ticker.bid)
            });

            checkArbitrageOpportunities();
        }
        else if (message.channel === 'futures.book_ticker' && message.event === 'update') {
            const ticker = message.result;
            const symbol = ticker.s || ticker.contract;
            marketPrices['GATEIO_FUTURES'][symbol] = {
                bestAsk: parseFloat(ticker.a || ticker.ask1),
                bestBid: parseFloat(ticker.b || ticker.bid1)
            };

            // Broadcast da atualização de preço
            broadcast({
                type: 'price-update',
                symbol,
                marketType: 'futures',
                bestAsk: parseFloat(ticker.a || ticker.ask1),
                bestBid: parseFloat(ticker.b || ticker.bid1)
            });

            checkArbitrageOpportunities();
        }
    } catch (error) {
        console.error('Erro ao processar mensagem da Gate.io:', error);
    }
});

// Conectar à MEXC Futures
const mexcWs = new WebSocket(MEXC_FUTURES_WS_URL);

mexcWs.on('open', () => {
    console.log('Conectado ao WebSocket Futures da MEXC');
    
    // A subscrição será feita quando recebermos os pares da Gate.io
    if (targetPairs.length > 0) {
        targetPairs.forEach(symbol => {
            const subscribeMessage = {
                method: 'sub.ticker',
                param: {
                    symbol: symbol
                }
            };
            mexcWs.send(JSON.stringify(subscribeMessage));
        });
    }

    // Iniciar ping
    setInterval(() => {
        if (mexcWs.readyState === WebSocket.OPEN) {
            mexcWs.send(JSON.stringify({ method: "ping" }));
        }
    }, 20000);
});

mexcWs.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());
        if (message.channel === 'push.ticker' && message.data) {
            const ticker = message.data;
            const symbol = ticker.symbol;
            marketPrices['MEXC_FUTURES'][symbol] = {
                bestAsk: parseFloat(ticker.ask1),
                bestBid: parseFloat(ticker.bid1)
            };

            // Broadcast da atualização de preço
            broadcast({
                type: 'price-update',
                symbol,
                marketType: 'futures',
                bestAsk: parseFloat(ticker.ask1),
                bestBid: parseFloat(ticker.bid1)
            });

            checkArbitrageOpportunities();
        }
    } catch (error) {
        console.error('Erro ao processar mensagem da MEXC:', error);
    }
});

// Tratamento de erros e reconexão
[gateioWs, mexcWs].forEach(ws => {
    ws.on('error', (error) => {
        console.error('Erro na conexão:', error);
    });

    ws.on('close', () => {
        console.log('Conexão fechada');
    });
});

// Iniciar o servidor na porta local
server.listen(LOCAL_PORT, () => {
    console.log(`Servidor WebSocket iniciado na porta ${LOCAL_PORT}`);
}); 