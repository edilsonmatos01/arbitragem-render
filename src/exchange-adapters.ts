import { GateIoConnector } from './gateio-connector';
import { MexcConnector } from './mexc-connector';
import { ExchangeConnector, Ticker } from './types';

export class GateIoAdapter implements ExchangeConnector {
  private connector: GateIoConnector;

  constructor(apiKey: string, apiSecret: string) {
    this.connector = new GateIoConnector(apiKey, apiSecret);
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const spotTicker = await this.connector.getSpotTicker(symbol);
    return {
      buy: spotTicker.bestBid.toString(),
      sell: spotTicker.bestAsk.toString(),
      symbol
    };
  }
}

export class MexcAdapter implements ExchangeConnector {
  private connector: MexcConnector;

  constructor(apiKey: string, apiSecret: string) {
    this.connector = new MexcConnector(apiKey, apiSecret);
  }

  async getTicker(symbol: string): Promise<Ticker> {
    const spotTicker = await this.connector.getSpotTicker(symbol);
    return {
      buy: spotTicker.bid.toString(),
      sell: spotTicker.ask.toString(),
      symbol
    };
  }
} 