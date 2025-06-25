import { GateIoConnector } from './connectors/gateio-connector';
import { MexcConnector } from './connectors/mexc-connector';
import { PrismaClient } from '@prisma/client';
import { calculateSpread } from './utils';

interface PriceData {
  bestAsk: number;
  bestBid: number;
}

interface PriceUpdate {
  identifier: string;
  symbol: string;
  marketType: 'spot' | 'futures';
  bestAsk: number;
  bestBid: number;
}

interface ExchangePair {
  symbol: string;
  active: boolean;
}

const prisma = new PrismaClient();

class ArbitrageWorker {
  private gateioConnector: GateIoConnector;
  private mexcConnector: MexcConnector;
  private isRunning: boolean = false;
  private priceData: Map<string, PriceData> = new Map();
  private availablePairs: Set<string> = new Set();
  private lastPairUpdate: number = 0;
  private readonly PAIR_UPDATE_INTERVAL = 1000 * 60 * 5; // 5 minutos

  constructor() {
    this.gateioConnector = new GateIoConnector(
      'GATEIO_SPOT',
      this.handlePriceUpdate.bind(this)
    );
    
    this.mexcConnector = new MexcConnector(
      'MEXC_FUTURES',
      this.handlePriceUpdate.bind(this),
      () => {
        console.log('MEXC conectado');
      }
    );
  }

  private async updateAvailablePairs(): Promise<void> {
    try {
      // Obtém os pares disponíveis de cada exchange
      const [gateioSpotPairs, mexcFuturesPairs] = await Promise.all([
        this.gateioConnector.getAvailablePairs(),
        this.mexcConnector.getAvailablePairs()
      ]);

      // Encontra os pares que existem em ambas as exchanges
      const gateioSet = new Set(gateioSpotPairs.map(p => p.symbol));
      const mexcSet = new Set(mexcFuturesPairs.map(p => p.symbol));
      
      this.availablePairs.clear();
      for (const pair of gateioSet) {
        if (mexcSet.has(pair)) {
          this.availablePairs.add(pair);
        }
      }

      console.log(`Pares disponíveis atualizados. Total: ${this.availablePairs.size}`);
      this.lastPairUpdate = Date.now();

      // Reconecta aos websockets com os novos pares
      await this.reconnectWebSockets();
    } catch (error) {
      console.error('Erro ao atualizar pares disponíveis:', error);
    }
  }

  private async reconnectWebSockets(): Promise<void> {
    try {
      // Desconecta as conexões existentes
      await Promise.all([
        this.gateioConnector.disconnect(),
        this.mexcConnector.disconnect()
      ]);

      // Reconecta com os novos pares
      const pairs = Array.from(this.availablePairs);
      await Promise.all([
        this.gateioConnector.connect(pairs),
        this.mexcConnector.connect()
      ]);

      console.log(`Reconectado aos WebSockets com ${pairs.length} pares`);
    } catch (error) {
      console.error('Erro ao reconectar WebSockets:', error);
    }
  }

  private handlePriceUpdate(data: PriceUpdate): void {
    this.priceData.set(`${data.identifier}-${data.symbol}`, {
      bestAsk: data.bestAsk,
      bestBid: data.bestBid
    });
    console.log(`${data.identifier} ${data.symbol}: Bid=${data.bestBid}, Ask=${data.bestAsk}`);
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

      // Primeira atualização dos pares disponíveis
      await this.updateAvailablePairs();

      // Loop principal de monitoramento
      while (this.isRunning) {
        try {
          // Atualiza a lista de pares a cada intervalo definido
          if (Date.now() - this.lastPairUpdate >= this.PAIR_UPDATE_INTERVAL) {
            await this.updateAvailablePairs();
          }

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
    for (const pair of this.availablePairs) {
      try {
        const spotKey = `GATEIO_SPOT-${pair}`;
        const futuresKey = `MEXC_FUTURES-${pair}`;
        
        const spotData = this.priceData.get(spotKey);
        const futuresData = this.priceData.get(futuresKey);

        if (!spotData || !futuresData) {
          continue; // Pula silenciosamente se não tiver dados
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
          console.log(`Oportunidade encontrada para ${pair} com spread de ${spread}%`);
        }
      } catch (error) {
        console.error(`Erro ao processar ${pair}:`, error);
      }
    }
  }

  public async stop() {
    this.isRunning = false;
    console.log('Parando worker de arbitragem...');
    
    // Desconecta os WebSockets
    await Promise.all([
      this.gateioConnector.disconnect(),
      this.mexcConnector.disconnect()
    ]);
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