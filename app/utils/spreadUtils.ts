import Decimal from 'decimal.js';

/**
 * Calcula o spread percentual entre preço de venda e compra
 * @param sellPrice Preço de venda
 * @param buyPrice Preço de compra
 * @returns Spread percentual com 4 casas decimais ou null se inválido
 */
export function calculateSpread(sellPrice: number | string, buyPrice: number | string): string | null {
  try {
    // Garante que os valores são strings para evitar erros de precisão do JavaScript
    const sell = new Decimal(sellPrice.toString().trim());
    const buy = new Decimal(buyPrice.toString().trim());

    // Validações rigorosas
    if (buy.isZero() || buy.isNegative() || sell.isNegative() || 
        !buy.isFinite() || !sell.isFinite() ||
        buy.equals(0) || sell.equals(0)) {
      return null;
    }

    // Se os valores forem exatamente iguais, retorna zero
    if (sell.equals(buy)) {
      return "0.0000";
    }

    // Cálculo do spread mantendo precisão máxima em cada etapa
    const difference = sell.minus(buy);
    const ratio = difference.dividedBy(buy);
    const percentageSpread = ratio.times(100);

    // Validação do resultado - apenas verifica se é finito
    if (!percentageSpread.isFinite()) {
      return null;
    }

    // Arredonda para 4 casas decimais apenas no final
    // Usamos 4 casas para ter mais precisão no cálculo e exibição
    return percentageSpread.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toString();
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
 * Formata um valor para exibição mantendo precisão significativa
 * @param value Valor a ser formatado
 * @param minDecimals Mínimo de casas decimais
 * @param maxDecimals Máximo de casas decimais
 */
export function formatValue(value: string | number, minDecimals: number = 2, maxDecimals: number = 8): string {
  try {
    const decimal = new Decimal(value.toString().trim());
    
    // Determina o número de casas decimais significativas
    const stringValue = decimal.toString();
    const decimalPart = stringValue.split('.')[1] || '';
    const significantDecimals = Math.min(
      Math.max(decimalPart.length, minDecimals),
      maxDecimals
    );

    return decimal.toDecimalPlaces(significantDecimals, Decimal.ROUND_HALF_UP).toString();
  } catch {
    return '0';
  }
}

/**
 * Compara dois valores de spread com precisão
 */
export function compareSpread(a: string | null, b: string | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return -1;
  if (b === null) return 1;

  try {
    const decimalA = new Decimal(a.trim());
    const decimalB = new Decimal(b.trim());
    return decimalA.comparedTo(decimalB);
  } catch {
    return 0;
  }
}

/**
 * Verifica se um spread é válido e significativo
 */
export function isValidSpread(spread: string | null): boolean {
  if (!spread) return false;
  try {
    const value = new Decimal(spread.trim());
    return !value.isNegative() && value.isFinite() && !value.isZero();
  } catch {
    return false;
  }
} 