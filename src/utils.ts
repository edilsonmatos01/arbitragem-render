export function calculateSpread(spotPrice: number, futuresPrice: number): number {
  if (spotPrice <= 0 || futuresPrice <= 0) {
    return 0;
  }
  return ((futuresPrice - spotPrice) / spotPrice) * 100;
} 