import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import { GateIoConnector } from './gateio-connector';
import { MexcConnector } from './mexc-connector';
import WebSocket from 'ws';
import Decimal from 'decimal.js';

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
        
        // Log dos dados brutos recebidos
        console.log(`[${new Date().toISOString()}] Dados recebidos da exchange:`, {
            symbol,
            marketType,
            bestBid,
            bestAsk,
            rawData: JSON.stringify(data)
        });

        // Verifica se os preços são válidos
        if (!bestBid || !bestAsk || isNaN(bestBid) || isNaN(bestAsk)) {
            console.error(`[${new Date().toISOString()}] Preços inválidos recebidos para ${symbol} (${marketType}):`, {
                bestBid,
                bestAsk
            });
            return;
        }

        const averagePrice = (Number(bestBid) + Number(bestAsk)) / 2;

        console.log(`[${new Date().toISOString()}] Calculado preço médio para ${symbol} (${marketType}): ${averagePrice}`);

        if (marketType === 'spot') {
            this.spotPricesReceived.add(symbol);
            if (!this.priceData.has(symbol)) {
                this.priceData.set(symbol, { symbol, spotPrice: averagePrice, futuresPrice: 0 });
                console.log(`[${new Date().toISOString()}] Criado novo registro para ${symbol} com spotPrice=${averagePrice}`);
            } else {
                const data = this.priceData.get(symbol)!;
                data.spotPrice = averagePrice;
                console.log(`[${new Date().toISOString()}] Atualizado spotPrice para ${symbol}: ${averagePrice} (futuresPrice atual: ${data.futuresPrice})`);
            }
        } else if (marketType === 'futures') {
            this.futuresPricesReceived.add(symbol);
            if (!this.priceData.has(symbol)) {
                this.priceData.set(symbol, { symbol, spotPrice: 0, futuresPrice: averagePrice });
                console.log(`[${new Date().toISOString()}] Criado novo registro para ${symbol} com futuresPrice=${averagePrice}`);
            } else {
                const data = this.priceData.get(symbol)!;
                data.futuresPrice = averagePrice;
                console.log(`[${new Date().toISOString()}] Atualizado futuresPrice para ${symbol}: ${averagePrice} (spotPrice atual: ${data.spotPrice})`);
            }
        }

        // Log do estado atual do par após a atualização
        const currentData = this.priceData.get(symbol);
        if (currentData) {
            console.log(`[${new Date().toISOString()}] Estado atual de ${symbol}:`, {
                spotPrice: currentData.spotPrice,
                futuresPrice: currentData.futuresPrice,
                hasSpot: this.spotPricesReceived.has(symbol),
                hasFutures: this.futuresPricesReceived.has(symbol)
            });
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
                    spotPrice: Number(data.spotPrice.toFixed(8)),
                    futuresPrice: Number(data.futuresPrice.toFixed(8)),
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

// Agenda a execução a cada 5 minutos
cron.schedule('*/5 * * * *', async () => {
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
    await prisma.spreadHistory.create({
      data: {
        symbol,
        exchangeBuy: 'gateio',
        exchangeSell: 'mexc',
        direction,
        spread: parseFloat(spread.abs().toFixed(8)),
        spotPrice,
        futuresPrice,
        timestamp: new Date()
      }
    });

    console.log(`[${new Date().toISOString()}] Preços salvos para ${symbol}: Spot=${spotPrice}, Futures=${futuresPrice}, Spread=${spread.abs().toFixed(8)}%`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Erro ao salvar preços para ${symbol}:`, error);
  }
} 