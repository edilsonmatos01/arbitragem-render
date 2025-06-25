import { GateIoConnector } from './connectors/gateio-connector';
import { MexcConnector } from './connectors/mexc-connector';
import { PrismaClient } from '@prisma/client';
import { calculateSpread } from './utils';

interface PriceData {
  bestAsk: number;
  bestBid: number;
}

interface PriceUpdate {
  exchange: string;
  symbol: string;
  bestBid: number;
  bestAsk: number;
}

const prisma = new PrismaClient();

class ArbitrageWorker {
  private gateioConnector: GateIoConnector;
  private mexcConnector: MexcConnector;
  private isRunning: boolean = false;
  private priceData: Map<string, PriceData> = new Map();

  constructor() {
    this.gateioConnector = new GateIoConnector('GATEIO_SPOT', this.handlePriceUpdate.bind(this));
    this.mexcConnector = new MexcConnector('MEXC_FUTURES', this.handlePriceUpdate.bind(this), () => {
      console.log('MEXC conectado');
    });
  }

  private handlePriceUpdate(data: PriceUpdate) {
    // Lógica de atualização de preços
    this.priceData.set(`${data.exchange}-${data.symbol}`, {
      bestAsk: data.bestAsk,
      bestBid: data.bestBid
    });
    console.log(`${data.exchange} ${data.symbol}: Bid=${data.bestBid}, Ask=${data.bestAsk}`);
  }

  private async recordArbitrageOpportunity(opportunity: any) {
    try {
      await prisma.spreadHistory.create({
        data: {
          symbol: opportunity.baseSymbol,
          exchangeBuy: opportunity.buyAt.exchange,
          exchangeSell: opportunity.sellAt.exchange,
          direction: opportunity.arbitrageType,
          spread: opportunity.profitPercentage,
          timestamp: new Date(opportunity.timestamp)
        }
      });
    } catch (error) {
      console.error('Erro ao salvar oportunidade:', error);
    }
  }

  public async start() {
    if (this.isRunning) {
      console.log('Worker já está em execução');
      return;
    }

    try {
      this.isRunning = true;
      console.log('Iniciando worker de arbitragem...');

      // Conecta às exchanges
      await Promise.all([
        this.gateioConnector.connect(['BTC/USDT', 'ETH/USDT', 'SOL/USDT']),
        this.mexcConnector.connect()
      ]);

      // Loop principal de monitoramento
      while (this.isRunning) {
        try {
          await this.checkArbitrageOpportunities();
          await new Promise(resolve => setTimeout(resolve, 1000)); // Intervalo de 1 segundo
        } catch (error) {
          console.error('Erro no ciclo de monitoramento:', error);
        }
      }
    } catch (error) {
      console.error('Erro fatal no worker:', error);
      this.isRunning = false;
    }
  }

  private async checkArbitrageOpportunities() {
    const pairs = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
    
    for (const pair of pairs) {
      try {
        const spotKey = `GATEIO_SPOT-${pair}`;
        const futuresKey = `MEXC_FUTURES-${pair}`;
        
        const spotData = this.priceData.get(spotKey);
        const futuresData = this.priceData.get(futuresKey);

        if (!spotData || !futuresData) {
          console.log(`Dados incompletos para ${pair}`);
          continue;
        }

        const spread = calculateSpread(spotData.bestAsk.toString(), futuresData.bestBid.toString());
        
        if (spread && parseFloat(spread) >= 0.5) { // 0.5% de spread mínimo
          const opportunity = {
            type: 'arbitrage',
            baseSymbol: pair,
            profitPercentage: parseFloat(spread),
            buyAt: {
              exchange: 'GATEIO',
              price: spotData.bestAsk,
              marketType: 'spot'
            },
            sellAt: {
              exchange: 'MEXC',
              price: futuresData.bestBid,
              marketType: 'futures'
            },
            arbitrageType: 'spot_to_futures',
            timestamp: Date.now()
          };

          await this.recordArbitrageOpportunity(opportunity);
        }
      } catch (error) {
        console.error(`Erro ao processar ${pair}:`, error);
      }
    }
  }

  public stop() {
    this.isRunning = false;
    console.log('Parando worker de arbitragem...');
  }
}

// Inicia o worker
const worker = new ArbitrageWorker();
worker.start().catch(console.error);

// Tratamento de sinais para parada graciosa
process.on('SIGTERM', () => {
  console.log('Recebido sinal SIGTERM');
  worker.stop();
});

process.on('SIGINT', () => {
  console.log('Recebido sinal SIGINT');
  worker.stop();
}); 