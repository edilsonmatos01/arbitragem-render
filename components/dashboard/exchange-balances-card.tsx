'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

interface Balance {
  asset: string;
  free: string;
  locked: string;
  total: string;
}

interface ExchangeBalance {
  exchange: string;
  balances: Balance[];
  lastUpdate: Date;
}

export default function ExchangeBalancesCard() {
  const [balances, setBalances] = useState<ExchangeBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Simular dados de exemplo
      const mockData: ExchangeBalance[] = [
        {
          exchange: 'Binance',
          balances: [
            { asset: 'USDT', free: '1000.00', locked: '0.00', total: '1000.00' },
            { asset: 'BTC', free: '0.05', locked: '0.00', total: '0.05' },
            { asset: 'ETH', free: '1.5', locked: '0.00', total: '1.5' },
          ],
          lastUpdate: new Date(),
        },
        {
          exchange: 'Bybit',
          balances: [
            { asset: 'USDT', free: '1500.00', locked: '0.00', total: '1500.00' },
            { asset: 'BTC', free: '0.03', locked: '0.00', total: '0.03' },
            { asset: 'ETH', free: '2.0', locked: '0.00', total: '2.0' },
          ],
          lastUpdate: new Date(),
        },
      ];

      setBalances(mockData);
    } catch (err) {
      setError('Erro ao carregar saldos');
      console.error('Erro ao buscar saldos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {balances.map((exchange) => (
        <div key={exchange.exchange} className="bg-dark-card rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">{exchange.exchange}</h2>
            <button
              onClick={fetchBalances}
              disabled={isLoading}
              className="p-2 hover:bg-dark-bg rounded-full transition-colors"
            >
              <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {error ? (
            <div className="text-red-500 mb-4">{error}</div>
          ) : (
            <div className="space-y-4">
              {exchange.balances.map((balance) => (
                <div key={balance.asset} className="flex justify-between items-center p-3 bg-dark-bg rounded-lg">
                  <div className="flex items-center">
                    <span className="text-lg font-medium">{balance.asset}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-custom-cyan font-medium">{balance.total}</div>
                    <div className="text-sm text-gray-400">
                      Disponível: {balance.free}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 text-sm text-gray-400">
            Última atualização: {exchange.lastUpdate.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
} 