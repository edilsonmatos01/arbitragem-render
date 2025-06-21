const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const WebSocket = require('ws');
require('dotenv').config();

const dev = process.env.NODE_ENV !== 'production';
const port = process.env.PORT || 10000;

const app = next({ dev });
const handle = app.getRequestHandler();

// Dados simulados para teste
const mockData = {
  opportunities: [
    {
      type: 'arbitrage',
      baseSymbol: 'BTC/USDT',
      profitPercentage: 0.85,
      buyAt: {
        exchange: 'GATEIO',
        price: 97250.50,
        marketType: 'spot'
      },
      sellAt: {
        exchange: 'MEXC',
        price: 98075.25,
        marketType: 'futures'
      },
      arbitrageType: 'spot_futures_inter_exchange',
      timestamp: Date.now(),
      maxSpread24h: 1.2
    },
    {
      type: 'arbitrage',
      baseSymbol: 'ETH/USDT',
      profitPercentage: 0.45,
      buyAt: {
        exchange: 'MEXC',
        price: 3425.80,
        marketType: 'spot'
      },
      sellAt: {
        exchange: 'GATEIO',
        price: 3441.25,
        marketType: 'futures'
      },
      arbitrageType: 'spot_futures_inter_exchange',
      timestamp: Date.now(),
      maxSpread24h: 0.8
    }
  ]
};

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  // Configurar WebSocket Server
  const wss = new WebSocket.Server({ server });
  const clients = new Set();
  
  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress || req.headers['x-forwarded-for'];
    clients.add(ws);
    
    console.log(`[WebSocket] Cliente conectado: ${clientIp}. Total: ${clients.size}`);
    
    // Enviar dados iniciais
    ws.send(JSON.stringify({
      type: 'connection',
      message: 'Conectado ao servidor de arbitragem',
      timestamp: Date.now()
    }));
    
    // Enviar oportunidades mock iniciais
    mockData.opportunities.forEach(opportunity => {
      ws.send(JSON.stringify(opportunity));
    });
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('[WebSocket] Mensagem recebida:', data);
      } catch (error) {
        console.error('[WebSocket] Erro ao processar mensagem:', error);
      }
    });
    
    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[WebSocket] Cliente desconectado: ${clientIp}. Total: ${clients.size}`);
    });
    
    ws.on('error', (error) => {
      console.error('[WebSocket] Erro na conexão:', error);
      clients.delete(ws);
    });
  });

  // Função para broadcast de dados
  function broadcast(data) {
    const message = JSON.stringify(data);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  // Simular dados em tempo real
  setInterval(() => {
    if (clients.size > 0) {
      const randomOpportunity = {
        type: 'arbitrage',
        baseSymbol: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'][Math.floor(Math.random() * 3)],
        profitPercentage: (Math.random() * 2).toFixed(2),
        buyAt: {
          exchange: Math.random() > 0.5 ? 'GATEIO' : 'MEXC',
          price: (50000 + Math.random() * 50000).toFixed(2),
          marketType: Math.random() > 0.5 ? 'spot' : 'futures'
        },
        sellAt: {
          exchange: Math.random() > 0.5 ? 'GATEIO' : 'MEXC',
          price: (50000 + Math.random() * 50000).toFixed(2),
          marketType: Math.random() > 0.5 ? 'spot' : 'futures'
        },
        arbitrageType: 'spot_futures_inter_exchange',
        timestamp: Date.now(),
        maxSpread24h: (Math.random() * 3).toFixed(2)
      };
      
      broadcast(randomOpportunity);
      console.log(`[WebSocket] Enviado para ${clients.size} clientes:`, randomOpportunity.baseSymbol);
    }
  }, 10000); // A cada 10 segundos

  // Heartbeat para manter conexões vivas
  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    });
  }, 30000); // A cada 30 segundos

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`🚀 Servidor rodando na porta ${port}`);
    console.log(`📡 WebSocket Server ativo e enviando dados simulados`);
  });
}); 