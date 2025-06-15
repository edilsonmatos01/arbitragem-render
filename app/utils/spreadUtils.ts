import Decimal from 'decimal.js';

/**
 * Calcula o spread percentual entre preço de venda e compra
 * @param sellPrice Preço de venda
 * @param buyPrice Preço de compra
 * @returns Spread percentual com 2 casas decimais ou null se inválido
 */
export function calculateSpread(sellPrice: number | string, buyPrice: number | string): string | null {
  try {
    // Converte os valores para string e cria novos Decimals com precisão máxima
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

/**
 * Normaliza um valor de spread para garantir precisão
 * @param spread Valor do spread em porcentagem
 * @returns Spread normalizado com 2 casas decimais ou null se inválido
 */
export function normalizeSpread(spread: number | string): string | null {
  try {
    const decimalSpread = new Decimal(spread.toString());
    
    if (decimalSpread.isNegative() || decimalSpread.isZero() || !decimalSpread.isFinite()) {
      return null;
    }

    return decimalSpread.toDecimalPlaces(2).toString();
  } catch (error) {
    console.error('Erro ao normalizar spread:', error);
    return null;
  }
}

/**
 * Compara dois valores de spread
 * @returns -1 se a < b, 0 se iguais, 1 se a > b
 */
export function compareSpread(a: string | null, b: string | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return -1;
  if (b === null) return 1;

  try {
    const decimalA = new Decimal(a);
    const decimalB = new Decimal(b);
    return decimalA.comparedTo(decimalB);
  } catch {
    return 0;
  }
} 