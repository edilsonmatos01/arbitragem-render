"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startContinuousMonitoring = startContinuousMonitoring;
const client_1 = require("@prisma/client");
const gateio_connector_1 = require("./connectors/gateio-connector");
const mexc_connector_1 = require("./connectors/mexc-connector");
const gateio_futures_connector_1 = require("./connectors/gateio-futures-connector");
const mexc_futures_connector_1 = require("./connectors/mexc-futures-connector");
const utils_1 = require("./utils");
const prisma = new client_1.PrismaClient();
let targetPairs = [];
let isShuttingDown = false;
let isCronRunning = false;
const handlePriceUpdate = (data) => {
    console.log(`Atualização de preço para ${data.symbol}`);
};
const handleConnected = () => {
    console.log('Conexão estabelecida com sucesso');
};
const gateioSpot = new gateio_connector_1.GateIoConnector('GATEIO_SPOT', handlePriceUpdate);
const mexcSpot = new mexc_connector_1.MexcConnector('MEXC_SPOT', handlePriceUpdate, handleConnected);
const gateioFutures = new gateio_futures_connector_1.GateIoFuturesConnector('GATEIO_FUTURES', handlePriceUpdate, handleConnected);
const mexcFutures = new mexc_futures_connector_1.MexcFuturesConnector('MEXC_FUTURES', handlePriceUpdate, handleConnected);
async function findCommonPairs() {
    try {
        console.log('Buscando pares negociáveis em todas as exchanges...');
        const [gateioSpotPairs, mexcSpotPairs, gateioFuturesPairs, mexcFuturesPairs] = await Promise.all([
            gateioSpot.getTradablePairs(),
            mexcSpot.getTradablePairs(),
            gateioFutures.getTradablePairs(),
            mexcFutures.getTradablePairs()
        ]);
        const commonPairs = gateioSpotPairs.filter(pair => mexcSpotPairs.includes(pair) &&
            gateioFuturesPairs.includes(pair) &&
            mexcFuturesPairs.includes(pair));
        console.log(`Encontrados ${commonPairs.length} pares em comum`);
        console.log('Primeiros 5 pares:', commonPairs.slice(0, 5));
        return commonPairs;
    }
    catch (error) {
        console.error('Erro ao buscar pares negociáveis:', error);
        return [];
    }
}
async function monitorAndStore() {
    if (isCronRunning) {
        console.log('Monitoramento já está em execução, ignorando esta chamada');
        return;
    }
    try {
        isCronRunning = true;
        console.log(`[${new Date().toISOString()}] Iniciando monitoramento...`);
        targetPairs = await findCommonPairs();
        gateioSpot.connect(targetPairs);
        mexcSpot.subscribe(targetPairs);
        gateioFutures.subscribe(targetPairs);
        mexcFutures.subscribe(targetPairs);
        for (const symbol of targetPairs) {
            if (isShuttingDown)
                break;
            try {
                const [gateioSpotPrices, mexcSpotPrices, gateioFuturesPrices, mexcFuturesPrices] = await Promise.all([
                    gateioSpot.getTradablePairs(),
                    mexcSpot.getTradablePairs(),
                    gateioFutures.getTradablePairs(),
                    mexcFutures.getTradablePairs()
                ]);
                const gateioSpotPrice = gateioSpotPrices.find((p) => p === symbol);
                const mexcSpotPrice = mexcSpotPrices.find((p) => p === symbol);
                const gateioFuturesPrice = gateioFuturesPrices.find((p) => p === symbol);
                const mexcFuturesPrice = mexcFuturesPrices.find((p) => p === symbol);
                if (!gateioSpotPrice || !mexcSpotPrice || !gateioFuturesPrice || !mexcFuturesPrice) {
                    console.warn(`[AVISO] Preços incompletos para ${symbol}`);
                    continue;
                }
                const gateioSpotToMexcFutures = (0, utils_1.calculateSpread)(Number(gateioSpotPrice), Number(mexcFuturesPrice));
                const mexcSpotToGateioFutures = (0, utils_1.calculateSpread)(Number(mexcSpotPrice), Number(gateioFuturesPrice));
                const timestamp = new Date();
                await prisma.$transaction([
                    prisma.$executeRaw `
            INSERT INTO "PriceHistory" (
              "id",
              "symbol",
              "timestamp",
              "gateioSpotAsk",
              "gateioSpotBid",
              "mexcSpotAsk",
              "mexcSpotBid",
              "gateioFuturesAsk",
              "gateioFuturesBid",
              "mexcFuturesAsk",
              "mexcFuturesBid",
              "gateioSpotToMexcFuturesSpread",
              "mexcSpotToGateioFuturesSpread"
            ) VALUES (
              gen_random_uuid(),
              ${symbol},
              ${timestamp},
              ${Number(gateioSpotPrice)},
              ${Number(gateioSpotPrice)},
              ${Number(mexcSpotPrice)},
              ${Number(mexcSpotPrice)},
              ${Number(gateioFuturesPrice)},
              ${Number(gateioFuturesPrice)},
              ${Number(mexcFuturesPrice)},
              ${Number(mexcFuturesPrice)},
              ${gateioSpotToMexcFutures},
              ${mexcSpotToGateioFutures}
            )
          `,
                    prisma.$executeRaw `
            INSERT INTO "SpreadHistory" (
              "id",
              "symbol",
              "exchangeBuy",
              "exchangeSell",
              "direction",
              "spread",
              "timestamp"
            ) VALUES (
              gen_random_uuid(),
              ${symbol},
              'GATEIO',
              'MEXC',
              'spot-to-future',
              ${gateioSpotToMexcFutures},
              ${timestamp}
            )
          `,
                    prisma.$executeRaw `
            INSERT INTO "SpreadHistory" (
              "id",
              "symbol",
              "exchangeBuy",
              "exchangeSell",
              "direction",
              "spread",
              "timestamp"
            ) VALUES (
              gen_random_uuid(),
              ${symbol},
              'MEXC',
              'GATEIO',
              'spot-to-future',
              ${mexcSpotToGateioFutures},
              ${timestamp}
            )
          `
                ]);
                console.log(`[MONITOR] Dados salvos para ${symbol}`);
            }
            catch (symbolError) {
                console.error(`[ERRO] Falha ao processar ${symbol}:`, symbolError);
                continue;
            }
        }
    }
    catch (error) {
        console.error('[ERRO] Falha no monitoramento:', error);
    }
    finally {
        isCronRunning = false;
    }
}
async function startContinuousMonitoring() {
    console.log('Iniciando monitoramento contínuo...');
    gateioSpot.connect([]);
    mexcSpot.connect();
    gateioFutures.connect();
    mexcFutures.connect();
    await new Promise(resolve => setTimeout(resolve, 5000));
    const pairs = await findCommonPairs();
    if (pairs.length > 0) {
        gateioSpot.connect(pairs);
        mexcSpot.subscribe(pairs);
        gateioFutures.subscribe(pairs);
        mexcFutures.subscribe(pairs);
    }
    while (!isShuttingDown) {
        await monitorAndStore();
        await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
    }
}
process.on('SIGTERM', async () => {
    console.log('Recebido sinal SIGTERM, encerrando graciosamente...');
    isShuttingDown = true;
    await prisma.$disconnect();
    process.exit(0);
});
process.on('SIGINT', async () => {
    console.log('Recebido sinal SIGINT, encerrando graciosamente...');
    isShuttingDown = true;
    await prisma.$disconnect();
    process.exit(0);
});
//# sourceMappingURL=spread-monitor.js.map