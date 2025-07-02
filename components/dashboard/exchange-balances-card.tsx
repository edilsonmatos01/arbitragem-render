'use client';

import React, { useEffect, useState } from 'react';
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

  // Configurações de todas as exchanges suportadas
  const allExchangeConfigs = [
    { name: 'Gate.io', key: 'gateio', endpoint: '/api/gateio/wallet-balance', assetField: 'currency', freeField: 'available', lockedField: 'locked' },
    { name: 'MEXC', key: 'mexc', endpoint: '/api/mexc/wallet-balance', assetField: 'asset', freeField: 'free', lockedField: 'locked' },
    { name: 'Binance', key: 'binance', endpoint: '/api/binance/wallet-balance', assetField: 'asset', freeField: 'free', lockedField: 'locked' },
    { name: 'Bybit', key: 'bybit', endpoint: '/api/bybit/wallet-balance', assetField: 'coin', freeField: 'walletBalance', lockedField: 'locked' },
    { name: 'Bitget', key: 'bitget', endpoint: '/api/bitget/wallet-balance', assetField: 'coin', freeField: 'available', lockedField: 'frozen' },
  ];

  const [exchangeConfigs, setExchangeConfigs] = useState(allExchangeConfigs.slice(0, 2)); // Iniciar apenas com Gate.io e MEXC

  // Função para carregar exchanges configuradas
  const loadConfiguredExchanges = async () => {
    try {
      const response = await fetch('/api/config/api-keys');
      if (response.ok) {
        const configuredExchanges = await response.json();
        
        // Filtrar apenas exchanges que estão configuradas e ativas
        const activeExchangeKeys = configuredExchanges
          .filter((config: any) => config.isActive)
          .map((config: any) => config.exchange);
        
        // Filtrar as configurações para incluir apenas exchanges ativas
        const activeConfigs = allExchangeConfigs.filter(config => 
          activeExchangeKeys.includes(config.key)
        );
        
        // Se não há exchanges configuradas, manter Gate.io e MEXC como padrão
        if (activeConfigs.length === 0) {
          setExchangeConfigs(allExchangeConfigs.slice(0, 2));
        } else {
          setExchangeConfigs(activeConfigs);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar exchanges configuradas:', error);
      // Em caso de erro, manter configuração padrão
      setExchangeConfigs(allExchangeConfigs.slice(0, 2));
    }
  };

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
            const lockedField = config.lockedField || 'locked';
            const lockedAmount = parseFloat((usdtEntry as any)[lockedField] || '0');
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
    const initializeComponent = async () => {
      await loadConfiguredExchanges();
      fetchBalances();
    };
    
    initializeComponent();
  }, []);

  // Recarregar saldos quando as exchanges configuradas mudarem
  useEffect(() => {
    if (exchangeConfigs.length > 0) {
      fetchBalances();
    }
  }, [exchangeConfigs]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchBalances();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {balances.map((exchange) => (
        <div key={exchange.exchange} className="bg-dark-card rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">{exchange.exchange}</h2>
            <button
              onClick={handleRefresh}
              disabled={isLoading || isRefreshing}
              className="p-2 hover:bg-dark-bg rounded-full transition-colors"
            >
              {isRefreshing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
              )}
            </button>
          </div>

          {exchange.error ? (
            <div className="text-red-500 mb-4">{exchange.error}</div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-dark-bg rounded-lg">
                <div className="flex items-center">
                  <span className="text-lg font-medium">USDT</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold">{exchange.balance}</div>
                  <div className="text-sm text-gray-400">Disponível</div>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
} 