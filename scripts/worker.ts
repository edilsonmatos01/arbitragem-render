import { GateIoConnector } from './connectors/gateio-connector';
import { MexcConnector } from './connectors/mexc-connector';
import { PrismaClient } from '@prisma/client';
import { calculateSpread } from './utils';

const prisma = new PrismaClient();

class ArbitrageWorker {
  private gateioConnector: GateIoConnector;
  private mexcConnector: MexcConnector;
  private isRunning: boolean = false;

  constructor() {
    this.gateioConnector = new GateIoConnector('GATEIO_SPOT', this.handlePriceUpdate.bind(this));
    this.mexcConnector = new MexcConnector('MEXC_FUTURES', this.handlePriceUpdate.bind(this));
  }

  private handlePriceUpdate(exchange: string, symbol: string, bestBid: number, bestAsk: number) {
    // Lógica de atualização de preços
    console.log(`${exchange} ${symbol}: Bid=${bestBid}, Ask=${bestAsk}`);
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
          spotPrice: opportunity.buyAt.marketType === 'spot' ? opportunity.buyAt.price : opportunity.sellAt.price,
          futuresPrice: opportunity.buyAt.marketType === 'futures' ? opportunity.buyAt.price : opportunity.sellAt.price,
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
        const [spotData, futuresData] = await Promise.all([
          this.gateioConnector.getTradablePairs(),
          this.mexcConnector.getTradablePairs()
        ]);

        if (!spotData || !futuresData) continue;

        const spread = calculateSpread(spotData.bestAsk, futuresData.bestBid);
        
        if (spread >= 0.5) { // 0.5% de spread mínimo
          const opportunity = {
            type: 'arbitrage',
            baseSymbol: pair,
            profitPercentage: spread,
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