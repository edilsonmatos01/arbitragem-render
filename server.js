const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
require('dotenv').config();

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Importa e inicia o servidor WebSocket como um módulo.
// Precisamos garantir que o websocket-server.ts exporte uma função de inicialização
// e não inicie um servidor por conta própria.
<<<<<<< HEAD
const { startWebSocketServer } = require('./dist/src/websocket-server');
=======
const { startWebSocketServer } = require('./dist/websocket-server');
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // Inicia o servidor WebSocket, anexando-o ao servidor HTTP principal.
  startWebSocketServer(httpServer);

  const port = process.env.PORT || 3000;
  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
}); 