'use client';

import { useEffect, useState } from 'react';
import { TradingPair, calculateSpread, mockTradingPairs } from '../utils/spreadCalculator';
import Decimal from 'decimal.js';

export default function SpreadDisplay() {
  const [pairs, setPairs] = useState<TradingPair[]>([]);

  useEffect(() => {
    // Calcula o spread para cada par e atualiza o estado
    const pairsWithSpread = mockTradingPairs.map(pair => ({
      ...pair,
      spread: calculateSpread(pair.sellPrice, pair.buyPrice)
    }));
    setPairs(pairsWithSpread);
  }, []);

  const formatValue = (value: string, decimals: number = 4): string => {
    try {
      return new Decimal(value).toDecimalPlaces(decimals).toString();
    } catch {
      return '0';
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 text-white">Spreads Disponíveis</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pairs
          .filter(pair => pair.spread !== null) // Filtra apenas spreads positivos
          .map(pair => (
            <div
              key={pair.symbol}
              className="bg-dark-card p-4 rounded-lg shadow-lg"
            >
              <h3 className="text-lg font-semibold mb-2 text-white">{pair.symbol}</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-400">Compra:</div>
                <div className="text-white">{formatValue(pair.buyPrice)}</div>
                <div className="text-gray-400">Venda:</div>
                <div className="text-white">{formatValue(pair.sellPrice)}</div>
                <div className="text-gray-400">Spread:</div>
                <div className={`font-medium ${pair.spread && new Decimal(pair.spread).gte('0.5') ? 'text-green-400' : 'text-white'}`}>
                  {pair.spread}%
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
} 