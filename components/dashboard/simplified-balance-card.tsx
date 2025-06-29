'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

interface BalanceItem {
  currency?: string; // Gate.io usa currency
  asset?: string;    // MEXC usa asset
  available?: string; // Gate.io
  free?: string;       // MEXC
  locked?: string;
}

interface ApiResponse {
  balances?: BalanceItem[];
  error?: string;
  details?: string;
}

export default function SimplifiedBalanceCard() {
  const [totalBalance, setTotalBalance] = useState<string>('0.00');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchBalances = async () => {
    if (!isRefreshing) setIsLoading(true);
    setError(null);
    let total = 0;
    let hasError = false;

    const exchangeEndpoints = [
      { name: 'Gate.io', endpoint: '/api/gateio/wallet-balance' },
      { name: 'MEXC', endpoint: '/api/mexc/wallet-balance' },
    ];

    try {
      for (const exchange of exchangeEndpoints) {
        try {
          const response = await fetch(exchange.endpoint);
          
          if (!response.ok) {
            const textResponse = await response.text();
            console.error(`Erro na API ${exchange.name}: Status ${response.status}, Resposta: ${textResponse}`);
            const specificError = `Falha ao buscar da ${exchange.name}: ${response.status}`;
            setError(prevError => prevError ? `${prevError}; ${specificError}` : specificError);
            hasError = true;
            continue;
          }
          const data: ApiResponse = await response.json();

          let usdtBalanceValue = 0;
          if (data.balances) { 
            const usdtEntry = data.balances.find(b => (b.asset === 'USDT' || b.currency === 'USDT'));
            if (usdtEntry) {
              // Prioriza 'available' se existir (Gate.io), senão usa 'free' (MEXC)
              const availableAmount = parseFloat(usdtEntry.available || usdtEntry.free || '0');
              const lockedAmount = parseFloat(usdtEntry.locked || '0');
              usdtBalanceValue = availableAmount + lockedAmount; // Soma o disponível/livre com o bloqueado para ter o total em USDT
            }
          }
          total += usdtBalanceValue;
        } catch (e: any) {
          console.error(`Erro ao processar ${exchange.name}:`, e);
          const specificError = e.message.includes("fetch") ? `Falha de conexão com ${exchange.name}. Verifique a API ou a rede.` : `Erro ao processar dados da ${exchange.name}.`;
          setError(prevError => prevError ? `${prevError}; ${specificError}` : specificError);
          hasError = true;
        }
      }

      if (!hasError) {
        setTotalBalance(total.toFixed(2));
      }

    } catch (globalError) {
      console.error("Erro global em fetchBalances:", globalError);
      setError(globalError instanceof Error ? globalError.message : 'Erro desconhecido ao calcular saldo total');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchBalances();
  };

  return (
    <div className="bg-dark-card p-6 rounded-lg shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-medium text-white">Saldo Total Exchanges</h3>
          <p className="text-sm text-gray-400">Gate.io (Spot) + MEXC (Futuros)</p>
        </div>
        <button 
          onClick={handleRefresh}
          disabled={isLoading || isRefreshing}
          className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          title="Atualizar saldo"
        >
          <RefreshCw className={`h-5 w-5 ${isRefreshing || (isLoading && !isRefreshing) ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="mt-2">
        {(isLoading && !isRefreshing) ? (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-custom-cyan" />
            <span className="text-sm text-gray-400">Carregando...</span>
          </div>
        ) : error ? (
          <div className="text-red-400 text-sm">{error}</div>
        ) : (
          <div className="text-3xl font-bold text-custom-cyan">
            US$ {totalBalance}
          </div>
        )}
      </div>
    </div>
  );
} 