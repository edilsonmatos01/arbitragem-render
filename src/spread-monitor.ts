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
    private lastSaveTime: Date | null = null;

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

        console.log(`[${new Date().toISOString()}] SpreadMonitor inicializado`);
    }

    private handlePriceUpdate(data: any): void {
        const { symbol, marketType, bestBid, bestAsk } = data;
        const averagePrice = (bestBid + bestAsk) / 2;

        console.log(`[${new Date().toISOString()}] Recebido preço para ${symbol} - ${marketType}: ${averagePrice}`);

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

        console.log(`[${timestamp.toISOString()}] Preparando para salvar spreads no banco de dados`);
        console.log(`Pares spot recebidos: ${Array.from(this.spotPricesReceived).join(', ')}`);
        console.log(`Pares futures recebidos: ${Array.from(this.futuresPricesReceived).join(', ')}`);

        for (const [symbol, data] of this.priceData.entries()) {
            // Só salva se tiver ambos os preços
            if (data.spotPrice > 0 && data.futuresPrice > 0) {
                const spread = this.calculateSpread(data.spotPrice, data.futuresPrice);
                spreads.push({
                    symbol,
                    exchangeBuy: 'GATEIO',
                    exchangeSell: 'MEXC',
                    direction: 'SPOT_TO_FUTURES',
                    spread,
                    spotPrice: Number(data.spotPrice.toFixed(8)), // Garante que é um número com 8 casas decimais
                    futuresPrice: Number(data.futuresPrice.toFixed(8)), // Garante que é um número com 8 casas decimais
                    timestamp
                });

                console.log(`[${timestamp.toISOString()}] ${symbol}: Spot=${data.spotPrice.toFixed(8)}, Futures=${data.futuresPrice.toFixed(8)}, Spread=${spread.toFixed(4)}%`);
            } else {
                console.warn(`[${timestamp.toISOString()}] ${symbol}: Preços incompletos - Spot=${data.spotPrice}, Futures=${data.futuresPrice}`);
            }
        }

        if (spreads.length > 0) {
            try {
                await prisma.spreadHistory.createMany({
                    data: spreads
                });
                console.log(`[${timestamp.toISOString()}] Salvos ${spreads.length} spreads no banco de dados`);
                this.lastSaveTime = timestamp;
            } catch (error) {
                console.error('Erro ao salvar spreads:', error);
                console.error('Dados que tentamos salvar:', JSON.stringify(spreads, null, 2));
            }
        } else {
            console.warn(`[${timestamp.toISOString()}] Nenhum spread para salvar - Verifique se os preços estão sendo recebidos corretamente`);
        }
    }

    public async monitorSpreads(): Promise<void> {
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

        } catch (error) {
            console.error('Erro durante o monitoramento:', error);
        } finally {
            isCronRunning = false;
        }
    }

    public getLastSaveTime(): Date | null {
        return this.lastSaveTime;
    }
}

// Cria e inicia o monitor
const spreadMonitor = new SpreadMonitor();

// Agenda a execução a cada 30 minutos
cron.schedule('*/30 * * * *', async () => {
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