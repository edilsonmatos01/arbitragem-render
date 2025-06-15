'use client';

import { useEffect, useState } from 'react';
import { TradingPair, calculateSpread, mockTradingPairs } from '../utils/spreadCalculator';
import { formatValue, isValidSpread } from '../utils/spreadUtils';
import Decimal from 'decimal.js';

export default function SpreadDisplay() {
  const [pairs, setPairs] = useState<TradingPair[]>([]);

  useEffect(() => {
    // Calcula o spread para cada par e atualiza o estado
    const pairsWithSpread = mockTradingPairs.map(pair => ({
      ...pair,
      spread: calculateSpread(pair.sellPrice, pair.buyPrice)
    }));

    // Ordena os pares por spread (maior para menor)
    const sortedPairs = pairsWithSpread
      .filter(pair => isValidSpread(pair.spread))
      .sort((a, b) => {
        const spreadA = new Decimal(a.spread || '0');
        const spreadB = new Decimal(b.spread || '0');
        return spreadB.minus(spreadA).toNumber();
      });

    setPairs(sortedPairs);
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 text-white">Spreads Disponíveis</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pairs.map(pair => (
          <div
            key={pair.symbol}
            className="bg-dark-card p-4 rounded-lg shadow-lg"
          >
            <h3 className="text-lg font-semibold mb-2 text-white">{pair.symbol}</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-gray-400">Gate.io (spot):</div>
              <div className="text-white">{formatValue(pair.buyPrice, 4, 8)}</div>
              <div className="text-gray-400">MEXC (futures):</div>
              <div className="text-white">{formatValue(pair.sellPrice, 4, 8)}</div>
              <div className="text-gray-400">Spread:</div>
              <div className={`font-medium ${pair.spread && new Decimal(pair.spread).gte('0.5') ? 'text-green-400' : 'text-white'}`}>
                {formatValue(pair.spread || '0', 4, 4)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 