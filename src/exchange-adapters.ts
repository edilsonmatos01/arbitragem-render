import fetch from 'node-fetch';
import { GateIoConnector } from './gateio-connector';
import { MexcConnector } from './mexc-connector';
import { ExchangeConnector, Ticker } from './types';

interface GateIoTicker {
  currency_pair: string;
  last: string;
  lowest_ask: string;
  highest_bid: string;
  volume_24h: string;
}

interface MexcTicker {
  symbol: string;
  lastPrice: string;
  askPrice: string;
  bidPrice: string;
  volume: string;
}

export class GateIoAdapter implements ExchangeConnector {
  private connector: GateIoConnector;

  constructor(apiKey: string, apiSecret: string) {
    this.connector = new GateIoConnector(apiKey, apiSecret);
  }

  async getTicker(symbol: string): Promise<Ticker> {
    try {
      const response = await fetch(`https://api.gateio.ws/api/v4/spot/tickers?currency_pair=${symbol}`);
      const data = await response.json() as GateIoTicker[];
      const ticker = data[0];

      if (!ticker) {
        throw new Error(`No ticker data for ${symbol}`);
      }

      return {
        symbol,
        buy: ticker.highest_bid,
        sell: ticker.lowest_ask
      };
    } catch (error) {
      console.error(`Error fetching Gate.io ticker for ${symbol}:`, error);
      throw error;
    }
  }
}

export class MexcAdapter implements ExchangeConnector {
  private connector: MexcConnector;

  constructor(apiKey: string, apiSecret: string) {
    this.connector = new MexcConnector(apiKey, apiSecret);
  }

  async getTicker(symbol: string): Promise<Ticker> {
    try {
      const response = await fetch(`https://api.mexc.com/api/v3/ticker/24hr?symbol=${symbol}`);
      const ticker = await response.json() as MexcTicker;

      return {
        symbol,
        buy: ticker.bidPrice,
        sell: ticker.askPrice
      };
    } catch (error) {
      console.error(`Error fetching MEXC ticker for ${symbol}:`, error);
      throw error;
    }
  }
} 