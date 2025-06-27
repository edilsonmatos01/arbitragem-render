import Decimal from 'decimal.js';

/**
 * Calcula o spread percentual entre preço de venda e compra
 * @param sellPrice Preço de venda
 * @param buyPrice Preço de compra
 * @returns Spread percentual com 4 casas decimais ou null se inválido
 */
export function calculateSpread(buyPrice: number, sellPrice: number): number {
  if (!buyPrice || !sellPrice || buyPrice <= 0 || sellPrice <= 0) {
    return 0;
  }
  return ((sellPrice - buyPrice) / buyPrice) * 100;
}

export function formatSpread(spread: number): string {
  return spread.toFixed(2) + '%';
}

export function isValidSpread(spread: number): boolean {
  return !isNaN(spread) && isFinite(spread) && spread > -100 && spread < 100;
}

export function normalizeSymbol(symbol: string): string {
  return symbol.replace('_', '/').toUpperCase();
}

export function denormalizeSymbol(symbol: string): string {
  return symbol.replace('/', '_').toLowerCase();
} 