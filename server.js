const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const WebSocket = require('ws');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT, 10) || 10000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

console.log(`🔧 Iniciando servidor em modo: ${dev ? 'desenvolvimento' : 'produção'}`);
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

  // Criar WebSocket Server
  const wss = new WebSocket.Server({ 
    server,
    path: '/',
    perMessageDeflate: false
  });

  const clients = new Set();

  wss.on('connection', function connection(ws, request) {
    const ip = request.socket.remoteAddress;
    clients.add(ws);
    
    console.log(`✅ WebSocket conectado de ${ip}, total: ${clients.size}`);

    // Enviar mensagem de boas-vindas
    ws.send(JSON.stringify({
      type: 'connection',
      message: 'Conectado com sucesso!',
      timestamp: Date.now()
    }));

    // Enviar dados de teste imediatamente
    setTimeout(() => {
      ws.send(JSON.stringify({
        type: 'arbitrage',
        baseSymbol: 'BTC/USDT',
        profitPercentage: 0.75,
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
      }));
    }, 1000);

    ws.on('message', function message(data) {
      console.log('📨 Mensagem recebida:', data.toString());
    });

    ws.on('close', function close() {
      clients.delete(ws);
      console.log(`❌ WebSocket desconectado de ${ip}, total: ${clients.size}`);
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

  // Enviar dados simulados periodicamente
  setInterval(() => {
    if (clients.size > 0) {
      const symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT'];
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      
      const opportunity = {
        type: 'arbitrage',
        baseSymbol: symbol,
        profitPercentage: parseFloat((Math.random() * 2).toFixed(2)),
        buyAt: {
          exchange: Math.random() > 0.5 ? 'GATEIO' : 'MEXC',
          price: parseFloat((Math.random() * 100000).toFixed(2)),
          marketType: Math.random() > 0.5 ? 'spot' : 'futures'
        },
        sellAt: {
          exchange: Math.random() > 0.5 ? 'MEXC' : 'GATEIO',
          price: parseFloat((Math.random() * 100000).toFixed(2)),
          marketType: Math.random() > 0.5 ? 'futures' : 'spot'
        },
        arbitrageType: 'spot_futures_inter_exchange',
        timestamp: Date.now(),
        maxSpread24h: parseFloat((Math.random() * 3).toFixed(2))
      };

      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(opportunity));
        }
      });

      console.log(`📡 Dados enviados para ${clients.size} clientes: ${symbol}`);
    }
  }, 15000); // A cada 15 segundos

  // Iniciar servidor
  server.listen(port, hostname, () => {
    console.log(`🚀 Servidor rodando em http://${hostname}:${port}`);
    console.log(`📡 WebSocket Server ativo`);
  });

  server.on('error', (err) => {
    console.error('❌ Erro no servidor:', err);
  });
}); 