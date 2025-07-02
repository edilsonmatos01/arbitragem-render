'use client';

import React, { useEffect, useState } from 'react';
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

interface ConfiguredExchange {
  id: string;
  exchange: string;
  isActive: boolean;
}

interface ExchangeEndpoint {
  name: string;
  key: string;
  endpoints: string[];
}

export default function TotalBalanceCard() {
  const [totalBalance, setTotalBalance] = useState<string>('0.00');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeExchanges, setActiveExchanges] = useState<string[]>([]);
  const [exchangeDetails, setExchangeDetails] = useState<{[key: string]: number}>({});

  // Mapa completo de todas as exchanges e seus endpoints
  const exchangeEndpointMap: { [key: string]: ExchangeEndpoint } = {
    'gateio': { name: 'Gate.io', key: 'gateio', endpoints: ['/api/gateio/wallet-balance', '/api/gateio-futures'] },
    'mexc': { name: 'MEXC', key: 'mexc', endpoints: ['/api/mexc/wallet-balance', '/api/mexc-futures'] },
    'binance': { name: 'Binance', key: 'binance', endpoints: ['/api/binance/wallet-balance'] },
    'bybit': { name: 'Bybit', key: 'bybit', endpoints: ['/api/bybit/wallet-balance'] },
    'bitget': { name: 'Bitget', key: 'bitget', endpoints: ['/api/bitget/wallet-balance'] },
  };

  // Função para extrair saldo USDT de qualquer resposta da API
  const extractUsdtBalance = (data: any): number => {
    console.log('🔍 Analisando dados:', data);
    
    // Formato futures com balances.USDT.total (MEXC Futures)
    if (data.balances && typeof data.balances === 'object' && data.balances.USDT) {
      const usdtData = data.balances.USDT;
      if (usdtData.total !== undefined) {
        const balance = parseFloat(usdtData.total.toString());
        console.log('📊 Formato futures detectado - USDT:', balance);
        return balance;
      }
    }
    
    // Formato array de balances (Spot APIs)
    if (data.balances && Array.isArray(data.balances)) {
      const usdtEntry = data.balances.find((item: any) => 
        item.currency === 'USDT' || item.asset === 'USDT' || item.coin === 'USDT'
      );
      
      if (usdtEntry) {
        let balance = 0;
        
        // Gate.io: available + locked
        if (usdtEntry.available !== undefined) {
          balance = parseFloat(usdtEntry.available) + parseFloat(usdtEntry.locked || '0');
        }
        // Binance/MEXC: free + locked
        else if (usdtEntry.free !== undefined) {
          balance = parseFloat(usdtEntry.free) + parseFloat(usdtEntry.locked || '0');
        }
        // Bybit: walletBalance
        else if (usdtEntry.walletBalance !== undefined) {
          balance = parseFloat(usdtEntry.walletBalance);
        }
        
        console.log('📊 Formato spot detectado - USDT:', balance);
        return balance;
      }
    }
    
    // Formato especial Bybit
    if (data.result && data.result.list && Array.isArray(data.result.list)) {
      for (const account of data.result.list) {
        if (account.coin && Array.isArray(account.coin)) {
          const usdtCoin = account.coin.find((coin: any) => coin.coin === 'USDT');
          if (usdtCoin && usdtCoin.walletBalance) {
            const balance = parseFloat(usdtCoin.walletBalance);
            console.log('📊 Formato Bybit detectado - USDT:', balance);
            return balance;
          }
        }
      }
    }
    
    console.log('⚠️ Nenhum saldo USDT encontrado nos dados');
    return 0;
  };

  // Função para carregar configurações das exchanges
  const loadActiveExchanges = async (): Promise<string[]> => {
    try {
      console.log('🔍 Carregando configurações de exchanges...');
      
      const response = await fetch('/api/config/api-keys');
      if (!response.ok) {
        console.error('❌ Erro ao buscar configurações:', response.status);
        throw new Error(`Erro na API: ${response.status}`);
      }

      const configs: ConfiguredExchange[] = await response.json();
      console.log('📋 Configurações recebidas:', configs);

      if (!Array.isArray(configs) || configs.length === 0) {
        console.log('⚠️ Nenhuma configuração encontrada, usando fallback');
        return Object.keys(exchangeEndpointMap); // Usar todas as exchanges como fallback
      }

      const activeKeys = configs
        .filter(config => config.isActive === true)
        .map(config => config.exchange);

      console.log('✅ Exchanges ativas:', activeKeys);
      
      if (activeKeys.length === 0) {
        console.log('⚠️ Nenhuma exchange ativa, usando fallback');
        return Object.keys(exchangeEndpointMap);
      }

      return activeKeys;
    } catch (error) {
      console.error('❌ Erro ao carregar exchanges:', error);
      // Fallback: usar todas as exchanges
      return Object.keys(exchangeEndpointMap);
    }
  };

  // Função para buscar saldo de um endpoint específico
  const fetchEndpointBalance = async (endpoint: string, exchangeName: string): Promise<number> => {
    try {
      console.log(`🌐 Buscando saldo de ${exchangeName} em ${endpoint}...`);
      
      const response = await fetch(endpoint);
      if (!response.ok) {
        console.error(`❌ Erro ${response.status} em ${endpoint}`);
        return 0;
      }

      const data = await response.json();
      const balance = extractUsdtBalance(data);
      
      console.log(`💰 ${exchangeName} (${endpoint}): $${balance.toFixed(2)}`);
      return balance;
      
    } catch (error) {
      console.error(`❌ Erro ao buscar ${endpoint}:`, error);
      return 0;
    }
  };

  // Função para buscar saldos de todas as exchanges
  const fetchAllBalances = async () => {
    if (!isRefreshing) {
      setIsLoading(true);
    }
    setError(null);

    try {
      console.log('🚀 Iniciando busca de saldos...');
      
      // Carregar exchanges ativas
      const activeKeys = await loadActiveExchanges();
      setActiveExchanges(activeKeys);
      
      let grandTotal = 0;
      const details: {[key: string]: number} = {};

      // Processar cada exchange ativa
      for (const exchangeKey of activeKeys) {
        const exchangeConfig = exchangeEndpointMap[exchangeKey];
        if (!exchangeConfig) {
          console.warn(`⚠️ Exchange ${exchangeKey} não encontrada no mapa`);
          continue;
        }

        let exchangeTotal = 0;

        // Buscar saldo de todos os endpoints da exchange
        for (const endpoint of exchangeConfig.endpoints) {
          const endpointBalance = await fetchEndpointBalance(endpoint, exchangeConfig.name);
          exchangeTotal += endpointBalance;
        }

        details[exchangeConfig.name] = exchangeTotal;
        grandTotal += exchangeTotal;
        
        console.log(`🏦 Total ${exchangeConfig.name}: $${exchangeTotal.toFixed(2)}`);
      }

      setExchangeDetails(details);
      setTotalBalance(grandTotal.toFixed(2));
      
      console.log('💎 SALDO TOTAL FINAL:', `$${grandTotal.toFixed(2)}`);
      console.log('📊 Detalhamento por exchange:', details);

      if (grandTotal === 0) {
        setError('Nenhum saldo USDT encontrado nas exchanges configuradas');
      }

    } catch (error) {
      console.error('❌ Erro global ao buscar saldos:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Effect para inicializar o componente
  useEffect(() => {
    console.log('🎯 TotalBalanceCard montado - iniciando carregamento');
    fetchAllBalances();
  }, []);

  // Função para refresh manual
  const handleRefresh = () => {
    console.log('🔄 Refresh manual iniciado');
    setIsRefreshing(true);
    fetchAllBalances();
  };

  return (
    <div className="bg-dark-card p-6 rounded-lg shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-medium text-white">Saldo Total Exchanges</h3>
          <p className="text-sm text-gray-400">
            {activeExchanges.length > 0 
              ? `${activeExchanges.length} exchange${activeExchanges.length !== 1 ? 's' : ''} configurada${activeExchanges.length !== 1 ? 's' : ''} (Spot + Futures)`
              : 'Carregando configurações...'
            }
          </p>
          {Object.keys(exchangeDetails).length > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              {Object.entries(exchangeDetails)
                .filter(([_, value]) => value > 0)
                .map(([name, value]) => `${name}: $${value.toFixed(2)}`)
                .join(' | ')
              }
            </div>
          )}
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
            <span className="text-sm text-gray-400">Carregando saldos...</span>
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