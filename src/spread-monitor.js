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
        this.lastSaveTime = null;
        this.priceData = new Map();
        this.spotPricesReceived = new Set();
        this.futuresPricesReceived = new Set();
        // Inicializa os conectores
        this.gateioConnector = new gateio_connector_1.GateIoConnector('GATEIO_SPOT', this.handlePriceUpdate.bind(this));
        this.mexcConnector = new mexc_connector_1.MexcConnector('MEXC_FUTURES', this.handlePriceUpdate.bind(this), () => { });
        console.log(`[${new Date().toISOString()}] SpreadMonitor inicializado`);
    }
    handlePriceUpdate(data) {
        const { symbol, marketType, bestBid, bestAsk } = data;
        const averagePrice = (bestBid + bestAsk) / 2;
        console.log(`[${new Date().toISOString()}] Recebido preço para ${symbol} - ${marketType}: ${averagePrice}`);
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
        console.log(`[${timestamp.toISOString()}] Preparando para salvar spreads no banco de dados`);
        console.log(`Pares spot recebidos: ${Array.from(this.spotPricesReceived).join(', ')}`);
        console.log(`Pares futures recebidos: ${Array.from(this.futuresPricesReceived).join(', ')}`);
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
                console.log(`[${timestamp.toISOString()}] ${symbol}: Spot=${data.spotPrice}, Futures=${data.futuresPrice}, Spread=${spread}%`);
            }
        }
        if (spreads.length > 0) {
            try {
                await prisma.spreadHistory.createMany({
                    data: spreads
                });
                console.log(`[${timestamp.toISOString()}] Salvos ${spreads.length} spreads no banco de dados`);
                this.lastSaveTime = timestamp;
            }
            catch (error) {
                console.error('Erro ao salvar spreads:', error);
            }
        }
        else {
            console.warn(`[${timestamp.toISOString()}] Nenhum spread para salvar`);
        }
    }
    async monitorSpreads() {
        if (isCronRunning) {
            console.log('Monitoramento já está em execução');
            return;
        }
        try {
            isCronRunning = true;
            const startTime = new Date();
            console.log(`[${startTime.toISOString()}] Iniciando monitoramento de spreads...`);
            // Limpa os dados anteriores
            this.priceData.clear();
            this.spotPricesReceived.clear();
            this.futuresPricesReceived.clear();
            // Conecta às exchanges
            this.gateioConnector.connect(TRADING_PAIRS);
            this.mexcConnector.connect();
            this.mexcConnector.subscribe(TRADING_PAIRS);
            // Aguarda 10 segundos para receber os preços
            console.log(`[${new Date().toISOString()}] Aguardando 10 segundos para receber preços...`);
            await new Promise(resolve => setTimeout(resolve, 10000));
            // Salva os spreads no banco de dados
            await this.saveSpreadsToDatabase();
            const endTime = new Date();
            const duration = (endTime.getTime() - startTime.getTime()) / 1000;
            console.log(`[${endTime.toISOString()}] Monitoramento concluído em ${duration} segundos`);
        }
        catch (error) {
            console.error('Erro durante o monitoramento:', error);
        }
        finally {
            isCronRunning = false;
        }
    }
    getLastSaveTime() {
        return this.lastSaveTime;
    }
}

// Cria e inicia o monitor
const spreadMonitor = new SpreadMonitor();

// Agenda a execução a cada 30 minutos
node_cron_1.schedule('*/30 * * * *', async () => {
    const now = new Date();
    const lastSave = spreadMonitor.getLastSaveTime();
    const timeSinceLastSave = lastSave ? (now.getTime() - lastSave.getTime()) / 1000 : null;
    console.log(`[${now.toISOString()}] Executando monitoramento agendado`);
    if (lastSave) {
        console.log(`Último salvamento: ${lastSave.toISOString()} (${timeSinceLastSave}s atrás)`);
    }
    await spreadMonitor.monitorSpreads();
});

// Executa imediatamente ao iniciar
console.log(`[${new Date().toISOString()}] Iniciando serviço de monitoramento`);
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