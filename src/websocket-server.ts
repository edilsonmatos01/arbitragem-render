import http from 'http';
import WebSocket from 'ws';
import { GateIoConnector } from './gateio-connector';
import { MexcConnector } from './mexc-connector';

const PORT = process.env.PORT || 10000;
const clients: WebSocket[] = [];
const marketPrices: { [key: string]: any } = {};

function handlePriceUpdate(data: any) {
    const { symbol, marketType, bestAsk, bestBid, identifier } = data;
    const key = `${identifier}_${symbol}`;
    
    // Calcula spread interno e variação
    const oldPrice = marketPrices[key];
    const spreadInterno = ((bestAsk - bestBid) / bestBid) * 100;
    let askVariacao = 0;
    let bidVariacao = 0;

    if (oldPrice) {
        askVariacao = ((bestAsk - oldPrice.bestAsk) / oldPrice.bestAsk) * 100;
        bidVariacao = ((bestBid - oldPrice.bestBid) / oldPrice.bestBid) * 100;
    }

    // Atualiza preços no cache
    marketPrices[key] = { bestAsk, bestBid, marketType, lastUpdate: Date.now() };

    console.log(`\n[Preço Atualizado] ${identifier} - ${symbol}`);
    console.log(`Ask: ${bestAsk}, Bid: ${bestBid}`);
    console.log(`Spread interno: ${spreadInterno.toFixed(4)}%`);
    console.log(`Variação: Ask ${askVariacao.toFixed(4)}%, Bid ${bidVariacao.toFixed(4)}%`);

    // Envia atualização para todos os clientes
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

    const activeClients = clients.filter(client => client.readyState === WebSocket.OPEN);
    activeClients.forEach(client => client.send(message));
    console.log(`[Broadcast] Preço enviado para ${activeClients.length} clientes`);
}

async function startFeeds() {
    console.log('\n[Servidor] Iniciando feeds das exchanges...');

    try {
        // Inicializa Gate.io
        const gateio = new GateIoConnector('GATEIO_SPOT', handlePriceUpdate, () => {
            console.log('[Servidor] Gate.io conectada, buscando pares...');
            gateio.getTradablePairs().then(pairs => {
                console.log(`[Gate.io] Inscrevendo em ${pairs.length} pares`);
                gateio.subscribe(pairs);
            });
        });

        // Inicializa MEXC
        const mexc = new MexcConnector('MEXC_SPOT', handlePriceUpdate, () => {
            console.log('[Servidor] MEXC conectada, buscando pares...');
            mexc.getTradablePairs().then(pairs => {
                console.log(`[MEXC] Inscrevendo em ${pairs.length} pares`);
                mexc.subscribe(pairs);
            });
        });

        // Inicia as conexões
        console.log('\n[Servidor] Iniciando conexões...');
        await Promise.all([
            gateio.connect(),
            mexc.connect()
        ]);

        console.log('\n[Servidor] Feeds iniciados com sucesso!');
    } catch (error) {
        console.error('\n[Servidor] Erro ao iniciar feeds:', error);
    }
}

function initializeStandaloneServer() {
    const httpServer = http.createServer((req, res) => {
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

    const wss = new WebSocket.Server({ server: httpServer });

    wss.on('connection', (ws: WebSocket) => {
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