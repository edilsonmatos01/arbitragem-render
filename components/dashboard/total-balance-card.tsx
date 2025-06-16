'use client';

import { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

// Tipos para as respostas das APIs de saldo
interface BalanceItem {
  currency?: string; // Gate.io usa currency
  asset?: string;    // Binance, MEXC usam asset
  available?: string; // Gate.io
  free?: string;       // Binance, MEXC
  locked?: string;
  // Para Bybit, os campos relevantes estão dentro de BybitCoinData
}

interface BybitCoinData {
  coin: string; // Nome da moeda, ex: USDT
  walletBalance: string;
  availableToWithdraw?: string; // Outros campos que podem ser úteis
  free?: string; // Bybit também pode ter 'free' em outros contextos
}

interface ApiResponse {
  balances?: BalanceItem[]; // Usado por Binance, Gate.io, MEXC
  error?: string;
  details?: string; 
  // Campos específicos da Bybit
  retCode?: number;
  retMsg?: string;
  result?: {
    list?: {
      coin: BybitCoinData[];
    }[];
  };
}

export default function TotalBalanceCard() {
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
              // Prioriza 'available' se existir (Gate.io), senão usa 'free' (Binance, MEXC)
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
    fetchBalances(); // Mantém a busca inicial ao montar o componente
    // Remove o intervalo de atualização automática
    // const intervalId = setInterval(fetchBalances, 60000);
    // return () => clearInterval(intervalId);
  }, []); // Array de dependências vazio para executar apenas na montagem

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchBalances();
  };

  return (
    <div className="bg-dark-card p-6 rounded-lg shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-medium text-white">Saldo Total Exchanges</h3>
          <p className="text-sm text-gray-400">Somatório de todas as carteiras (USDT)</p>
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
          <p className="text-sm text-red-400">{error}</p>
        ) : (
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-white">US$ {totalBalance}</span>
          </div>
        )}
      </div>
    </div>
  );
} 