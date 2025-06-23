"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const gateio_connector_1 = require("./connectors/gateio-connector");
const mexc_connector_1 = require("./connectors/mexc-connector");
const prisma = new client_1.PrismaClient({
    log: ['error'],
    errorFormat: 'minimal',
});
const TRADING_PAIRS = [
    'BTC/USDT',
    'ETH/USDT',
    'SOL/USDT',
    'BNB/USDT',
    'XRP/USDT'
];
const latestPrices = {};
let isRunning = false;
function handlePriceUpdate(data) {
    const { identifier, symbol, bestAsk, bestBid } = data;
    if (!latestPrices[symbol]) {
        latestPrices[symbol] = {};
    }
    if (identifier === 'GATEIO_SPOT') {
        latestPrices[symbol].spot = { bestAsk, bestBid };
    }
    else if (identifier === 'MEXC_FUTURES') {
        latestPrices[symbol].futures = { bestAsk, bestBid };
    }
    console.log(`[${new Date().toISOString()}] Atualização de preço - ${symbol} ${identifier}: Ask=${bestAsk}, Bid=${bestBid}`);
}
function handleConnected() {
    console.log(`[${new Date().toISOString()}] Conexão WebSocket estabelecida`);
}
async function storeSpreadData() {
    if (isRunning) {
        console.log('Processo já está em execução');
        return;
    }
    try {
        isRunning = true;
        console.log(`[${new Date().toISOString()}] Iniciando coleta de dados de spread...`);
        Object.keys(latestPrices).forEach(key => delete latestPrices[key]);
        const gateio = new gateio_connector_1.GateIoConnector('GATEIO_SPOT', handlePriceUpdate);
        const mexc = new mexc_connector_1.MexcConnector('MEXC_FUTURES', handlePriceUpdate, handleConnected);
        gateio.connect(TRADING_PAIRS);
        mexc.connect();
        mexc.subscribe(TRADING_PAIRS);
        console.log('Aguardando recebimento dos preços iniciais...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        for (const symbol of TRADING_PAIRS) {
            try {
                const prices = latestPrices[symbol];
                if (!(prices === null || prices === void 0 ? void 0 : prices.spot) || !(prices === null || prices === void 0 ? void 0 : prices.futures)) {
                    console.warn(`[${new Date().toISOString()}] Dados incompletos para ${symbol}, pulando...`);
                    continue;
                }
                const spotPrice = (prices.spot.bestBid + prices.spot.bestAsk) / 2;
                const futuresPrice = (prices.futures.bestBid + prices.futures.bestAsk) / 2;
                const spreadValue = ((futuresPrice - spotPrice) / spotPrice) * 100;
                await prisma.spreadHistory.create({
                    data: {
                        symbol,
                        exchangeBuy: 'GATEIO',
                        exchangeSell: 'MEXC',
                        direction: 'SPOT_TO_FUTURES',
                        spread: spreadValue,
                        timestamp: new Date()
                    }
                });
                console.log(`[${new Date().toISOString()}] ${symbol}: Spread=${spreadValue.toFixed(4)}%, Spot=${spotPrice}, Futures=${futuresPrice}`);
            }
            catch (error) {
                console.error(`[${new Date().toISOString()}] Erro ao processar ${symbol}:`, error);
            }
        }
        if (typeof gateio.disconnect === 'function')
            gateio.disconnect();
        if (typeof mexc.disconnect === 'function')
            mexc.disconnect();
        console.log(`[${new Date().toISOString()}] Coleta de dados concluída com sucesso`);
    }
    catch (error) {
        console.error(`[${new Date().toISOString()}] Erro durante a execução:`, error);
    }
    finally {
        isRunning = false;
        await prisma.$disconnect();
    }
}
storeSpreadData()
    .catch(console.error)
    .finally(() => process.exit(0));
//# sourceMappingURL=store-spreads.js.map