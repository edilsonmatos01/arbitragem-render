"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWebSocketServer = startWebSocketServer;
require('dotenv').config();
const ws_1 = __importDefault(require("ws"));
const http_1 = require("http");
const gateio_connector_1 = require("./gateio-connector");
const mexc_connector_1 = require("./mexc-connector");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const PORT = process.env.PORT || 10000;
const MIN_PROFIT_PERCENTAGE = 0.1;
let marketPrices = {};
let targetPairs = [];
let clients = [];
let exchangeConnectors = new Map();
function handlePriceUpdate(update) {
    const { identifier, symbol, marketType, bestAsk, bestBid } = update;
    // 1. Atualiza o estado central de preços
    if (!marketPrices[identifier]) {
        marketPrices[identifier] = {};
    }
    marketPrices[identifier][symbol] = { bestAsk, bestBid, timestamp: Date.now() };
    // 2. Transmite a atualização para todos os clientes
    broadcast({
        type: 'price-update',
        symbol,
        marketType,
        bestAsk,
        bestBid,
        identifier
    });
}
function startWebSocketServer(httpServer) {
    const wss = new ws_1.default.Server({ server: httpServer });
    wss.on('connection', (ws, req) => {
        ws.isAlive = true; // A conexão está viva ao ser estabelecida
        ws.on('pong', () => {
            ws.isAlive = true; // O cliente respondeu ao nosso ping, então está vivo
        });
        const clientIp = req.socket.remoteAddress || req.headers['x-forwarded-for'];
        clients.push(ws);
        console.log(`[WS Server] Cliente conectado: ${clientIp}. Total: ${clients.length}`);
        if (Object.keys(marketPrices).length > 0) {
            ws.send(JSON.stringify({ type: 'full_book', data: marketPrices }));
        }
        ws.on('close', () => {
            clients = clients.filter(c => c !== ws);
            console.log(`[WS Server] Cliente desconectado: ${clientIp}. Total: ${clients.length}`);
        });
    });
    // Intervalo para verificar conexões e mantê-las vivas
    const interval = setInterval(() => {
        wss.clients.forEach(client => {
            const ws = client;
            // Se o cliente não respondeu ao PING do ciclo anterior, encerre.
            if (ws.isAlive === false) {
                console.log('[WS Server] Conexão inativa terminada.');
                return ws.terminate();
            }
            // Marque como inativo e envie um PING. A resposta 'pong' marcará como vivo novamente.
            ws.isAlive = false;
            ws.ping(() => { }); // A função de callback vazia é necessária.
        });
    }, 30000); // A cada 30 segundos
    wss.on('close', () => {
        clearInterval(interval); // Limpa o intervalo quando o servidor é fechado
    });
    console.log(`Servidor WebSocket iniciado e anexado ao servidor HTTP.`);
    startFeeds();
}
// --- Início: Adição para Servidor Standalone ---
// Esta função cria e inicia um servidor HTTP que usa a nossa lógica WebSocket.
function initializeStandaloneServer() {
    const httpServer = (0, http_1.createServer)((req, res) => {
        // O servidor HTTP básico não fará nada além de fornecer uma base para o WebSocket.
        // Podemos adicionar um endpoint de health check simples.
        if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', message: 'WebSocket server is running' }));
        }
        else {
            res.writeHead(404);
            res.end();
        }
    });
    // Anexa a lógica do WebSocket ao nosso servidor HTTP.
    startWebSocketServer(httpServer);
    httpServer.listen(PORT, () => {
        console.log(`[Servidor Standalone] Servidor HTTP e WebSocket escutando na porta ${PORT}`);
    });
}
// Inicia o servidor standalone.
// O `require.main === module` garante que este código só rode quando
// o arquivo é executado diretamente (ex: `node dist/websocket-server.js`),
// mas não quando é importado por outro arquivo (como o `server.js` em dev).
if (require.main === module) {
    initializeStandaloneServer();
}
// --- Fim: Adição para Servidor Standalone ---
function broadcast(data) {
    const serializedData = JSON.stringify(data);
    clients.forEach(client => {
        if (client.readyState === ws_1.default.OPEN) {
            client.send(serializedData);
        }
    });
}
// Versão corrigida da função com logs de depuração
function broadcastOpportunity(opportunity) {
    console.log(`[DEBUG] Verificando ${opportunity.baseSymbol} | Spread: ${opportunity.profitPercentage.toFixed(2)}%`);
    if (!isFinite(opportunity.profitPercentage) || opportunity.profitPercentage > 100) {
        console.warn(`[FILTRO] Spread >100% IGNORADO para ${opportunity.baseSymbol}: ${opportunity.profitPercentage.toFixed(2)}%`);
        return;
    }
    broadcast({ ...opportunity, type: 'arbitrage' });
    console.log(`[Broadcast] Oportunidade VÁLIDA enviada: ${opportunity.baseSymbol} ${opportunity.profitPercentage.toFixed(2)}%`);
}
async function recordSpread(opportunity) {
    if (typeof opportunity.profitPercentage !== 'number' || !isFinite(opportunity.profitPercentage)) {
        console.warn(`[Prisma] Spread inválido para ${opportunity.baseSymbol}, gravação ignorada.`);
        return;
    }
    try {
        await prisma.spreadHistory.create({
            data: {
                symbol: opportunity.baseSymbol,
                exchangeBuy: opportunity.buyAt.exchange,
                exchangeSell: opportunity.sellAt.exchange,
                direction: opportunity.arbitrageType,
                spread: opportunity.profitPercentage,
            },
        });
    }
    catch (error) {
        console.error(`[Prisma] Erro ao gravar spread para ${opportunity.baseSymbol}:`, error);
    }
}
async function getSpreadStats(opportunity) {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    try {
        const stats = await prisma.spreadHistory.aggregate({
            _max: { spread: true },
            _min: { spread: true },
            _count: { id: true },
            where: {
                symbol: opportunity.baseSymbol,
                exchangeBuy: opportunity.buyAt.exchange,
                exchangeSell: opportunity.sellAt.exchange,
                direction: opportunity.arbitrageType,
                timestamp: {
                    gte: twentyFourHoursAgo,
                },
            },
        });
        return {
            spMax: stats._max.spread,
            spMin: stats._min.spread,
            crosses: stats._count.id,
        };
    }
    catch (error) {
        console.error(`[Prisma] Erro ao buscar estatísticas de spread para ${opportunity.baseSymbol}:`, error);
        return { spMax: null, spMin: null, crosses: 0 };
    }
}
function getNormalizedData(symbol) {
    const match = symbol.match(/^(\d+)(.+)$/);
    if (match) {
        const factor = parseInt(match[1], 10);
        const baseSymbol = match[2];
        return { baseSymbol, factor };
    }
    return { baseSymbol: symbol, factor: 1 };
}
async function findAndBroadcastArbitrage() {
    // Não precisamos mais de um array local, processaremos uma a uma
    const exchangeIdentifiers = Object.keys(marketPrices);
    if (exchangeIdentifiers.length < 2)
        return;
    for (const spotId of exchangeIdentifiers.filter(id => !id.toUpperCase().includes('FUTURES'))) {
        const futuresId = exchangeIdentifiers.find(id => id.toUpperCase().includes('FUTURES'));
        if (!futuresId)
            continue;
        const spotPrices = marketPrices[spotId];
        const futuresPrices = marketPrices[futuresId];
        for (const spotSymbol in spotPrices) {
            const spotData = getNormalizedData(spotSymbol);
            const futuresSymbol = Object.keys(futuresPrices).find(fs => {
                const futuresData = getNormalizedData(fs);
                return futuresData.baseSymbol === spotData.baseSymbol;
            });
            if (futuresSymbol) {
                const futuresData = getNormalizedData(futuresSymbol);
                const buyPriceSpot = spotPrices[spotSymbol].bestAsk * (futuresData.factor / spotData.factor);
                const sellPriceFutures = futuresPrices[futuresSymbol].bestBid;
                const buyPriceFutures = futuresPrices[futuresSymbol].bestAsk;
                const sellPriceSpot = spotPrices[spotSymbol].bestBid * (futuresData.factor / spotData.factor);
                if (buyPriceSpot <= 0 || sellPriceFutures <= 0 || buyPriceFutures <= 0 || sellPriceSpot <= 0) {
                    continue;
                }
                // Normalizar preços se necessário
                const normalizedSpotAsk = spotPrices[spotSymbol].bestAsk * (futuresData.factor / spotData.factor);
                const normalizedSpotBid = spotPrices[spotSymbol].bestBid * (futuresData.factor / spotData.factor);
                const normalizedFuturesAsk = futuresPrices[futuresSymbol].bestAsk * (futuresData.factor / spotData.factor);
                const normalizedFuturesBid = futuresPrices[futuresSymbol].bestBid * (futuresData.factor / spotData.factor);
                // Cálculo do spread para arbitragem spot-to-futures
                const profitSpotToFutures = ((normalizedFuturesBid - normalizedSpotAsk) / normalizedSpotAsk) * 100;
                if (profitSpotToFutures >= MIN_PROFIT_PERCENTAGE) {
                    const opportunity = {
                        type: 'arbitrage',
                        baseSymbol: spotData.baseSymbol,
                        profitPercentage: profitSpotToFutures,
                        buyAt: { exchange: spotId, price: spotPrices[spotSymbol].bestAsk, marketType: 'spot' },
                        sellAt: { exchange: futuresId, price: futuresPrices[futuresSymbol].bestBid, marketType: 'futures' },
                        arbitrageType: 'spot_to_futures_inter',
                        timestamp: Date.now()
                    };
                    await recordSpread(opportunity);
                    broadcastOpportunity(opportunity);
                }
                // Cálculo do spread para arbitragem futures-to-spot
                const profitFuturesToSpot = ((normalizedSpotBid - normalizedFuturesAsk) / normalizedSpotAsk) * 100;
                if (profitFuturesToSpot >= MIN_PROFIT_PERCENTAGE) {
                    const opportunity = {
                        type: 'arbitrage',
                        baseSymbol: spotData.baseSymbol,
                        profitPercentage: profitFuturesToSpot,
                        buyAt: { exchange: futuresId, price: futuresPrices[futuresSymbol].bestAsk, marketType: 'futures' },
                        sellAt: { exchange: spotId, price: spotPrices[spotSymbol].bestBid, marketType: 'spot' },
                        arbitrageType: 'futures_to_spot_inter',
                        timestamp: Date.now()
                    };
                    await recordSpread(opportunity);
                    broadcastOpportunity(opportunity);
                }
            }
        }
    }
}
async function startFeeds() {
    try {
        // Inicializa os conectores
        const mexcConnector = new mexc_connector_1.MexcConnector('MEXC_FUTURES', handlePriceUpdate, () => console.log('[MEXC] Conexão estabelecida'));
        const gateioSpotConnector = new gateio_connector_1.GateIoConnector('GATEIO_SPOT', handlePriceUpdate, () => console.log('[GateIO Spot] Conexão estabelecida'));
        const gateioFuturesConnector = new gateio_connector_1.GateIoConnector('GATEIO_FUTURES', handlePriceUpdate, () => console.log('[GateIO Futures] Conexão estabelecida'));
        // Armazena os conectores
        exchangeConnectors.set('MEXC_FUTURES', mexcConnector);
        exchangeConnectors.set('GATEIO_SPOT', gateioSpotConnector);
        exchangeConnectors.set('GATEIO_FUTURES', gateioFuturesConnector);
        // Busca os pares negociáveis de cada exchange
        const [mexcPairs, gateioSpotPairs, gateioFuturesPairs] = await Promise.all([
            mexcConnector.getTradablePairs(),
            gateioSpotConnector.getTradablePairs(),
            gateioFuturesConnector.getTradablePairs()
        ]);
        // Encontra pares comuns entre os exchanges
        const commonPairs = findCommonPairs(mexcPairs, gateioSpotPairs, gateioFuturesPairs);
        console.log(`[Pares] ${commonPairs.length} pares comuns encontrados`);
        // Inicia as conexões
        mexcConnector.connect();
        gateioSpotConnector.connect();
        gateioFuturesConnector.connect();
        // Inscreve nos pares comuns
        mexcConnector.subscribe(commonPairs);
        gateioSpotConnector.subscribe(commonPairs);
        gateioFuturesConnector.subscribe(commonPairs);
    }
    catch (error) {
        console.error('[Feeds] Erro ao iniciar feeds:', error);
    }
}
function findCommonPairs(mexcPairs, gateioSpotPairs, gateioFuturesPairs) {
    const pairSet = new Set();
    // Converte todos os pares para o mesmo formato (maiúsculo)
    const normalizedMexc = new Set(mexcPairs.map(p => p.toUpperCase()));
    const normalizedGateioSpot = new Set(gateioSpotPairs.map(p => p.toUpperCase()));
    const normalizedGateioFutures = new Set(gateioFuturesPairs.map(p => p.toUpperCase()));
    // Encontra pares que existem em todos os exchanges
    for (const pair of normalizedMexc) {
        if (normalizedGateioSpot.has(pair) && normalizedGateioFutures.has(pair)) {
            pairSet.add(pair);
        }
    }
    return Array.from(pairSet);
}
//# sourceMappingURL=websocket-server.js.map