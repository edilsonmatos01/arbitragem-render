"use client";

import React, { useState, useEffect } from 'react';
import { RefreshCw, Wallet, AlertCircle } from 'lucide-react';

interface Balance {
  total: number;
  free: number;
  used: number;
  type?: 'spot' | 'futures';
}

interface ExchangeBalance {
  success: boolean;
  exchange: string;
  balances?: Record<string, Balance>;
  error?: string;
  timestamp?: string;
}

interface BalancesResponse {
  success: boolean;
  exchanges: ExchangeBalance[];
}

export default function ExchangeBalances() {
  const [balances, setBalances] = useState<ExchangeBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchBalances = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Buscar saldos em paralelo
      const [gateioResponse, mexcFuturesResponse] = await Promise.all([
        fetch('/api/trading/balance?exchange=gateio'),
        fetch('/api/mexc-futures')
      ]);
      
      const gateioData = await gateioResponse.json();
      const mexcData = await mexcFuturesResponse.json();
      
      // Montar array de exchanges no formato esperado
      const exchangesData = [
        gateioData,
        mexcData
      ];
      
      setBalances(exchangesData);
      setLastUpdate(new Date());
      
    } catch (err) {
      console.error('Erro ao buscar saldos:', err);
      setError('Erro de conexão ao buscar saldos');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBalances();
    // Atualizar saldos a cada 30 segundos
    const interval = setInterval(fetchBalances, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === 'USDT' || currency === 'USD') {
      return `$${amount.toFixed(2)}`;
    }
    return `${amount.toFixed(8)} ${currency}`;
  };

  const getExchangeDisplayName = (exchange: string) => {
    if (exchange === 'gateio') return 'Gate.io';
    if (exchange === 'mexc') return 'MEXC';
    return exchange.toUpperCase();
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-custom-cyan" />
          <h3 className="text-lg font-semibold text-white">Saldos das Exchanges</h3>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-xs text-gray-400">
              Atualizado: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchBalances}
            disabled={isLoading}
            className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-md flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {balances.map((exchangeBalance) => (
          <div key={exchangeBalance.exchange} className="bg-gray-700 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-medium text-white">
                {getExchangeDisplayName(exchangeBalance.exchange)}
              </h4>
              <div className={`w-2 h-2 rounded-full ${exchangeBalance.success ? 'bg-green-400' : 'bg-red-400'}`} />
            </div>

            {!exchangeBalance.success ? (
              <div className="text-red-400 text-sm">
                {exchangeBalance.error || 'Erro ao conectar'}
              </div>
            ) : exchangeBalance.balances && Object.keys(exchangeBalance.balances).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(exchangeBalance.balances)
                  .sort(([a], [b]) => {
                    // Priorizar USDT primeiro
                    if (a === 'USDT') return -1;
                    if (b === 'USDT') return 1;
                    return a.localeCompare(b);
                  })
                  .slice(0, 5) // Mostrar apenas os 5 principais
                  .map(([currency, balance]) => (
                    <div key={currency} className="flex justify-between items-center text-sm">
                      <div className="flex flex-col">
                        <span className="text-gray-300">{currency}</span>
                        {balance.type && (
                          <span className={`text-xs ${balance.type === 'futures' ? 'text-yellow-400' : 'text-blue-400'}`}>
                            {balance.type === 'futures' ? 'Futures' : 'Spot'}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-white font-medium">
                          {formatCurrency(balance.free, currency)}
                        </div>
                        {balance.used > 0 && (
                          <div className="text-xs text-gray-400">
                            Em uso: {formatCurrency(balance.used, currency)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                
                {Object.keys(exchangeBalance.balances).length > 5 && (
                  <div className="text-xs text-gray-400 text-center pt-2">
                    +{Object.keys(exchangeBalance.balances).length - 5} outras moedas
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-400 text-sm">Nenhum saldo disponível</div>
            )}
          </div>
        ))}
      </div>

      {isLoading && balances.length === 0 && (
        <div className="text-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-custom-cyan" />
          <div className="text-gray-400">Carregando saldos...</div>
        </div>
      )}
    </div>
  );
} 