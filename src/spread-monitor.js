"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_cron_1 = require("node-cron");
const client_1 = require("@prisma/client");
const gateio_connector_1 = require("./gateio-connector");
const mexc_connector_1 = require("./mexc-connector");

const prisma = new client_1.PrismaClient();
let isCronRunning = false;

// Lista de pares a serem monitorados
const TRADING_PAIRS = [
    'BTC/USDT',
    'ETH/USDT',
    'SOL/USDT',
    'BNB/USDT',
    'XRP/USDT',
    'DOGE/USDT',
    'ADA/USDT',
    'AVAX/USDT',
    'MATIC/USDT',
    'DOT/USDT'
];

class SpreadMonitor {
    constructor() {
        this.priceData = new Map();
        this.spotPricesReceived = new Set();
        this.futuresPricesReceived = new Set();
        // Inicializa os conectores
        this.gateioConnector = new gateio_connector_1.GateIoConnector('GATEIO_SPOT', this.handlePriceUpdate.bind(this));
        this.mexcConnector = new mexc_connector_1.MexcConnector('MEXC_FUTURES', this.handlePriceUpdate.bind(this), () => { });
    }
    handlePriceUpdate(data) {
        const { symbol, marketType, bestBid, bestAsk } = data;
        const averagePrice = (bestBid + bestAsk) / 2;
        if (marketType === 'spot') {
            this.spotPricesReceived.add(symbol);
            if (!this.priceData.has(symbol)) {
                this.priceData.set(symbol, { symbol, spotPrice: averagePrice, futuresPrice: 0 });
            }
            else {
                this.priceData.get(symbol).spotPrice = averagePrice;
            }
        }
        else if (marketType === 'futures') {
            this.futuresPricesReceived.add(symbol);
            if (!this.priceData.has(symbol)) {
                this.priceData.set(symbol, { symbol, spotPrice: 0, futuresPrice: averagePrice });
            }
            else {
                this.priceData.get(symbol).futuresPrice = averagePrice;
            }
        }
    }
    calculateSpread(spotPrice, futuresPrice) {
        return ((futuresPrice - spotPrice) / spotPrice) * 100;
    }
    async saveSpreadsToDatabase() {
        const timestamp = new Date();
        const spreads = [];
        for (const [symbol, data] of this.priceData.entries()) {
            if (data.spotPrice && data.futuresPrice) {
                const spread = this.calculateSpread(data.spotPrice, data.futuresPrice);
                spreads.push({
                    symbol,
                    exchangeBuy: 'GATEIO',
                    exchangeSell: 'MEXC',
                    direction: 'SPOT_TO_FUTURES',
                    spread,
                    spotPrice: data.spotPrice,
                    futuresPrice: data.futuresPrice,
                    timestamp
                });
            }
        }
        if (spreads.length > 0) {
            try {
                await prisma.spreadHistory.createMany({
                    data: spreads
                });
                console.log(`[${new Date().toISOString()}] Salvos ${spreads.length} spreads no banco de dados`);
            }
            catch (error) {
                console.error('Erro ao salvar spreads:', error);
            }
        }
    }
    async monitorSpreads() {
        if (isCronRunning) {
            console.log('Monitoramento já está em execução');
            return;
        }
        try {
            isCronRunning = true;
            console.log(`[${new Date().toISOString()}] Iniciando monitoramento de spreads...`);
            // Limpa os dados anteriores
            this.priceData.clear();
            this.spotPricesReceived.clear();
            this.futuresPricesReceived.clear();
            // Conecta às exchanges
            this.gateioConnector.connect(TRADING_PAIRS);
            this.mexcConnector.connect();
            this.mexcConnector.subscribe(TRADING_PAIRS);
            // Aguarda 10 segundos para receber os preços
            await new Promise(resolve => setTimeout(resolve, 10000));
            // Salva os spreads no banco de dados
            await this.saveSpreadsToDatabase();
        }
        catch (error) {
            console.error('Erro durante o monitoramento:', error);
        }
        finally {
            isCronRunning = false;
        }
    }
}

// Cria e inicia o monitor
const spreadMonitor = new SpreadMonitor();

// Agenda a execução a cada 30 minutos
node_cron_1.schedule('*/30 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Executando monitoramento agendado`);
    await spreadMonitor.monitorSpreads();
});

// Executa imediatamente ao iniciar
spreadMonitor.monitorSpreads().catch(console.error);

// Tratamento de encerramento gracioso
process.on('SIGTERM', async () => {
    console.log('Recebido sinal SIGTERM. Encerrando...');
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('Recebido sinal SIGINT. Encerrando...');
    await prisma.$disconnect();
    process.exit(0);
}); 