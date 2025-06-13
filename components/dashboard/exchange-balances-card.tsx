'use client';

import { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

// Definições de tipo consistentes com TotalBalanceCard
interface BalanceItem {
  currency?: string;
  asset?: string;
  available?: string;
  free?: string;
  locked?: string;
}

interface BybitCoinData {
  coin: string;
  walletBalance: string;
  availableToWithdraw?: string;
  free?: string;
}

interface ApiResponse {
  balances?: BalanceItem[];
  error?: string;
  details?: string;
  retCode?: number;
  retMsg?: string;
  result?: {
    list?: {
      coin: BybitCoinData[];
    }[];
  };
}

interface ExchangeDisplayBalance {
  exchange: string;
  balance: string;
  rawData?: any; // Para debug
  error?: string;
}

export default function ExchangeBalancesCard() {
  const [balances, setBalances] = useState<ExchangeDisplayBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');

  const exchangeConfigs = [
    { name: 'Gate.io', endpoint: '/api/gateio/wallet-balance', assetField: 'currency', freeField: 'available', lockedField: 'locked' },
    { name: 'MEXC', endpoint: '/api/mexc/wallet-balance', assetField: 'asset', freeField: 'free', lockedField: 'locked' },
  ];

  const fetchBalances = async () => {
    if (!isRefreshing) setIsLoading(true);
    else setIsLoading(false); // Se estiver atualizando, o loading principal não deve ser total

    const newBalances: ExchangeDisplayBalance[] = [];
    let debugText = '';

    for (const config of exchangeConfigs) {
      try {
        const response = await fetch(config.endpoint);
        // Adiciona log para inspecionar a resposta antes de tentar o .json()
        if (!response.ok) {
          const textResponse = await response.text(); // Lê como texto se não for OK
          console.error(`Erro na API ${config.name}: Status ${response.status}, Resposta: ${textResponse}`);
          debugText += `\n${config.name} FETCH ERROR: Status ${response.status}, Response: ${textResponse.substring(0, 200)}...`;
          // Se a resposta não for OK, usamos a textResponse ou uma mensagem genérica
          throw new Error(`Erro ao buscar saldo da ${config.name}. Status: ${response.status}.`);
        }
        const data: ApiResponse = await response.json(); // Agora .json() é chamado apenas se response.ok
        debugText += `\n${config.name} Response: ${JSON.stringify(data, null, 2)}`;

        let usdtTotal = 0;
        let rawUsdtData: any = null;

        if (data.balances && config.assetField && config.freeField) {
          const usdtEntry = data.balances.find(b => (
            (b as any)[config.assetField!] === 'USDT' 
          ));
          rawUsdtData = usdtEntry;
          if (usdtEntry) {
            const freeAmount = parseFloat((usdtEntry as any)[config.freeField!] || '0');
            const lockedAmount = parseFloat(usdtEntry.locked || '0');
            usdtTotal = freeAmount + lockedAmount;
          }
        }

        newBalances.push({
          exchange: config.name,
          balance: usdtTotal.toFixed(2),
          rawData: rawUsdtData,
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        debugText += `\n${config.name} Error: ${errorMessage}`;
        newBalances.push({
          exchange: config.name,
          balance: '0.00',
          error: errorMessage,
          rawData: (error as any).response?.data || undefined // Tenta pegar dados da resposta do erro
        });
      }
    }

    setBalances(newBalances);
    setDebugInfo(debugText);
    // console.log('Debug Info ExchangeBalancesCard:', debugText);
 
    setIsLoading(false);
    setIsRefreshing(false);
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
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-medium text-white">Saldo por Corretora</h3>
          <p className="text-sm text-gray-400">Saldo em USDT de cada exchange</p>
        </div>
        <button 
          onClick={handleRefresh}
          disabled={isLoading || isRefreshing}
          className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          title="Atualizar saldos"
        >
          <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Total USDT */}
      <div className="mb-6 flex items-center gap-4 p-4 bg-gray-800/60 rounded-lg border border-gray-700/50">
        <span className="text-xl font-bold text-custom-cyan">US$ {balances.reduce((acc, b) => acc + (isNaN(Number(b.balance)) ? 0 : Number(b.balance)), 0).toFixed(2)}</span>
        <span className="text-base text-gray-300">USDT (Total em todas as carteiras)</span>
      </div>

      {(isLoading && !isRefreshing) ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-custom-cyan" />
        </div>
      ) : (
        <div className="space-y-4">
          {balances.map((balance) => (
            <div 
              key={balance.exchange}
              className="p-4 bg-gray-800/50 rounded-lg border border-gray-700/50"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-white font-medium">{balance.exchange}</span>
                  {balance.error && (
                    <p className="text-xs text-red-400 mt-1">Erro: {balance.error}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="flex items-baseline gap-1">
                    <span className={`text-lg font-bold ${balance.error ? 'text-gray-500' : 'text-white'}`}>US$ {balance.balance}</span>
                    {!balance.error && <span className="text-sm text-gray-400">USDT</span>}
                  </div>
                </div>
              </div>
              {balance.rawData && !balance.error && (
                <div className="mt-2 text-xs text-gray-400">
                  <details>
                    <summary>Raw Data (Debug)</summary>
                    <pre className="overflow-x-auto bg-gray-900 p-2 rounded mt-1">
                      {JSON.stringify(balance.rawData, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Debug Info Card */}
      <details className="mt-6">
        <summary className="text-sm text-gray-500 cursor-pointer hover:text-white">Debug Info</summary>
        <div className="mt-2 p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
          <h4 className="text-sm font-medium text-white mb-2">Respostas das APIs:</h4>
          <pre className="text-xs text-gray-400 overflow-x-auto max-h-60">
            {debugInfo}
          </pre>
        </div>
      </details>
    </div>
  );
} 