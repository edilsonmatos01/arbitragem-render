import Decimal from 'decimal.js';

/**
 * Calcula o spread percentual entre preço de venda e compra
 * @param sellPrice Preço de venda (MEXC)
 * @param buyPrice Preço de compra (Gate.io)
 * @returns Spread percentual com 2 casas decimais ou null se inválido
 */
export function calculateSpread(sellPrice: number | string, buyPrice: number | string): string | null {
  try {
    // Converte os valores para string e cria novos Decimals com precisão máxima
    const sell = new Decimal(sellPrice.toString());
    const buy = new Decimal(buyPrice.toString());

    // Validações
    if (buy.isZero() || buy.isNegative() || sell.isNegative()) {
      return null;
    }

    // Cálculo do spread: ((venda - compra) / compra) * 100
    // 1. Primeiro calcula a diferença (venda - compra)
    const difference = sell.minus(buy);
    
    // 2. Divide pela compra
    const ratio = difference.dividedBy(buy);
    
    // 3. Multiplica por 100 para obter a porcentagem
    const spreadPercent = ratio.times(100);
    
    // 4. Arredonda para 2 casas decimais apenas no final
    const finalSpread = spreadPercent.toDecimalPlaces(2);

    // Se o spread for zero ou negativo, retorna null
    if (finalSpread.isNegative() || finalSpread.isZero()) {
      return null;
    }

    // Retorna o spread como string para manter a precisão
    return finalSpread.toString();
  } catch (error) {
    console.error('Erro ao calcular spread:', error);
    return null;
  }
}

// Tipo para representar um par de trading
export interface TradingPair {
  symbol: string;
  buyPrice: string;  // Gate.io (spot)
  sellPrice: string; // MEXC (futures)
  spread?: string | null;
}

// Dados mockados para teste com valores como strings para manter precisão
export const mockTradingPairs: TradingPair[] = [
  { symbol: 'MOVE/USDT', buyPrice: '0.14182', sellPrice: '0.1431' },
  { symbol: 'BLZ/USDT', buyPrice: '0.03394', sellPrice: '0.03413' },
  { symbol: 'LOKA/USDT', buyPrice: '0.053', sellPrice: '0.0532' },
  { symbol: 'PRAI/USDT', buyPrice: '0.02488', sellPrice: '0.02495' },
  { symbol: 'FB/USDT', buyPrice: '0.466', sellPrice: '0.4667' },
  { symbol: 'ZKJ/USDT', buyPrice: '0.3227', sellPrice: '0.3227' },
  { symbol: 'MAVIA/USDT', buyPrice: '0.1628', sellPrice: '0.1629' },
  { symbol: 'VELODROME/USDT', buyPrice: '0.04993', sellPrice: '0.05' },
]; 