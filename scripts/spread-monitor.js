"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const ccxt_1 = __importDefault(require("ccxt"));
const utils_1 = require("./utils");
const node_cron_1 = __importDefault(require("node-cron"));
// Inicializa o cliente Prisma
const prisma = new client_1.PrismaClient();
// Configurações das exchanges
const gateio = new ccxt_1.default.gateio({
    enableRateLimit: true,
});
const mexc = new ccxt_1.default.mexc({
    enableRateLimit: true,
});
// Lista de pares a serem monitorados
const TARGET_PAIRS = [
    'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'DOGE/USDT', 'SOL/USDT', 'PEPE/USDT',
    'UNI/USDT', 'SUI/USDT', 'ONDO/USDT', 'WLD/USDT', 'FET/USDT', 'ARKM/USDT',
    'INJ/USDT', 'TON/USDT', 'OP/USDT', 'XRP/USDT', 'KAS/USDT', 'VR/USDT',
    'G7/USDT', 'EDGE/USDT', 'ADA/USDT', 'AVAX/USDT', 'DOT/USDT', 'MATIC/USDT'
];
let isCronRunning = false;
function monitorSpreads() {
    return __awaiter(this, void 0, void 0, function* () {
        if (isCronRunning) {
            console.log('Monitoramento já está em execução, ignorando esta chamada');
            return;
        }
        try {
            isCronRunning = true;
            console.log(`[${new Date().toISOString()}] Iniciando monitoramento de spreads...`);
            // Carrega os mercados das exchanges
            yield Promise.all([
                gateio.loadMarkets(),
                mexc.loadMarkets()
            ]);
            // Para cada par de trading
            for (const symbol of TARGET_PAIRS) {
                try {
                    // Busca os preços atuais
                    const [spotTicker, futuresTicker] = yield Promise.all([
                        gateio.fetchTicker(symbol),
                        mexc.fetchTicker(`${symbol}:USDT`) // Formato para futuros na MEXC
                    ]);
                    // Extrai os preços
                    const spotPrice = spotTicker === null || spotTicker === void 0 ? void 0 : spotTicker.ask;
                    const futuresPrice = futuresTicker === null || futuresTicker === void 0 ? void 0 : futuresTicker.bid;
                    // Valida os preços
                    if (!spotPrice || !futuresPrice || spotPrice <= 0 || futuresPrice <= 0) {
                        console.warn(`Preços inválidos para ${symbol}: Spot=${spotPrice}, Futures=${futuresPrice}`);
                        continue;
                    }
                    // Calcula o spread
                    const spread = (0, utils_1.calculateSpread)(futuresPrice.toString(), spotPrice.toString());
                    const spreadValue = spread ? parseFloat(spread) : null;
                    if (spreadValue === null) {
                        console.warn(`Spread inválido para ${symbol}`);
                        continue;
                    }
                    // Salva no banco de dados
                    yield prisma.spreadHistory.create({
                        data: {
                            symbol,
                            exchangeBuy: 'gateio',
                            exchangeSell: 'mexc',
                            direction: 'spot-to-future',
                            spread: spreadValue,
                            spotPrice: spotPrice,
                            futuresPrice: futuresPrice,
                            timestamp: new Date()
                        }
                    });
                    console.log(`[${new Date().toISOString()}] ${symbol}: Spread=${spreadValue}%, Spot=${spotPrice}, Futures=${futuresPrice}`);
                }
                catch (error) {
                    console.error(`Erro ao processar ${symbol}:`, error);
                    continue;
                }
            }
        }
        catch (error) {
            console.error('Erro no monitoramento:', error);
        }
        finally {
            isCronRunning = false;
        }
    });
}
// Inicia o agendador para executar a cada 5 minutos
node_cron_1.default.schedule('*/5 * * * *', monitorSpreads);
// Executa imediatamente na primeira vez
monitorSpreads();
// Mantém o processo rodando
process.on('SIGTERM', () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Encerrando monitoramento...');
    yield prisma.$disconnect();
    process.exit(0);
}));
process.on('SIGINT', () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Encerrando monitoramento...');
    yield prisma.$disconnect();
    process.exit(0);
}));
