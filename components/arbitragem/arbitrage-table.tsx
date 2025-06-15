"use client";
import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import { Play, RefreshCw, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'; // Ícones
import { useArbitrageWebSocket } from './useArbitrageWebSocket';
import MaxSpreadCell from './MaxSpreadCell'; // Importar o novo componente
import React from 'react';

const EXCHANGES = [
  { value: "gateio", label: "Gate.io" },
  { value: "mexc", label: "MEXC" },
];

const PAIRS = [
  "BTC/USDT", "ETH/USDT", "BNB/USDT", "SOL/USDT", "XRP/USDT", "ADA/USDT", "AVAX/USDT", "DOT/USDT", "TRX/USDT", "LTC/USDT",
  "MATIC/USDT", "LINK/USDT", "ATOM/USDT", "NEAR/USDT", "FIL/USDT", "AAVE/USDT", "UNI/USDT", "FTM/USDT", "INJ/USDT", "RNDR/USDT",
  "ARB/USDT", "OP/USDT", "SUI/USDT", "LDO/USDT", "DYDX/USDT", "GRT/USDT", "1INCH/USDT",
  "APE/USDT", "GMT/USDT", "FLOW/USDT", "PEPE/USDT", "FLOKI/USDT", "BONK/USDT",
  "DOGE/USDT", "SHIB/USDT", "WIF/USDT", "TURBO/USDT", "1000SATS/USDT",
  "TON/USDT", "APT/USDT", "SEI/USDT"
];

interface OpportunityFromAPI { // Interface para dados crus da API (intra-exchange)
  symbol: string;
  spotPrice: string;
  futuresPrice: string;
  direction: 'FUTURES_TO_SPOT' | 'SPOT_TO_FUTURES';
  fundingRate: string;
  percentDiff: string; // Isso é o spread bruto da API
}

interface InterExchangeOpportunityFromAPI { // Interface para dados crus da API (inter-exchange)
  symbol: string; // Espera-se que seja o par completo, ex: BTC/USDT
  spotExchange: string;
  futuresExchange: string;
  spotPrice: string;
  futuresPrice: string;
  direction: 'FUTURES_TO_SPOT' | 'SPOT_TO_FUTURES';
  fundingRate: string;
  percentDiff: string;
}

// Interface para as oportunidades formatadas para a tabela
interface Opportunity {
  symbol: string; // Par (ex: BTC/USDT)
  compraExchange: string;
  vendaExchange: string;
  compraPreco: number;
  vendaPreco: number;
  spread: number; // Em porcentagem, ex: 0.5 para 0.5%
  lucroEstimado?: string; // Calculado no frontend
  status?: string; // Calculado no frontend (ex: 'available')
  tipo: 'intra' | 'inter';
  // Campos adicionais para manter consistência ou para lógica futura
  directionApi?: 'FUTURES_TO_SPOT' | 'SPOT_TO_FUTURES';
  fundingRateApi?: string;
  maxSpread24h: number | null; 
}

// Função auxiliar para extrair o nome base da exchange (ex: "Gate.io (Spot)" -> "gateio")
// E para mapear a direção da API do frontend para a direção do tracker
function getTrackerParams(opportunity: Opportunity): {
  symbol: string;
  exchangeBuy: string;
  exchangeSell: string;
  direction: 'spot-to-future' | 'future-to-spot';
} | null {
  const mapApiDirectionToTracker = (apiDir: 'FUTURES_TO_SPOT' | 'SPOT_TO_FUTURES'): 'spot-to-future' | 'future-to-spot' => {
    return apiDir === 'FUTURES_TO_SPOT' ? 'spot-to-future' : 'future-to-spot';
  };

  let exBuyBase = opportunity.compraExchange.toLowerCase().split(' ')[0];
  let exSellBase = opportunity.vendaExchange.toLowerCase().split(' ')[0];

  // Para intra-exchange, o spread-tracker espera o mesmo nome de exchange para buy/sell.
  // As rotas de API intra já registram com o mesmo ID de exchange (ex: gateio, gateio).
  // O frontend para intra mostra "Gate.io (Spot)" e "Gate.io (Futuros)".
  // Precisamos garantir que para o tracker, se for intra, use o nome base da exchange.
  if (opportunity.tipo === 'intra') {
    // Remove " (Spot)" ou " (Futuros)" para obter o nome base
    const baseExchangeName = opportunity.compraExchange.replace(/ \(Spot\)| \(Futuros\)/i, '').toLowerCase();
    exBuyBase = baseExchangeName;
    exSellBase = baseExchangeName;
  }

  if (!opportunity.directionApi) return null;

  return {
    symbol: opportunity.symbol,
    exchangeBuy: exBuyBase,
    exchangeSell: exSellBase,
    direction: mapApiDirectionToTracker(opportunity.directionApi),
  };
}

const POLLING_INTERVAL_MS = 5000; // Intervalo de polling: 5 segundos

// ✅ 6. A renderização deve ser otimizada com React.memo
const OpportunityRow = React.memo(({ opportunity, livePrices, formatPrice, getSpreadDisplayClass, calcularLucro, handleExecuteArbitrage, formatSpread }: any) => {
    
    // ✅ 4. Na renderização de cada linha da tabela, ao exibir os preços:
    const getLivePrice = (originalPrice: number, marketTypeStr: string, side: 'buy' | 'sell') => {
        const liveData = livePrices[opportunity.symbol];
        if (!liveData) return originalPrice;

        const marketType = marketTypeStr.toLowerCase().includes('spot') ? 'spot' : 'futures';
        
        if (liveData[marketType]) {
            return side === 'buy' ? liveData[marketType].bestAsk : liveData[marketType].bestBid;
        }
        return originalPrice;
    };

    const compraPreco = getLivePrice(opportunity.compraPreco, opportunity.compraExchange, 'buy');
    const vendaPreco = getLivePrice(opportunity.vendaPreco, opportunity.vendaExchange, 'sell');

    return (
        <tr className="border-b border-gray-700 hover:bg-gray-800">
            <td className="py-4 px-6 whitespace-nowrap text-sm font-semibold">{opportunity.symbol}</td>
            <td className="py-4 px-6 whitespace-nowrap text-sm">{opportunity.compraExchange} <br /> <span className="font-bold">{formatPrice(compraPreco)}</span></td>
            <td className="py-4 px-6 whitespace-nowrap text-sm">{opportunity.vendaExchange} <br /> <span className="font-bold">{formatPrice(vendaPreco)}</span></td>
            <td className={`py-4 px-6 whitespace-nowrap text-sm font-bold ${getSpreadDisplayClass(opportunity.spread)}`}>
              {formatSpread(opportunity.spread)}%
            </td>
            <td className="py-4 px-6 whitespace-nowrap text-sm">
              <MaxSpreadCell symbol={opportunity.symbol} />
            </td>
            <td className="py-4 px-6 whitespace-nowrap text-sm">{calcularLucro(opportunity.spread)}</td>
            <td className="py-4 px-6 whitespace-nowrap text-center text-sm">
              <button 
                onClick={() => handleExecuteArbitrage(opportunity as Opportunity)}
                className="flex items-center justify-center bg-custom-cyan hover:bg-custom-cyan/90 text-black font-bold py-2 px-3 rounded-md transition-colors text-sm"
              >
                <Play className="h-4 w-4" />
              </button>
            </td>
        </tr>
    );
});
OpportunityRow.displayName = 'OpportunityRow';

export default function ArbitrageTable() {
  const [arbitrageType, setArbitrageType] = useState<'intra'|'inter'>('inter');
  const [direction, setDirection] = useState<'SPOT_TO_FUTURES' | 'FUTURES_TO_SPOT' | 'ALL'>('ALL');
  const [minSpread, setMinSpread] = useState(0.1);
  const [amount, setAmount] = useState(100);
  const [spotExchange, setSpotExchange] = useState('gateio');
  const [futuresExchange, setFuturesExchange] = useState('mexc');
  const [isPaused, setIsPaused] = useState(true);

  // Novo estado para o ranking dinâmico
  const [rankedOpportunities, setRankedOpportunities] = useState<Opportunity[]>([]);
  
  // 1. Obter livePrices do hook
  const { opportunities: opportunitiesRaw, livePrices } = useArbitrageWebSocket();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [successMessage, setSuccessMessage] = useState<string|null>(null);

  function calcularLucro(spreadValue: number) { 
    return ((spreadValue / 100) * amount).toFixed(2);
  }
  
  const handleExecuteArbitrage = (opportunity: Opportunity) => {
    setSuccessMessage(`Sucesso! Arbitragem para ${opportunity.symbol} (Spread: ${Math.abs(opportunity.spread).toFixed(4)}%) executada.`);
    console.log("Executar arbitragem:", opportunity, "Valor aportado:", amount);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const directionOptions = [
    { value: 'ALL', label: 'Todas as Direções' },
    { value: 'SPOT_TO_FUTURES', label: 'Comprar Spot / Vender Futuros (Spot < Futuros)' },
    { value: 'FUTURES_TO_SPOT', label: 'Vender Spot / Comprar Futuros (Spot > Futuros)' },
  ];
  
  const formatPrice = (price: number) => {
    if (price === 0) return '0.00';
    if (Math.abs(price) < 1) {
        // Para preços pequenos, mais casas decimais, evitar notação científica
        const s = price.toFixed(8);
        return s.replace(/0+$/, '').replace(/\.$/, ''); // Remove trailing zeros and trailing dot
    } 
    return price.toFixed(2); // Para preços maiores, 2 casas decimais
  };

  const getSpreadDisplayClass = (spreadValue: number): string => {
    const absSpread = Math.abs(spreadValue);
    if (absSpread > 1000) {
      return 'text-yellow-400 border border-yellow-500 p-1 rounded';
    }
    if (absSpread > 0.5) {
      return 'text-green-400';
    } else if (absSpread < 0.5) {
      return 'text-red-400';
    }
    return '';
  };

  // Função para formatar o spread com arredondamento específico para exibição
  const formatSpread = (spread: number): string => {
    // O spread já vem calculado em porcentagem e com o sinal correto
    // Vamos manter o sinal para o arredondamento
    const isNegative = spread < 0;
    const absSpread = Math.abs(spread);
    
    // Obtém as casas decimais do valor absoluto
    const decimalPart = absSpread % 1;
    const thirdDecimal = Math.floor((decimalPart * 1000) % 10);
    
    let roundedSpread: number;
    if (thirdDecimal <= 5) {
      // Se a terceira casa decimal for <= 5, trunca para duas casas
      roundedSpread = Math.floor(absSpread * 100) / 100;
    } else {
      // Se a terceira casa decimal for > 5, arredonda para cima
      roundedSpread = Math.ceil(absSpread * 100) / 100;
    }

    // Reaplica o sinal original
    return ((isNegative ? -roundedSpread : roundedSpread).toFixed(2));
  };

  // Lógica de Ranking Dinâmico
  useEffect(() => {
    if (isPaused) return;

    // 1. Mapeia as novas oportunidades recebidas do WebSocket
    const newOpportunities = opportunitiesRaw
      .map((opp): Opportunity | null => {
        // Confia nos dados do backend, sem recálculo de spread ou normalização de preços.
        if (opp.buyAt.price <= 0) return null;

        const newOpp: Opportunity = {
          symbol: opp.baseSymbol,
          compraExchange: `${opp.buyAt.exchange} (${opp.buyAt.marketType})`,
          vendaExchange: `${opp.sellAt.exchange} (${opp.sellAt.marketType})`,
          compraPreco: opp.buyAt.price,
          vendaPreco: opp.sellAt.price,
          spread: opp.profitPercentage,
          lucroEstimado: ((opp.profitPercentage / 100) * amount).toFixed(2),
          status: 'available',
          tipo: opp.buyAt.exchange !== opp.sellAt.exchange ? 'inter' : 'intra',
          directionApi: opp.arbitrageType.startsWith('spot_') ? 'SPOT_TO_FUTURES' : 'FUTURES_TO_SPOT',
          maxSpread24h: null, // Será preenchido pelo MaxSpreadCell
        };
        return newOpp;
      })
      .filter((o): o is Opportunity => o !== null);

    // 2. Funde as novas oportunidades com o ranking existente
    setRankedOpportunities(prevRanked => {
      const combined = [...prevRanked, ...newOpportunities];
      
      const opportunitiesMap = new Map<string, Opportunity>();
      for (const opp of combined) {
        const key = `${opp.symbol}-${opp.directionApi}`;
        const existing = opportunitiesMap.get(key);

        if (existing) {
          // Mantém o maior maxSpread24h entre a oportunidade existente e a nova
          opp.maxSpread24h = Math.max(existing.maxSpread24h || 0, opp.maxSpread24h || 0);
          
          // Se a nova oportunidade tiver um spread maior, ela substitui a antiga
          if (opp.spread > existing.spread) {
            opportunitiesMap.set(key, opp);
          } else {
            // Caso contrário, mantém a antiga mas atualiza seu maxSpread24h
            existing.maxSpread24h = opp.maxSpread24h;
            opportunitiesMap.set(key, existing);
          }
        } else {
            opportunitiesMap.set(key, opp);
        }
      }

      // 3. Filtra, ordena e limita a lista final
      const finalOpportunities = Array.from(opportunitiesMap.values())
        .filter(o => {
          // Re-aplica os filtros do usuário
          if (Math.abs(o.spread) < minSpread) return false;
          if (direction !== 'ALL' && direction !== o.directionApi) return false;
          if (o.tipo !== arbitrageType) return false;
          if (arbitrageType === 'inter') {
            const exchangesInvolved = [o.compraExchange.toLowerCase(), o.vendaExchange.toLowerCase()];
            const hasSpotEx = exchangesInvolved.some(ex => ex.includes(spotExchange));
            const hasFuturesEx = exchangesInvolved.some(ex => ex.includes(futuresExchange));
            if (!hasSpotEx || !hasFuturesEx) return false;
          }
          return true;
        })
        .sort((a, b) => b.spread - a.spread)
        .slice(0, 8);
      
      return finalOpportunities;
    });

  }, [
    opportunitiesRaw, 
    isPaused,
    minSpread,
    direction,
    arbitrageType,
    spotExchange,
    futuresExchange,
    amount,
  ]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-semibold text-white">Arbitragem</h1>
        </div>
        <button
          onClick={() => setIsPaused((prev) => !prev)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors ${isPaused ? 'bg-green-500 text-black hover:bg-green-400' : 'bg-red-500 text-white hover:bg-red-400'}`}
        >
          {!isPaused && <RefreshCw className="h-5 w-5 animate-spin" />}
          {isPaused ? 'Buscar Oportunidades' : 'Pausar Busca'}
        </button>
      </div>

      <div className="p-4 bg-dark-card rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label htmlFor="minSpread" className="block text-sm font-medium text-gray-300 mb-1">Spread Mínimo (%)</label>
            <input 
              id="minSpread" type="number" step="0.01" min={0} 
              className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-custom-cyan focus:border-custom-cyan"
              value={minSpread} onChange={e => setMinSpread(Number(e.target.value))} 
            />
          </div>
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-300 mb-1">Valor por Operação (USDT)</label>
            <input id="amount" type="number" step="1" min={1} 
              className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-custom-cyan focus:border-custom-cyan" 
              value={amount} onChange={e => setAmount(Number(e.target.value))} 
            />
          </div>
          <div>
            <label htmlFor="arbitrageType" className="block text-sm font-medium text-gray-300 mb-1">Tipo de Arbitragem</label>
            <select id="arbitrageType" className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-custom-cyan focus:border-custom-cyan" value={arbitrageType} onChange={e => setArbitrageType(e.target.value as 'intra'|'inter')}>
              <option value="intra">Intra-Corretora</option>
              <option value="inter">Inter-Corretoras</option>
            </select>
          </div>
          <div>
            <label htmlFor="direction" className="block text-sm font-medium text-gray-300 mb-1">Direção da Operação</label>
            <select 
                id="direction" 
                className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-custom-cyan focus:border-custom-cyan" 
                value={direction} 
                onChange={e => setDirection(e.target.value as 'SPOT_TO_FUTURES' | 'FUTURES_TO_SPOT' | 'ALL')}
            >
              {directionOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {arbitrageType === 'inter' && (
            <>
              <div className="lg:col-span-1">
                <label htmlFor="spotExchange" className="block text-sm font-medium text-gray-300 mb-1">Exchange Spot</label>
                <select id="spotExchange" className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-custom-cyan focus:border-custom-cyan" value={spotExchange} onChange={e => setSpotExchange(e.target.value)}>
                  {EXCHANGES.map(ex => <option key={ex.value} value={ex.value}>{ex.label}</option>)}
                </select>
              </div>
              <div className="lg:col-span-1">
                <label htmlFor="futuresExchange" className="block text-sm font-medium text-gray-300 mb-1">Exchange Futuros</label>
                <select id="futuresExchange" className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-custom-cyan focus:border-custom-cyan" value={futuresExchange} onChange={e => setFuturesExchange(e.target.value)}>
                  {EXCHANGES.map(ex => <option key={ex.value} value={ex.value}>{ex.label}</option>)}
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg">
          <AlertTriangle className="h-5 w-5" />
          <p>{error}</p>
        </div>
      )}
      {!error && successMessage && (
        <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg">
          <CheckCircle2 className="h-5 w-5" />
          <p>{successMessage}</p>
        </div>
      )}

      <div className="bg-dark-card p-4 rounded-lg shadow">
        <h2 className="text-xl font-semibold text-white mb-4">Oportunidades Encontradas</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-800">
              <tr>
                <th scope="col" className="py-3 px-6 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Par</th>
                <th scope="col" className="py-3 px-6 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Compra</th>
                <th scope="col" className="py-3 px-6 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Venda</th>
                <th scope="col" className="py-3 px-6 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Spread %</th>
                <th scope="col" className="py-3 px-6 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Spread Máximo (24h)</th>
                <th scope="col" className="py-3 px-6 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Lucro Estimado (USD)</th>
                <th scope="col" className="py-3 px-6 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-8"><RefreshCw className="h-6 w-6 animate-spin inline-block mr-2" />Carregando oportunidades...</td></tr>
              ) : rankedOpportunities.length === 0 && !error ? (
                <tr><td colSpan={8} className="text-center text-gray-400 py-8">Nenhuma oportunidade encontrada para os filtros selecionados.</td></tr>
              ) : (
                rankedOpportunities.map((opportunity) => (
                  <OpportunityRow 
                    key={`${opportunity.symbol}-${opportunity.directionApi}`} 
                    opportunity={opportunity}
                    livePrices={livePrices}
                    formatPrice={formatPrice}
                    getSpreadDisplayClass={getSpreadDisplayClass}
                    calcularLucro={calcularLucro}
                    handleExecuteArbitrage={handleExecuteArbitrage}
                    formatSpread={formatSpread}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 