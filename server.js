const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const WebSocket = require('ws');
require('dotenv').config();

const dev = process.env.NODE_ENV !== 'production';
const port = process.env.PORT || 10000;

const app = next({ dev });
const handle = app.getRequestHandler();

// Importa as funções do monitor
const { startMonitor, broadcast } = require('./monitor');

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
  
  wss.on('connection', (ws) => {
    console.log('Cliente WebSocket conectado');
    
    ws.on('close', () => {
      console.log('Cliente WebSocket desconectado');
    });
  });

  // Inicia o monitor com o servidor WebSocket
  startMonitor(wss);

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on port ${port}`);
  });
}); 