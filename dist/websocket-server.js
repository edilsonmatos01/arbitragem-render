"use strict";
<<<<<<< HEAD
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
=======
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWebSocketServer = startWebSocketServer;
require('dotenv').config();
const ws_1 = require("ws");
const http_1 = require("http");
const gateio_connector_1 = require("./src/gateio-connector");
const mexc_connector_1 = require("./src/mexc-connector");
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const PORT = process.env.PORT || 10000;
const MIN_PROFIT_PERCENTAGE = 0.1;
let marketPrices = {};
let targetPairs = [];
<<<<<<< HEAD
let clients = [];
function handlePriceUpdate(update) {
    const { identifier, symbol, priceData, marketType, bestAsk, bestBid } = update;
=======
let clients = []; // Usamos o tipo estendido
// ✅ Nova função centralizadora para lidar com todas as atualizações de preço
function handlePriceUpdate(update) {
    const { identifier, symbol, priceData, marketType, bestAsk, bestBid } = update;
    // 1. Atualiza o estado central de preços
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
    if (!marketPrices[identifier]) {
        marketPrices[identifier] = {};
    }
    marketPrices[identifier][symbol] = { bestAsk, bestBid, timestamp: Date.now() };
<<<<<<< HEAD
=======
    // 2. Transmite a atualização para todos os clientes
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
    broadcast({
        type: 'price-update',
        symbol,
        marketType,
        bestAsk,
        bestBid
    });
}
function startWebSocketServer(httpServer) {
<<<<<<< HEAD
    const wss = new ws_1.default.Server({ server: httpServer });
    wss.on('connection', (ws, req) => {
        ws.isAlive = true;
        ws.on('pong', () => {
            ws.isAlive = true;
=======
    const wss = new ws_1.WebSocketServer({ server: httpServer });
    wss.on('connection', (ws, req) => {
        ws.isAlive = true; // A conexão está viva ao ser estabelecida
        ws.on('pong', () => {
            ws.isAlive = true; // O cliente respondeu ao nosso ping, então está vivo
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
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
<<<<<<< HEAD
    const interval = setInterval(() => {
        wss.clients.forEach(client => {
            const ws = client;
=======
    // Intervalo para verificar conexões e mantê-las vivas
    const interval = setInterval(() => {
        wss.clients.forEach(client => {
            const ws = client;
            // Se o cliente não respondeu ao PING do ciclo anterior, encerre.
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
            if (ws.isAlive === false) {
                console.log('[WS Server] Conexão inativa terminada.');
                return ws.terminate();
            }
<<<<<<< HEAD
            ws.isAlive = false;
            ws.ping(() => { });
        });
    }, 30000);
    wss.on('close', () => {
        clearInterval(interval);
=======
            // Marque como inativo e envie um PING. A resposta 'pong' marcará como vivo novamente.
            ws.isAlive = false;
            ws.ping(() => { }); // A função de callback vazia é necessária.
        });
    }, 30000); // A cada 30 segundos
    wss.on('close', () => {
        clearInterval(interval); // Limpa o intervalo quando o servidor é fechado
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
    });
    console.log(`Servidor WebSocket iniciado e anexado ao servidor HTTP.`);
    startFeeds();
}
<<<<<<< HEAD
function initializeStandaloneServer() {
    const httpServer = (0, http_1.createServer)((req, res) => {
=======
// --- Início: Adição para Servidor Standalone ---
// Esta função cria e inicia um servidor HTTP que usa a nossa lógica WebSocket.
function initializeStandaloneServer() {
    const httpServer = (0, http_1.createServer)((req, res) => {
        // O servidor HTTP básico não fará nada além de fornecer uma base para o WebSocket.
        // Podemos adicionar um endpoint de health check simples.
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
        if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', message: 'WebSocket server is running' }));
        }
        else {
            res.writeHead(404);
            res.end();
        }
    });
<<<<<<< HEAD
=======
    // Anexa a lógica do WebSocket ao nosso servidor HTTP.
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
    startWebSocketServer(httpServer);
    httpServer.listen(PORT, () => {
        console.log(`[Servidor Standalone] Servidor HTTP e WebSocket escutando na porta ${PORT}`);
    });
}
<<<<<<< HEAD
if (require.main === module) {
    initializeStandaloneServer();
}
function broadcast(data) {
    const serializedData = JSON.stringify(data);
    clients.forEach(client => {
        if (client.readyState === ws_1.default.OPEN) {
=======
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
        if (client.readyState === ws_1.WebSocket.OPEN) {
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
            client.send(serializedData);
        }
    });
}
<<<<<<< HEAD
=======
// Versão corrigida da função com logs de depuração
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
function broadcastOpportunity(opportunity) {
    console.log(`[DEBUG] Verificando ${opportunity.baseSymbol} | Spread: ${opportunity.profitPercentage.toFixed(2)}%`);
    if (!isFinite(opportunity.profitPercentage) || opportunity.profitPercentage > 100) {
        console.warn(`[FILTRO] Spread >100% IGNORADO para ${opportunity.baseSymbol}: ${opportunity.profitPercentage.toFixed(2)}%`);
        return;
    }
<<<<<<< HEAD
    broadcast(Object.assign(Object.assign({}, opportunity), { type: 'arbitrage' }));
=======
    broadcast({ ...opportunity, type: 'arbitrage' });
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
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
<<<<<<< HEAD
=======
    // Não precisamos mais de um array local, processaremos uma a uma
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
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
<<<<<<< HEAD
                const normalizedSpotAsk = spotPrices[spotSymbol].bestAsk * (futuresData.factor / spotData.factor);
                const normalizedSpotBid = spotPrices[spotSymbol].bestBid * (futuresData.factor / spotData.factor);
                const normalizedFuturesAsk = futuresPrices[futuresSymbol].bestAsk * (futuresData.factor / spotData.factor);
                const normalizedFuturesBid = futuresPrices[futuresSymbol].bestBid * (futuresData.factor / spotData.factor);
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
=======
                // Calcular preços médios para comparação mais justa
                const spotMidPrice = (spotPrices[spotSymbol].bestAsk + spotPrices[spotSymbol].bestBid) / 2;
                const futuresMidPrice = (futuresPrices[futuresSymbol].bestAsk + futuresPrices[futuresSymbol].bestBid) / 2;
                // Normalizar preços se necessário
                const normalizedSpotMid = spotMidPrice * (futuresData.factor / spotData.factor);
                // Fórmula simplificada: Spread (%) = ((Futures - Spot) / Spot) × 100
                const spread = ((futuresMidPrice - normalizedSpotMid) / normalizedSpotMid) * 100;
                // Só processar se o spread for significativo e dentro dos limites
                if (Math.abs(spread) >= 0.1 && Math.abs(spread) <= 10) {
                    if (spread > 0) {
                        // Futures > Spot: Comprar Spot, Vender Futures
                        const opportunity = {
                            type: 'arbitrage',
                            baseSymbol: spotData.baseSymbol,
                            buyAt: { exchange: spotId.split('_')[0], marketType: 'spot', price: normalizedSpotMid },
                            sellAt: { exchange: futuresId.split('_')[0], marketType: 'futures', price: futuresMidPrice },
                            arbitrageType: 'spot_to_futures',
                            profitPercentage: spread,
                            timestamp: Date.now()
                        };
                        await recordSpread(opportunity);
                        broadcastOpportunity(opportunity);
                    }
                    else {
                        // Spot > Futures: Comprar Futures, Vender Spot
                        const opportunity = {
                            type: 'arbitrage',
                            baseSymbol: spotData.baseSymbol,
                            buyAt: { exchange: futuresId.split('_')[0], marketType: 'futures', price: futuresMidPrice },
                            sellAt: { exchange: spotId.split('_')[0], marketType: 'spot', price: normalizedSpotMid },
                            arbitrageType: 'futures_to_spot',
                            profitPercentage: Math.abs(spread),
                            timestamp: Date.now()
                        };
                        await recordSpread(opportunity);
                        broadcastOpportunity(opportunity);
                    }
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
                }
            }
        }
    }
}
async function startFeeds() {
<<<<<<< HEAD
    console.log("🚀 Iniciando feeds de dados com BUSCA DINÂMICA...");
    const gateIoSpotConnector = new gateio_connector_1.GateIoConnector('GATEIO_SPOT', handlePriceUpdate);
    const gateIoFuturesConnector = new gateio_connector_1.GateIoConnector('GATEIO_FUTURES', handlePriceUpdate);
    let mexcConnector;
    let dynamicPairs = [];
    try {
        console.log("📡 Buscando pares negociáveis das exchanges...");
        const [spotPairs, futuresPairs] = await Promise.all([
            gateIoSpotConnector.getTradablePairs(),
            gateIoFuturesConnector.getTradablePairs()
        ]);
        console.log(`✅ Gate.io Spot: ${spotPairs.length} pares encontrados`);
        console.log(`✅ Gate.io Futures: ${futuresPairs.length} pares encontrados`);
        dynamicPairs = spotPairs.filter((pair) => futuresPairs.includes(pair));
        console.log(`🎯 PARES EM COMUM: ${dynamicPairs.length} pares para arbitragem`);
        console.log(`📋 Primeiros 10 pares: ${dynamicPairs.slice(0, 10).join(', ')}`);
        mexcConnector = new mexc_connector_1.MexcConnector('MEXC_FUTURES', handlePriceUpdate, () => {
            console.log('✅ MEXC conectado! Inscrevendo em pares dinâmicos...');
            mexcConnector.subscribe(dynamicPairs);
        });
        console.log(`🔄 Conectando exchanges com ${dynamicPairs.length} pares dinâmicos...`);
        gateIoSpotConnector.connect(dynamicPairs);
        gateIoFuturesConnector.connect(dynamicPairs);
        mexcConnector.connect();
        console.log(`💰 Monitorando ${dynamicPairs.length} pares para arbitragem!`);
        setInterval(findAndBroadcastArbitrage, 5000);
        setInterval(async () => {
            console.log("🔄 Atualizando lista de pares dinâmicos...");
            try {
                const [newSpotPairs, newFuturesPairs] = await Promise.all([
                    gateIoSpotConnector.getTradablePairs(),
                    gateIoFuturesConnector.getTradablePairs()
                ]);
                const newDynamicPairs = newSpotPairs.filter((pair) => newFuturesPairs.includes(pair));
                if (newDynamicPairs.length !== dynamicPairs.length) {
                    console.log(`📈 Pares atualizados: ${dynamicPairs.length} → ${newDynamicPairs.length}`);
                    dynamicPairs = newDynamicPairs;
                    mexcConnector.subscribe(dynamicPairs);
                }
                else {
                    console.log("✅ Lista de pares permanece igual");
                }
            }
            catch (error) {
                console.error("❌ Erro ao atualizar pares:", error);
            }
        }, 3600000);
    }
    catch (error) {
        console.error("❌ Erro fatal ao iniciar os feeds:", error);
        console.log("🔄 Usando pares prioritários como fallback...");
        const fallbackPairs = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT'];
        mexcConnector = new mexc_connector_1.MexcConnector('MEXC_FUTURES', handlePriceUpdate, () => {
            mexcConnector.subscribe(fallbackPairs);
        });
        gateIoSpotConnector.connect(fallbackPairs);
        gateIoFuturesConnector.connect(fallbackPairs);
        mexcConnector.connect();
        setInterval(findAndBroadcastArbitrage, 5000);
    }
}
//# sourceMappingURL=websocket-server.js.map
=======
    console.log("Iniciando feeds de dados...");
    // Passa a função 'handlePriceUpdate' para os conectores
    const gateIoSpotConnector = new gateio_connector_1.GateIoConnector('GATEIO_SPOT', handlePriceUpdate);
    const gateIoFuturesConnector = new gateio_connector_1.GateIoConnector('GATEIO_FUTURES', handlePriceUpdate);
    const mexcConnector = new mexc_connector_1.MexcConnector('MEXC_FUTURES', handlePriceUpdate, () => {
        const mexcPairs = targetPairs.map(p => p.replace('/', '_'));
        mexcConnector.subscribe(mexcPairs);
    });
    try {
        const spotPairs = await gateIoSpotConnector.getTradablePairs();
        const futuresPairs = await gateIoFuturesConnector.getTradablePairs();
        targetPairs = spotPairs.filter(p => futuresPairs.includes(p));
        console.log(`Encontrados ${targetPairs.length} pares em comum.`);
        gateIoSpotConnector.connect(targetPairs);
        gateIoFuturesConnector.connect(targetPairs);
        mexcConnector.connect();
        console.log(`Monitorando ${targetPairs.length} pares.`);
        setInterval(findAndBroadcastArbitrage, 5000);
    }
    catch (error) {
        console.error("Erro fatal ao iniciar os feeds:", error);
    }
}
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
