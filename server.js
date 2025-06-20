const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const WebSocket = require('ws');
require('dotenv').config();

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Importa as funções do monitor
const { startMonitor, broadcast } = require('./monitor');

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
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

  const port = process.env.PORT || 10000;
  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
}); 