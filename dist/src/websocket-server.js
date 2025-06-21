"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const ws_1 = __importDefault(require("ws"));
const gateio_connector_1 = require("./gateio-connector");
const mexc_connector_1 = require("./mexc-connector");
const PORT = process.env.PORT || 10000;
const clients = [];
const marketPrices = {};
function handlePriceUpdate(data) {
    const { symbol, marketType, bestAsk, bestBid, identifier } = data;
    const key = `${identifier}_${symbol}`;
    const oldPrice = marketPrices[key];
    const spreadInterno = ((bestAsk - bestBid) / bestBid) * 100;
    let askVariacao = 0;
    let bidVariacao = 0;
    if (oldPrice) {
        askVariacao = ((bestAsk - oldPrice.bestAsk) / oldPrice.bestAsk) * 100;
        bidVariacao = ((bestBid - oldPrice.bestBid) / oldPrice.bestBid) * 100;
    }
    marketPrices[key] = { bestAsk, bestBid, marketType, lastUpdate: Date.now() };
    console.log(`\n[Preço Atualizado] ${identifier} - ${symbol}`);
    console.log(`Ask: ${bestAsk}, Bid: ${bestBid}`);
    console.log(`Spread interno: ${spreadInterno.toFixed(4)}%`);
    console.log(`Variação: Ask ${askVariacao.toFixed(4)}%, Bid ${bidVariacao.toFixed(4)}%`);
    const message = JSON.stringify({
        type: 'price-update',
        data: {
            symbol,
            marketType,
            bestAsk,
            bestBid,
            spreadInterno,
            askVariacao,
            bidVariacao,
            identifier,
            timestamp: Date.now()
        }
    });
    const activeClients = clients.filter(client => client.readyState === ws_1.default.OPEN);
    activeClients.forEach(client => client.send(message));
    console.log(`[Broadcast] Preço enviado para ${activeClients.length} clientes`);
}
async function startFeeds() {
    console.log('\n[Servidor] Iniciando feeds das exchanges...');
    try {
        const gateio = new gateio_connector_1.GateIoConnector('GATEIO_SPOT', handlePriceUpdate, () => {
            console.log('[Servidor] Gate.io conectada, buscando pares...');
            gateio.getTradablePairs().then(pairs => {
                console.log(`[Gate.io] Inscrevendo em ${pairs.length} pares`);
                gateio.subscribe(pairs);
            });
        });
        const mexc = new mexc_connector_1.MexcConnector('MEXC_SPOT', handlePriceUpdate, () => {
            console.log('[Servidor] MEXC conectada, buscando pares...');
            mexc.getTradablePairs().then(pairs => {
                console.log(`[MEXC] Inscrevendo em ${pairs.length} pares`);
                mexc.subscribe(pairs);
            });
        });
        console.log('\n[Servidor] Iniciando conexões...');
        await Promise.all([
            gateio.connect(),
            mexc.connect()
        ]);
        console.log('\n[Servidor] Feeds iniciados com sucesso!');
    }
    catch (error) {
        console.error('\n[Servidor] Erro ao iniciar feeds:', error);
    }
}
function initializeStandaloneServer() {
    const httpServer = http_1.default.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'healthy', clients: clients.length }));
            return;
        }
        if (req.url === '/status') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                exchanges: Object.keys(marketPrices),
                lastUpdate: Math.max(...Object.values(marketPrices).map(p => p.lastUpdate)),
                clientCount: clients.length
            }));
            return;
        }
        res.writeHead(404);
        res.end();
    });
    const wss = new ws_1.default.Server({ server: httpServer });
    wss.on('connection', (ws) => {
        console.log('\n[Servidor] Novo cliente conectado');
        clients.push(ws);
        ws.on('close', () => {
            const index = clients.indexOf(ws);
            if (index > -1) {
                clients.splice(index, 1);
                console.log('\n[Servidor] Cliente desconectado');
            }
        });
    });
    httpServer.listen(PORT, () => {
        console.log(`\n[Servidor] WebSocket server iniciado na porta ${PORT}`);
        startFeeds();
    });
}
initializeStandaloneServer();
//# sourceMappingURL=websocket-server.js.map