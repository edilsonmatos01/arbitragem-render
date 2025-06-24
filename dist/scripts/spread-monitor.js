"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const gateio_connector_1 = require("./connectors/gateio-connector");
const mexc_connector_1 = require("./connectors/mexc-connector");
const gateio_futures_connector_1 = require("./connectors/gateio-futures-connector");
const mexc_futures_connector_1 = require("./connectors/mexc-futures-connector");
const utils_1 = require("./utils");
const cron = __importStar(require("node-cron"));
const prisma = new client_1.PrismaClient();
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
let isCronRunning = false;
async function monitorAndStore() {
    if (isCronRunning) {
        console.log('Monitoramento já está em execução, ignorando esta chamada');
        return;
    }
    try {
        isCronRunning = true;
        console.log(`[${new Date().toISOString()}] Iniciando monitoramento...`);
        const symbols = await prisma.$queryRaw `
      SELECT "baseSymbol", "gateioSymbol", "mexcSymbol", "gateioFuturesSymbol", "mexcFuturesSymbol"
      FROM "TradableSymbol"
      WHERE "isActive" = true
    `;
        for (const symbol of symbols) {
            try {
                const [gateioSpotPrices, mexcSpotPrices, gateioFuturesPrices, mexcFuturesPrices] = await Promise.all([
                    gateioSpot.getTradablePairs(),
                    mexcSpot.getTradablePairs(),
                    gateioFutures.getTradablePairs(),
                    mexcFutures.getTradablePairs()
                ]);
                const gateioSpotPrice = gateioSpotPrices.find((p) => p === symbol.gateioSymbol);
                const mexcSpotPrice = mexcSpotPrices.find((p) => p === symbol.mexcSymbol);
                const gateioFuturesPrice = gateioFuturesPrices.find((p) => p === symbol.gateioFuturesSymbol);
                const mexcFuturesPrice = mexcFuturesPrices.find((p) => p === symbol.mexcFuturesSymbol);
                if (!gateioSpotPrice || !mexcSpotPrice || !gateioFuturesPrice || !mexcFuturesPrice) {
                    console.warn(`[AVISO] Preços incompletos para ${symbol.baseSymbol}`);
                    continue;
                }
                const gateioSpotToMexcFutures = (0, utils_1.calculateSpread)(gateioSpotPrice, mexcFuturesPrice);
                const mexcSpotToGateioFutures = (0, utils_1.calculateSpread)(mexcSpotPrice, gateioFuturesPrice);
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
              ${symbol.baseSymbol},
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
              ${symbol.baseSymbol},
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
              ${symbol.baseSymbol},
              'MEXC',
              'GATEIO',
              'spot-to-future',
              ${mexcSpotToGateioFutures},
              ${timestamp}
            )
          `
                ]);
                console.log(`[MONITOR] Dados salvos para ${symbol.baseSymbol}`);
            }
            catch (symbolError) {
                console.error(`[ERRO] Falha ao processar ${symbol.baseSymbol}:`, symbolError);
                continue;
            }
        }
    }
    catch (error) {
        console.error('[ERRO] Falha no monitoramento:', error);
    }
    finally {
        isCronRunning = false;
        await prisma.$disconnect();
    }
}
cron.schedule('*/30 * * * *', () => {
    monitorAndStore().catch(error => {
        console.error('[ERRO] Falha ao executar monitoramento:', error);
    });
});
monitorAndStore().catch(error => {
    console.error('[ERRO] Falha ao executar monitoramento inicial:', error);
});
process.on('SIGTERM', async () => {
    console.log('Encerrando monitoramento...');
    await prisma.$disconnect();
    process.exit(0);
});
process.on('SIGINT', async () => {
    console.log('Encerrando monitoramento...');
    await prisma.$disconnect();
    process.exit(0);
});
//# sourceMappingURL=spread-monitor.js.map