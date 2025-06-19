import { createSpreads, disconnectPrisma } from './prisma-client';
import cron from 'node-cron';
import { GateIoConnector } from './gateio-connector';
import { MexcConnector } from './mexc-connector';
import WebSocket from 'ws';
import Decimal from 'decimal.js';

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
    private lastSaveTime: Date | null;

    constructor() {
        this.priceData = new Map();
        this.spotPricesReceived = new Set();
        this.futuresPricesReceived = new Set();
        this.lastSaveTime = null;

        this.gateioConnector = new GateIoConnector('GATEIO_SPOT', this.handlePriceUpdate.bind(this));
        this.mexcConnector = new MexcConnector(
            'MEXC_FUTURES',
            this.handlePriceUpdate.bind(this),
            () => {}
        );
    }

    private handlePriceUpdate(data: { symbol: string; marketType: string; bestBid: number; bestAsk: number }): void {
        const { symbol, marketType, bestBid, bestAsk } = data;
        
        if (!bestBid || !bestAsk || isNaN(bestBid) || isNaN(bestAsk)) {
            return;
        }

        const averagePrice = (Number(bestBid) + Number(bestAsk)) / 2;

        if (marketType === 'spot') {
            this.spotPricesReceived.add(symbol);
            const existingData = this.priceData.get(symbol);
            if (existingData) {
                existingData.spotPrice = averagePrice;
            } else {
                this.priceData.set(symbol, { symbol, spotPrice: averagePrice, futuresPrice: 0 });
            }
        } else if (marketType === 'futures') {
            this.futuresPricesReceived.add(symbol);
            const existingData = this.priceData.get(symbol);
            if (existingData) {
                existingData.futuresPrice = averagePrice;
            } else {
                this.priceData.set(symbol, { symbol, spotPrice: 0, futuresPrice: averagePrice });
            }
        }
    }

    private calculateSpread(spotPrice: number, futuresPrice: number): number {
        return ((futuresPrice - spotPrice) / spotPrice) * 100;
    }

    private async saveSpreadsToDatabase(): Promise<void> {
        const timestamp = new Date();
        const spreads: Array<{
            symbol: string;
            exchangeBuy: string;
            exchangeSell: string;
            direction: string;
            spread: number;
            spotPrice: number;
            futuresPrice: number;
            timestamp: Date;
        }> = [];

        Array.from(this.priceData.entries()).forEach(([symbol, data]) => {
            if (data.spotPrice > 0 && data.futuresPrice > 0) {
                const spread = this.calculateSpread(data.spotPrice, data.futuresPrice);
                spreads.push({
                    symbol,
                    exchangeBuy: 'GATEIO',
                    exchangeSell: 'MEXC',
                    direction: 'SPOT_TO_FUTURES',
                    spread,
                    spotPrice: Number(data.spotPrice.toFixed(8)),
                    futuresPrice: Number(data.futuresPrice.toFixed(8)),
                    timestamp
                });
            }
        });

        if (spreads.length > 0) {
            try {
                await createSpreads(spreads);
                this.lastSaveTime = timestamp;
            } catch (error) {
                console.error('Erro ao salvar spreads:', error);
            }
        }
    }

    public async monitorSpreads(): Promise<void> {
        if (isCronRunning) {
            return;
        }

        try {
            isCronRunning = true;
            this.priceData.clear();
            this.spotPricesReceived.clear();
            this.futuresPricesReceived.clear();

            this.gateioConnector.connect(TRADING_PAIRS);
            this.mexcConnector.connect();
            this.mexcConnector.subscribe(TRADING_PAIRS);

            await new Promise(resolve => setTimeout(resolve, 10000));
            await this.saveSpreadsToDatabase();

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

const spreadMonitor = new SpreadMonitor();

cron.schedule('*/5 * * * *', async () => {
    await spreadMonitor.monitorSpreads();
});

spreadMonitor.monitorSpreads().catch(console.error);

process.on('SIGTERM', async () => {
    await disconnectPrisma();
    process.exit(0);
});

process.on('SIGINT', async () => {
    await disconnectPrisma();
    process.exit(0);
});

// Função para salvar os preços no banco
async function savePrices(symbol: string, spotPrice: number, futuresPrice: number) {
  try {
    // Calcula o spread
    const spot = new Decimal(spotPrice);
    const futures = new Decimal(futuresPrice);
    const spread = futures.minus(spot).dividedBy(spot).times(100);

    // Determina a direção com base no spread
    const direction = spread.greaterThanOrEqualTo(0) ? 'SPOT_TO_FUTURES' : 'FUTURES_TO_SPOT';

    // Salva no banco
    await createSpreads([{
      symbol,
      exchangeBuy: 'gateio',
      exchangeSell: 'mexc',
      direction,
      spread: parseFloat(spread.abs().toFixed(8)),
      spotPrice,
      futuresPrice,
      timestamp: new Date()
    }]);

    console.log(`[${new Date().toISOString()}] Preços salvos para ${symbol}: Spot=${spotPrice}, Futures=${futuresPrice}, Spread=${spread.abs().toFixed(8)}%`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Erro ao salvar preços para ${symbol}:`, error);
  }
} 