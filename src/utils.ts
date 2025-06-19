export function calculateSpreadPercentage(price1: number, price2: number): number {
  return ((price2 - price1) / price1) * 100;
} 