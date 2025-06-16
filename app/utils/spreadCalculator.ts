import Decimal from 'decimal.js';

/**
 * Calcula o spread percentual entre preço de venda e compra
 * @param sellPrice Preço de venda (MEXC)
 * @param buyPrice Preço de compra (Gate.io)
 * @returns Spread percentual com 2 casas decimais ou null se inválido
 */
export function calculateSpread(sellPrice: number | string, buyPrice: number | string): string | null {
  try {
    // Garante que estamos usando os valores com máxima precisão
    const sell = new Decimal(sellPrice.toString());
    const buy = new Decimal(buyPrice.toString());

    // Validações iniciais
    if (buy.isZero() || buy.isNegative() || sell.isNegative()) {
      return null;
    }

    // Se os valores forem exatamente iguais, retorna null (spread zero)
    if (sell.equals(buy)) {
      return null;
    }

    // Cálculo do spread com máxima precisão:
    // ((venda - compra) / compra) * 100
    const spread = sell
      .minus(buy)           // (venda - compra)
      .dividedBy(buy)       // / compra
      .times(100);         // * 100

    // Se o spread for negativo ou zero, retorna null
    if (spread.isNegative() || spread.isZero()) {
      return null;
    }

    // Arredonda para 2 casas decimais apenas no final e converte para string
    return spread.toDecimalPlaces(2).toString();
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

// Dados mockados atualizados com os casos de teste mencionados
export const mockTradingPairs: TradingPair[] = [
  // Casos de teste específicos
  { symbol: 'PRAI/USDT', buyPrice: '0.02477', sellPrice: '0.02486' },
  { symbol: 'MEMEFI/USDT', buyPrice: '0.0014388', sellPrice: '0.001441' },
  { symbol: 'SOLO/USDT', buyPrice: '0.24571', sellPrice: '0.2462' },
  { symbol: 'OMNI/USDT', buyPrice: '1.88', sellPrice: '1.88' },
  // Outros pares
  { symbol: 'MOVE/USDT', buyPrice: '0.14182', sellPrice: '0.1431' },
  { symbol: 'BLZ/USDT', buyPrice: '0.03394', sellPrice: '0.03413' },
  { symbol: 'LOKA/USDT', buyPrice: '0.053', sellPrice: '0.0532' },
  { symbol: 'FB/USDT', buyPrice: '0.466', sellPrice: '0.4667' },
  { symbol: 'MAVIA/USDT', buyPrice: '0.1628', sellPrice: '0.1629' },
  { symbol: 'VELODROME/USDT', buyPrice: '0.04993', sellPrice: '0.05' },
]; 