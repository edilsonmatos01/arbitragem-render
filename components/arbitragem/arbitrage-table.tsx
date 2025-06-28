"use client";
import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import { Play, RefreshCw, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'; // Ícones
import { useArbitrageWebSocket } from './useArbitrageWebSocket';
import MaxSpreadCell from './MaxSpreadCell'; // Importar o novo componente
import React from 'react';
import Decimal from 'decimal.js';

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
  symbol: string;
  compraExchange: string;
  vendaExchange: string;
  compraPreco: number;
  vendaPreco: number;
  spread: number;
  status?: string;
  tipo: 'intra' | 'inter';
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
const OpportunityRow = React.memo(({ opportunity, livePrices, formatPrice, getSpreadDisplayClass, calcularLucro, handleExecuteArbitrage }: any) => {
    
    // ✅ 4. Na renderização de cada linha da tabela, ao exibir os preços:
    const getLivePrice = (originalPrice: number, marketTypeStr: string, side: 'buy' | 'sell') => {
        const liveData = livePrices[opportunity.symbol];
        if (!liveData) return originalPrice;

        const marketType = marketTypeStr.toLowerCase().includes('spot') ? 'spot' : 'futures';
        
        if (liveData[marketType]) {
            const price = side === 'buy' ? liveData[marketType].bestAsk : liveData[marketType].bestBid;
            return price;
        }
        return originalPrice;
    };

    // Obtém os preços sem formatação para o cálculo
    const rawCompraPreco = getLivePrice(opportunity.compraPreco, opportunity.compraExchange, 'buy');
    const rawVendaPreco = getLivePrice(opportunity.vendaPreco, opportunity.vendaExchange, 'sell');

    // Calcula o spread usando Decimal.js para máxima precisão
    const spreadValue = new Decimal(rawVendaPreco)
        .minus(new Decimal(rawCompraPreco))
        .dividedBy(new Decimal(rawCompraPreco))
        .times(100)
        .toNumber();

    // Não renderiza a linha se o spread for negativo ou zero
    if (spreadValue <= 0) {
        return null;
    }

    // Formata os preços apenas para exibição
    const displayCompraPreco = formatPrice(rawCompraPreco);
    const displayVendaPreco = formatPrice(rawVendaPreco);

    return (
        <tr className="border-b border-gray-700 hover:bg-gray-800">
            <td className="py-4 px-6 whitespace-nowrap text-sm font-semibold">{opportunity.symbol}</td>
            <td className="py-4 px-6 whitespace-nowrap text-sm">{opportunity.compraExchange} <br /> <span className="font-bold">{displayCompraPreco}</span></td>
            <td className="py-4 px-6 whitespace-nowrap text-sm">{opportunity.vendaExchange} <br /> <span className="font-bold">{displayVendaPreco}</span></td>
            <td className={`py-4 px-6 whitespace-nowrap text-sm font-bold ${getSpreadDisplayClass(spreadValue)}`}>
              {new Decimal(spreadValue).toFixed(2)}%
            </td>
            <td className="py-4 px-6 whitespace-nowrap text-sm">
              <MaxSpreadCell symbol={opportunity.symbol} />
            </td>
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
  const [isPaused, setIsPaused] = useState(false); // Inicia com busca ativa

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
    console.log("Executar arbitragem:", opportunity);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const directionOptions = [
    { value: 'ALL', label: 'Todas as Direções' },
    { value: 'SPOT_TO_FUTURES', label: 'Comprar Spot / Vender Futuros (Spot < Futuros)' },
    { value: 'FUTURES_TO_SPOT', label: 'Vender Spot / Comprar Futuros (Spot > Futuros)' },
  ];
  
  const formatPrice = (price: number) => {
    try {
      const decimalPrice = new Decimal(price);
      
      if (decimalPrice.isZero()) return '0.00';
      
      // Para preços menores que 1, mantém mais casas decimais
      if (decimalPrice.abs().lessThan(1)) {
        return decimalPrice.toFixed(8).replace(/\.?0+$/, '');
      }
      
      // Para preços maiores que 1, usa 2 casas decimais
      return decimalPrice.toFixed(2);
    } catch (error) {
      console.error('Erro ao formatar preço:', error);
      return '0.00';
    }
  };

  const getSpreadDisplayClass = (spreadValue: number): string => {
    // Todos os spreads aqui já são positivos
    if (spreadValue > 1) {
      return 'text-green-400 font-bold'; // Spread alto - muito lucrativo
    } else if (spreadValue > 0.5) {
      return 'text-green-400'; // Spread médio - lucrativo
    } else {
      return 'text-yellow-400'; // Spread baixo - pouco lucrativo
    }
  };

  // Lógica de Ranking Dinâmico
  useEffect(() => {
    console.log('[DEBUG] useEffect executado - isPaused:', isPaused, 'opportunitiesRaw.length:', opportunitiesRaw.length);
    
    if (isPaused) {
      console.log('[DEBUG] ⏸️ Busca pausada - não processando oportunidades');
      return;
    }

    console.log('[DEBUG] Processando oportunidades recebidas:', opportunitiesRaw);

    // 1. Mapeia as novas oportunidades recebidas do WebSocket
    const newOpportunities = opportunitiesRaw
      .map((opp): Opportunity | null => {
        if (!opp.buyAt || !opp.sellAt || opp.buyAt.price <= 0 || opp.sellAt.price <= 0) {
          console.log('[DEBUG] Oportunidade ignorada por preços inválidos:', opp);
          return null;
        }

        // Calcula o spread usando a fórmula correta: ((Futures - Spot) / Spot) × 100
        const spread = ((opp.sellAt.price - opp.buyAt.price) / opp.buyAt.price) * 100;
        
        // Ignora spreads negativos já no mapeamento inicial
        if (spread <= 0) {
          console.log(`[DEBUG] Oportunidade ignorada por spread negativo ou zero: ${opp.baseSymbol} (${spread.toFixed(2)}%)`);
          return null;
        }
        
        console.log(`[DEBUG] Spread calculado para ${opp.baseSymbol}: ${spread.toFixed(2)}%`);

        const newOpp: Opportunity = {
          symbol: opp.baseSymbol,
          compraExchange: opp.buyAt.exchange,
          compraPreco: opp.buyAt.price,
          vendaExchange: opp.sellAt.exchange,
          vendaPreco: opp.sellAt.price,
          spread: spread,
          tipo: 'inter', // Como estamos lidando com arbitragem entre exchanges (Gate.io e MEXC)
          directionApi: opp.arbitrageType.includes('spot_to_futures') ? 'SPOT_TO_FUTURES' : 'FUTURES_TO_SPOT',
          maxSpread24h: null
        };

        console.log('[DEBUG] ✅ Nova oportunidade processada:', {
          symbol: newOpp.symbol,
          tipo: newOpp.tipo,
          directionApi: newOpp.directionApi,
          compraExchange: newOpp.compraExchange,
          vendaExchange: newOpp.vendaExchange,
          spread: newOpp.spread,
          arbitrageTypeOriginal: opp.arbitrageType
        });
        return newOpp;
      })
      .filter((o): o is Opportunity => o !== null);

    console.log('[DEBUG] Total de novas oportunidades válidas:', newOpportunities.length);

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
          if (opp.spread > (existing.spread || 0)) {
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
          const passesSpreadFilter = o.spread >= minSpread; // Removido Math.abs pois já filtramos negativos
          const passesDirectionFilter = direction === 'ALL' || o.directionApi === direction;
          const passesTypeFilter = o.tipo === arbitrageType;
          let passesExchangeFilter = true;

          // Verifica se a operação é compra em spot e venda em futures
          // Aceita qualquer combinação de Gate.io (Spot) comprando e MEXC (Futures) vendendo
          const isSpotBuyFuturesSell = (o.compraExchange.toLowerCase().includes('spot') || 
                                       o.compraExchange.toLowerCase().includes('gate.io')) && 
                                      (o.vendaExchange.toLowerCase().includes('futures') ||
                                       o.vendaExchange.toLowerCase().includes('mexc'));
          passesExchangeFilter = isSpotBuyFuturesSell;

          const passes = passesSpreadFilter && passesDirectionFilter && passesTypeFilter && passesExchangeFilter;
          
          if (!passes) {
            console.log(`[DEBUG] ❌ Oportunidade filtrada - ${o.symbol}:`, {
              spread: passesSpreadFilter,
              direction: passesDirectionFilter,
              type: passesTypeFilter,
              exchange: passesExchangeFilter,
              isSpotBuyFuturesSell,
              compraExchange: o.compraExchange,
              vendaExchange: o.vendaExchange,
              spreadValue: o.spread,
              minSpreadRequired: minSpread,
              directionRequired: direction,
              arbitrageTypeRequired: arbitrageType
            });
          } else {
            console.log(`[DEBUG] ✅ Oportunidade passou pelos filtros - ${o.symbol}:`, {
              spread: o.spread,
              tipo: o.tipo,
              direction: o.directionApi,
              compraExchange: o.compraExchange,
              vendaExchange: o.vendaExchange
            });
          }

          return passes;
        })
        .sort((a, b) => b.spread - a.spread) // Ordenação direta pois todos são positivos
        .slice(0, 8);

      console.log('[DEBUG] Oportunidades finais após filtros:', finalOpportunities);
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
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Par</th>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Compra</th>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Venda</th>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Spread %</th>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Spread Máximo (24h)</th>
                <th className="py-3 px-6 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Ações</th>
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