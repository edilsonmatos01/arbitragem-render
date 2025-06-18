import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { GateIoConnector } from './gateio-connector';
import { MexcConnector } from './mexc-connector';

const prisma = new PrismaClient();
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

interface PriceData {
    symbol: string;
    spotPrice: number;
    futuresPrice: number;
}

class SpreadMonitor {
    private gateioConnector: GateIoConnector;
    private mexcConnector: MexcConnector;
    private priceData: Map<string, PriceData>;
    private spotPricesReceived: Set<string>;
    private futuresPricesReceived: Set<string>;

    constructor() {
        this.priceData = new Map();
        this.spotPricesReceived = new Set();
        this.futuresPricesReceived = new Set();

        // Inicializa os conectores
        this.gateioConnector = new GateIoConnector('GATEIO_SPOT', this.handlePriceUpdate.bind(this));
        this.mexcConnector = new MexcConnector(
            'MEXC_FUTURES',
            this.handlePriceUpdate.bind(this),
            () => {}
        );
    }

    private handlePriceUpdate(data: any): void {
        const { symbol, marketType, bestBid, bestAsk } = data;
        const averagePrice = (bestBid + bestAsk) / 2;

        if (marketType === 'spot') {
            this.spotPricesReceived.add(symbol);
            if (!this.priceData.has(symbol)) {
                this.priceData.set(symbol, { symbol, spotPrice: averagePrice, futuresPrice: 0 });
            } else {
                this.priceData.get(symbol)!.spotPrice = averagePrice;
            }
        } else if (marketType === 'futures') {
            this.futuresPricesReceived.add(symbol);
            if (!this.priceData.has(symbol)) {
                this.priceData.set(symbol, { symbol, spotPrice: 0, futuresPrice: averagePrice });
            } else {
                this.priceData.get(symbol)!.futuresPrice = averagePrice;
            }
        }
    }

    private calculateSpread(spotPrice: number, futuresPrice: number): number {
        return ((futuresPrice - spotPrice) / spotPrice) * 100;
    }

    private async saveSpreadsToDatabase(): Promise<void> {
        const timestamp = new Date();
        const spreads: any[] = [];

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
            } catch (error) {
                console.error('Erro ao salvar spreads:', error);
            }
        }
    }

    public async monitorSpreads(): Promise<void> {
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

        } catch (error) {
            console.error('Erro durante o monitoramento:', error);
        } finally {
            isCronRunning = false;
        }
    }
}

// Cria e inicia o monitor
const spreadMonitor = new SpreadMonitor();

// Agenda a execução a cada 30 minutos
cron.schedule('*/30 * * * *', async () => {
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