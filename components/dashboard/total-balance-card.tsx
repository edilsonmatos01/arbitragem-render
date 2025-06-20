'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

interface Balance {
  asset: string;
  free: string;
  locked: string;
  total: string;
  usdValue: string;
}

export default function TotalBalanceCard() {
  const [totalBalance, setTotalBalance] = useState('0.00');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTotalBalance = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Simular dados de exemplo
      const mockBalances: Balance[] = [
        { asset: 'USDT', free: '1000.00', locked: '0.00', total: '1000.00', usdValue: '1000.00' },
        { asset: 'BTC', free: '0.05', locked: '0.00', total: '0.05', usdValue: '2500.00' },
        { asset: 'ETH', free: '1.5', locked: '0.00', total: '1.5', usdValue: '3000.00' },
      ];

      const total = mockBalances.reduce((acc, balance) => acc + parseFloat(balance.usdValue), 0);
      setTotalBalance(total.toFixed(2));
    } catch (err) {
      setError('Erro ao carregar saldo total');
      console.error('Erro ao buscar saldo total:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTotalBalance();
  }, []);

  return (
    <div className="bg-dark-card p-6 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-medium text-white">Saldo Total</h3>
          <p className="text-sm text-gray-400">Valor total em USD</p>
        </div>
        <button
          onClick={fetchTotalBalance}
          disabled={isLoading}
          className="p-2 hover:bg-dark-bg rounded-full transition-colors"
        >
          <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error ? (
        <div className="text-red-500">{error}</div>
      ) : (
        <div className="text-3xl font-bold text-custom-cyan">
          ${totalBalance}
        </div>
      )}
    </div>
  );
} 