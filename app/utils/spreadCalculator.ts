import Decimal from 'decimal.js';

/**
 * Calcula o spread percentual entre preço de venda e compra
 * @param sellPrice Preço de venda
 * @param buyPrice Preço de compra
 * @returns Spread percentual com 2 casas decimais ou null se inválido
 */
export function calculateSpread(sellPrice: number | string, buyPrice: number | string): string | null {
  try {
    // Converte os valores para string antes de criar o Decimal para evitar imprecisões
    const sell = new Decimal(sellPrice.toString());
    const buy = new Decimal(buyPrice.toString());

    // Validações
    if (buy.isZero() || buy.isNegative() || sell.isNegative()) {
      return null;
    }

    // Cálculo do spread: ((venda - compra) / compra) * 100
    // Mantém como Decimal até o último momento possível
    const spread = sell.minus(buy)
      .dividedBy(buy)
      .times(100)
      .toDecimalPlaces(2);

    // Retorna null se spread for negativo
    if (spread.isNegative()) {
      return null;
    }

    // Retorna o spread como string para manter a precisão
    return spread.toString();
  } catch (error) {
    console.error('Erro ao calcular spread:', error);
    return null;
  }
}

// Tipo para representar um par de trading
export interface TradingPair {
  symbol: string;
  buyPrice: string;  // Alterado para string para manter precisão
  sellPrice: string; // Alterado para string para manter precisão
  spread?: string | null;
}

// Dados mockados para teste com valores como strings para manter precisão
export const mockTradingPairs: TradingPair[] = [
  { symbol: 'CATS/USDT', buyPrice: '1.2000', sellPrice: '1.2100' },
  { symbol: 'MOVE/USDT', buyPrice: '0.5000', sellPrice: '0.5030' },
  { symbol: 'DOGE/USDT', buyPrice: '0.1000', sellPrice: '0.0990' }, // Spread negativo
  { symbol: 'BTC/USDT', buyPrice: '45000', sellPrice: '45300' },
  { symbol: 'ETH/USDT', buyPrice: '2500', sellPrice: '2515' },
  { symbol: 'XRP/USDT', buyPrice: '0.5500', sellPrice: '0.5530' },
  { symbol: 'SOL/USDT', buyPrice: '100', sellPrice: '100.8' },
  { symbol: 'ADA/USDT', buyPrice: '0.4000', sellPrice: '0.4020' },
]; 