const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const WebSocket = require('ws');

// Importar conectores reais das exchanges
const { GateIoConnector } = require('./src/gateio-connector');
const { MexcFuturesConnector } = require('./src/mexc-futures-connector');

const dev = true; // Sempre desenvolvimento
const hostname = 'localhost';
const port = parseInt(process.env.PORT, 10) || 3001;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

console.log(`🔧 Iniciando servidor de DESENVOLVIMENTO com WebSocket REAL`);
console.log(`🌐 Hostname: ${hostname}, Porta: ${port}`);

app.prepare().then(() => {
  // Criar servidor HTTP
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('❌ Erro no servidor HTTP:', err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  // Criar WebSocket Server para dados REAIS
  const wss = new WebSocket.Server({ 
    server,
    path: '/',
    perMessageDeflate: false
  });

  const clients = new Set();
  
  // Armazenamento de preços em tempo real das exchanges
  const marketPrices = {
    GATEIO_SPOT: {},
    MEXC_FUTURES: {}
  };

  let gateioConnector = null;
  let mexcConnector = null;

  // Símbolos prioritários para monitoramento
  const PRIORITY_SYMBOLS = [
    'BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT',
    'ADA/USDT', 'DOT/USDT', 'AVAX/USDT', 'MATIC/USDT', 'LINK/USDT'
  ];

  // Função para processar atualizações de preço das exchanges
  function handlePriceUpdate(update) {
    const { identifier, symbol, marketType, bestAsk, bestBid } = update;
    
    // Armazena o preço no cache
    if (identifier === 'GATEIO_SPOT') {
      marketPrices.GATEIO_SPOT[symbol] = { bestAsk, bestBid, timestamp: Date.now() };
    } else if (identifier === 'MEXC_FUTURES') {
      marketPrices.MEXC_FUTURES[symbol] = { bestAsk, bestBid, timestamp: Date.now() };
    }

    // Envia atualização para clientes conectados
    const priceUpdate = {
      type: 'price-update',
      symbol,
      marketType,
      bestAsk,
      bestBid,
      timestamp: Date.now()
    };

    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(priceUpdate));
      }
    });

    console.log(`💰 [${identifier}] ${symbol} - Ask: ${bestAsk}, Bid: ${bestBid}`);
    
    // Verifica oportunidades de arbitragem após atualização
    findAndSendArbitrageOpportunities();
  }

  // Função para calcular e enviar oportunidades reais de arbitragem
  function findAndSendArbitrageOpportunities() {
    const opportunities = [];
    const MIN_PROFIT_PERCENTAGE = 0.1; // 0.1% mínimo

    // Itera sobre todos os símbolos com preços disponíveis
    Object.keys(marketPrices.GATEIO_SPOT).forEach(symbol => {
      const spotData = marketPrices.GATEIO_SPOT[symbol];
      const futuresData = marketPrices.MEXC_FUTURES[symbol];

      if (!spotData || !futuresData) return;
      if (spotData.bestAsk <= 0 || spotData.bestBid <= 0 || futuresData.bestAsk <= 0 || futuresData.bestBid <= 0) return;

      // Calcula preços médios para comparação mais precisa
      const spotMidPrice = (spotData.bestAsk + spotData.bestBid) / 2;
      const futuresMidPrice = (futuresData.bestAsk + futuresData.bestBid) / 2;

      // Calcula o spread percentual
      const spread = ((futuresMidPrice - spotMidPrice) / spotMidPrice) * 100;

      // Verifica se o spread é significativo e dentro dos limites
      if (Math.abs(spread) >= MIN_PROFIT_PERCENTAGE && Math.abs(spread) <= 10) {
        
        if (spread > 0) {
          // Futures > Spot: Comprar Spot, Vender Futures
          const opportunity = {
            type: 'arbitrage',
            baseSymbol: symbol,
            profitPercentage: parseFloat(spread.toFixed(3)),
            buyAt: { 
              exchange: 'GATEIO', 
              marketType: 'spot', 
              price: spotData.bestAsk 
            },
            sellAt: { 
              exchange: 'MEXC', 
              marketType: 'futures', 
              price: futuresData.bestBid 
            },
            arbitrageType: 'spot_futures_inter_exchange',
            timestamp: Date.now(),
            maxSpread24h: Math.abs(spread) * 1.5
          };
          opportunities.push(opportunity);
        } else {
          // Spot > Futures: Comprar Futures, Vender Spot
          const opportunity = {
            type: 'arbitrage',
            baseSymbol: symbol,
            profitPercentage: parseFloat(Math.abs(spread).toFixed(3)),
            buyAt: { 
              exchange: 'MEXC', 
              marketType: 'futures', 
              price: futuresData.bestAsk 
            },
            sellAt: { 
              exchange: 'GATEIO', 
              marketType: 'spot', 
              price: spotData.bestBid 
            },
            arbitrageType: 'futures_spot_inter_exchange',
            timestamp: Date.now(),
            maxSpread24h: Math.abs(spread) * 1.5
          };
          opportunities.push(opportunity);
        }
      }
    });

    // Envia as melhores oportunidades
    opportunities
      .sort((a, b) => Math.abs(b.profitPercentage) - Math.abs(a.profitPercentage))
      .slice(0, 15) // Top 15 oportunidades
      .forEach(opportunity => {
        clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(opportunity));
          }
        });
        
        console.log(`📊 [REAL] ${opportunity.baseSymbol}: ${opportunity.profitPercentage}% (${opportunity.buyAt.exchange} → ${opportunity.sellAt.exchange})`);
      });
  }

  // Inicializar conectores das exchanges
  async function initializeExchangeConnectors() {
    try {
      console.log('🚀 Inicializando conectores das exchanges...');

      // Conector Gate.io Spot
      gateioConnector = new GateIoConnector(
        'GATEIO_SPOT',
        handlePriceUpdate,
        () => console.log('✅ Gate.io Spot conectado!')
      );

      // Conector MEXC Futures  
      mexcConnector = new MexcFuturesConnector(
        'MEXC_FUTURES',
        handlePriceUpdate,
        () => console.log('✅ MEXC Futures conectado!')
      );

      // Conectar aos WebSockets das exchanges
      await Promise.all([
        gateioConnector.connect(),
        mexcConnector.connect()
      ]);

      // Aguardar conexões estabilizarem
      setTimeout(async () => {
        try {
          console.log('📡 Inscrevendo nos símbolos prioritários...');
          
          // Inscrever nos símbolos prioritários
          await gateioConnector.subscribe(PRIORITY_SYMBOLS);
          await mexcConnector.subscribe(PRIORITY_SYMBOLS);
          
          console.log('✅ Inscrições realizadas com sucesso!');
        } catch (error) {
          console.error('❌ Erro ao inscrever nos símbolos:', error);
        }
      }, 3000);

    } catch (error) {
      console.error('❌ Erro ao inicializar conectores:', error);
    }
  }

  // WebSocket Server para clientes
  wss.on('connection', function connection(ws, request) {
    const ip = request.socket.remoteAddress;
    clients.add(ws);
    
    console.log(`✅ Cliente conectado de ${ip}, total: ${clients.size}`);

    // Enviar mensagem de boas-vindas
    ws.send(JSON.stringify({
      type: 'connection',
      message: 'Conectado ao sistema de arbitragem REAL com Gate.io e MEXC!',
      timestamp: Date.now()
    }));

    // Enviar dados iniciais se disponíveis
    setTimeout(() => {
      if (Object.keys(marketPrices.GATEIO_SPOT).length > 0 || Object.keys(marketPrices.MEXC_FUTURES).length > 0) {
        findAndSendArbitrageOpportunities();
      }
    }, 2000);

    ws.on('message', function message(data) {
      console.log('📨 Mensagem recebida:', data.toString());
    });

    ws.on('close', function close() {
      clients.delete(ws);
      console.log(`❌ Cliente desconectado de ${ip}, total: ${clients.size}`);
    });

    ws.on('error', function error(err) {
      console.error('❌ Erro no WebSocket:', err);
      clients.delete(ws);
    });
  });

  // Heartbeat para manter conexões vivas
  const interval = setInterval(function ping() {
    wss.clients.forEach(function each(ws) {
      if (ws.isAlive === false) {
        console.log('💀 Terminando conexão inativa');
        return ws.terminate();
      }
      
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', function close() {
    clearInterval(interval);
  });

  // Iniciar servidor
  server.listen(port, hostname, () => {
    console.log(`🚀 Servidor DESENVOLVIMENTO rodando em http://${hostname}:${port}`);
    console.log(`📡 WebSocket Server ativo para dados REAIS`);
    console.log(`💰 Monitorando oportunidades Gate.io ↔ MEXC`);
    console.log(`🔗 Teste WebSocket: http://${hostname}:${port}/test-real-websocket.html`);
    
    // Inicializar conectores das exchanges
    initializeExchangeConnectors();
  });

  server.on('error', (err) => {
    console.error('❌ Erro no servidor:', err);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 Recebido SIGTERM, encerrando servidor...');
    server.close(() => {
      if (gateioConnector) gateioConnector.disconnect?.();
      if (mexcConnector) mexcConnector.disconnect?.();
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('🛑 Recebido SIGINT, encerrando servidor...');
    server.close(() => {
      if (gateioConnector) gateioConnector.disconnect?.();
      if (mexcConnector) mexcConnector.disconnect?.();
      process.exit(0);
    });
  });
}); 