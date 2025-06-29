"use client";
import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import { Play, RefreshCw, AlertTriangle, CheckCircle2, Clock, Plus, Trash2 } from 'lucide-react'; // Ícones
import { useArbitrageWebSocket } from './useArbitrageWebSocket';
import MaxSpreadCell from './MaxSpreadCell'; // Importar o novo componente
import React from 'react';
import Decimal from 'decimal.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const EXCHANGES = [
  { value: "gateio", label: "Gate.io" },
  { value: "mexc", label: "MEXC" },
];

// Lista de pares será carregada dinamicamente
const DEFAULT_PAIRS = [
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
const OpportunityRow = React.memo(({ opportunity, livePrices, formatPrice, getSpreadDisplayClass, calcularLucro, handleCadastrarPosicao }: any) => {
    
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
                onClick={() => handleCadastrarPosicao(opportunity)}
                className="flex items-center justify-center bg-custom-cyan hover:bg-custom-cyan/90 text-black font-bold py-2 px-3 rounded-md transition-colors text-sm gap-1"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Cadastrar</span>
              </button>
            </td>

        </tr>
    );
});
OpportunityRow.displayName = 'OpportunityRow';

// Nova interface para posições
interface Position {
  id: string;
  symbol: string;
  quantity: number;
  spotEntry: number;
  futuresEntry: number;
  spotExchange: string;
  futuresExchange: string;
  createdAt: Date | string; // Pode vir como string do banco de dados
}

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
  
  // Estados para posições com persistência no banco de dados
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);
  
  // Estados para o modal de cadastro de posição
  const [isPositionModalOpen, setIsPositionModalOpen] = useState(false);
  const [newPosition, setNewPosition] = useState({
    symbol: '',
    quantity: 0,
    spotEntry: 0,
    futuresEntry: 0,
    spotExchange: 'gateio',
    futuresExchange: 'mexc'
  });

  // Carregar posições do banco de dados na inicialização
  useEffect(() => {
    const loadPositions = async () => {
      setIsLoadingPositions(true);
      try {
        const response = await fetch('/api/positions');
        if (response.ok) {
          const savedPositions = await response.json();
          setPositions(savedPositions);
        } else {
          console.error('Erro ao carregar posições do banco de dados');
          // Fallback para localStorage se a API falhar
          const localPositions = localStorage.getItem('arbitrage-positions');
          if (localPositions) {
            const parsedPositions = JSON.parse(localPositions);
            setPositions(parsedPositions);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar posições:', error);
        // Fallback para localStorage se a API falhar
        const localPositions = localStorage.getItem('arbitrage-positions');
        if (localPositions) {
          try {
            const parsedPositions = JSON.parse(localPositions);
            setPositions(parsedPositions);
          } catch (parseError) {
            console.error('Erro ao parsear posições do localStorage:', parseError);
          }
        }
      } finally {
        setIsLoadingPositions(false);
      }
    };

    loadPositions();
  }, []);
  

  
  // 1. Obter livePrices do hook
  const { opportunities: opportunitiesRaw, livePrices } = useArbitrageWebSocket();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [successMessage, setSuccessMessage] = useState<string|null>(null);

  function calcularLucro(spreadValue: number) { 
    return ((spreadValue / 100) * amount).toFixed(2);
  }
  


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



  // Função para remover posição
  const handleRemovePosition = async (positionId: string) => {
    try {
      const response = await fetch(`/api/positions?id=${positionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setPositions(prev => prev.filter(p => p.id !== positionId));
        setSuccessMessage('Posição removida com sucesso!');
      } else {
        // Fallback para remoção local
        setPositions(prev => prev.filter(p => p.id !== positionId));
        const updatedPositions = positions.filter(p => p.id !== positionId);
        localStorage.setItem('arbitrage-positions', JSON.stringify(updatedPositions));
        setSuccessMessage('Posição removida localmente!');
      }
    } catch (error) {
      console.error('Erro ao remover posição:', error);
      // Fallback para remoção local
      setPositions(prev => prev.filter(p => p.id !== positionId));
      const updatedPositions = positions.filter(p => p.id !== positionId);
      localStorage.setItem('arbitrage-positions', JSON.stringify(updatedPositions));
      setSuccessMessage('Posição removida localmente!');
    } finally {
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  // Função para finalizar posição
  const handleFinalizePosition = async (positionId: string) => {
    const position = positions.find(p => p.id === positionId);
    if (position) {
      await handleRemovePosition(positionId);
      setSuccessMessage(`Posição ${position.symbol} finalizada com sucesso!`);
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  };

  // Função para abrir o modal de cadastro com dados da oportunidade
  const handleCadastrarPosicao = (opportunity: Opportunity) => {
    // Determinar exchanges baseado no tipo de oportunidade
    const spotExchange = opportunity.compraExchange.toLowerCase().includes('gate') ? 'gateio' : 'mexc';
    const futuresExchange = opportunity.vendaExchange.toLowerCase().includes('mexc') ? 'mexc' : 'gateio';
    
    setNewPosition({
      symbol: opportunity.symbol,
      quantity: 0,
      spotEntry: opportunity.compraPreco,
      futuresEntry: opportunity.vendaPreco,
      spotExchange: spotExchange,
      futuresExchange: futuresExchange
    });
    setIsPositionModalOpen(true);
  };

  // Função para adicionar nova posição
  const handleAddPosition = async () => {
    if (!newPosition.symbol || newPosition.spotEntry <= 0 || newPosition.futuresEntry <= 0 || newPosition.quantity <= 0) {
      setError('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    setIsLoading(true);
    try {
      const positionData = {
        symbol: newPosition.symbol,
        quantity: newPosition.quantity,
        spotEntry: newPosition.spotEntry,
        futuresEntry: newPosition.futuresEntry,
        spotExchange: newPosition.spotExchange,
        futuresExchange: newPosition.futuresExchange
      };

      const response = await fetch('/api/positions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(positionData),
      });

      if (response.ok) {
        const newPositionFromServer = await response.json();
        setPositions(prev => [...prev, newPositionFromServer]);
        setSuccessMessage('Posição cadastrada com sucesso!');
        setIsPositionModalOpen(false);
        
        // Reset form
        setNewPosition({
          symbol: '',
          quantity: 0,
          spotEntry: 0,
          futuresEntry: 0,
          spotExchange: 'gateio',
          futuresExchange: 'mexc'
        });
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Erro ao cadastrar posição');
      }
    } catch (error) {
      console.error('Erro ao cadastrar posição:', error);
      setError('Erro ao cadastrar posição');
    } finally {
      setIsLoading(false);
    }
  };



  // Função para calcular PnL
  // Função para normalizar o símbolo (pode haver diferenças de formato)
  const normalizeSymbol = (symbol: string) => {
    // Remove espaços e converte para o formato padrão
    return symbol.replace(/\s+/g, '').toUpperCase();
  };

  // Função auxiliar para obter preços em tempo real - usando a mesma lógica da tabela
  const getLivePriceForPosition = (position: Position, marketType: 'spot' | 'futures', side: 'buy' | 'sell' = 'buy') => {
    const symbol = position.symbol;
    
    // Tenta diferentes formatos do símbolo
    const possibleSymbols = [
      symbol,                                    // BTC/USDT
      symbol.replace('/', '_'),                  // BTC_USDT
      symbol.replace('/', ''),                   // BTCUSDT
      normalizeSymbol(symbol),                   // BTC/USDT normalizado
      normalizeSymbol(symbol.replace('/', '_')), // BTC_USDT normalizado
    ];

    let liveData = null;
    let foundSymbol = '';

    // Procura pelos diferentes formatos
    for (const testSymbol of possibleSymbols) {
      if (livePrices[testSymbol]) {
        liveData = livePrices[testSymbol];
        foundSymbol = testSymbol;
        break;
      }
    }
    
    if (!liveData) {
      return marketType === 'spot' ? position.spotEntry : position.futuresEntry;
    }

    if (liveData[marketType]) {
      const price = side === 'buy' ? liveData[marketType].bestAsk : liveData[marketType].bestBid;
      return price || (marketType === 'spot' ? position.spotEntry : position.futuresEntry);
    }
    return marketType === 'spot' ? position.spotEntry : position.futuresEntry;
  };

  // Função para obter preço atual de spot (para exibição)
  const getCurrentSpotPrice = (position: Position) => {
    // Para spot, queremos o preço médio (ou bestBid para mostrar preço de venda)
    return getLivePriceForPosition(position, 'spot', 'sell');
  };

  // Função para obter preço atual de futures (para exibição)
  const getCurrentFuturesPrice = (position: Position) => {
    // Para futures, queremos o preço médio (ou bestAsk para mostrar preço de compra para fechar short)
    return getLivePriceForPosition(position, 'futures', 'buy');
  };

  const calculatePnL = (position: Position) => {
    const currentSpotPrice = getCurrentSpotPrice(position);
    const currentFuturesPrice = getCurrentFuturesPrice(position);

    // Implementação das fórmulas específicas solicitadas:
    // pnlSpot = ((precoAtualSpot - precoEntradaSpot) / precoEntradaSpot) * 100
    // pnlFutures = ((precoEntradaFutures - precoAtualFutures) / precoEntradaFutures) * 100
    // pnlPercent = pnlSpot + pnlFutures
    
    const pnlSpot = position.spotEntry > 0 ? ((currentSpotPrice - position.spotEntry) / position.spotEntry) * 100 : 0;
    const pnlFutures = position.futuresEntry > 0 ? ((position.futuresEntry - currentFuturesPrice) / position.futuresEntry) * 100 : 0;
    const pnlPercent = pnlSpot + pnlFutures;

    // Calcular PnL total em valor absoluto para exibição
    const spotPnL = (currentSpotPrice - position.spotEntry) * position.quantity;
    const futuresPnL = (position.futuresEntry - currentFuturesPrice) * position.quantity;
    const totalPnL = spotPnL + futuresPnL;



    return { totalPnL, pnlPercent, currentSpotPrice, currentFuturesPrice };
  };



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
                <tr><td colSpan={6} className="text-center py-8"><RefreshCw className="h-6 w-6 animate-spin inline-block mr-2" />Carregando oportunidades...</td></tr>
              ) : rankedOpportunities.length === 0 && !error ? (
                <tr><td colSpan={6} className="text-center text-gray-400 py-8">Nenhuma oportunidade encontrada para os filtros selecionados.</td></tr>
              ) : (
                rankedOpportunities.map((opportunity) => (
                  <OpportunityRow 
                    key={`${opportunity.symbol}-${opportunity.directionApi}`} 
                    opportunity={opportunity}
                    livePrices={livePrices}
                    formatPrice={formatPrice}
                    getSpreadDisplayClass={getSpreadDisplayClass}
                    calcularLucro={calcularLucro}
                    handleCadastrarPosicao={handleCadastrarPosicao}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>



      {/* Seção de Posições Abertas */}
      {(positions.length > 0 || isLoadingPositions) && (
        <div className="bg-dark-card p-6 rounded-lg shadow">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-white">Posições Abertas</h2>
          </div>

          {isLoadingPositions ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span className="text-gray-400">Carregando posições...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {positions.map((position) => {
              const { totalPnL, pnlPercent, currentSpotPrice, currentFuturesPrice } = calculatePnL(position);
              const entrySpread = ((position.futuresEntry - position.spotEntry) / position.spotEntry) * 100;
              const currentSpread = ((currentFuturesPrice - currentSpotPrice) / currentSpotPrice) * 100;

              // Função para mapear exchange para nome de exibição
              const getExchangeDisplayName = (exchange: string, marketType: 'spot' | 'futures') => {
                const exchangeMap: { [key: string]: string } = {
                  'gateio': 'Gate.io',
                  'mexc': 'MEXC'
                };
                const baseName = exchangeMap[exchange] || exchange;
                return `${baseName} (${marketType})`;
              };

              return (
                <div key={position.id} className="bg-gray-800 p-4 rounded-lg border border-gray-700 relative">
                  {/* Header com símbolo e botão de lixeira */}
                  <div className="flex justify-between items-center mb-3">
                    <div className="text-left">
                      <h3 className="text-lg font-bold text-white">{position.symbol}</h3>
                      <p className="text-xs text-gray-400">Spot vs Futures</p>
                    </div>
                    <button
                      onClick={() => handleRemovePosition(position.id)}
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Quantidade-Aporte - alinhado à direita */}
                  <div className="text-right mb-3">
                    <p className="text-xs text-custom-cyan font-medium">Quantidade-Aporte</p>
                    <p className="text-sm font-bold text-custom-cyan">{position.quantity.toFixed(3)} {position.symbol.split('/')[0]}</p>
                  </div>

                  {/* Preços de Entrada - alinhados à esquerda */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="text-left">
                      <p className="text-xs text-gray-400">{getExchangeDisplayName(position.spotExchange, 'spot')}</p>
                      <p className="text-xs font-bold text-white">{formatPrice(position.spotEntry)}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-xs text-gray-400">{getExchangeDisplayName(position.futuresExchange, 'futures')}</p>
                      <p className="text-xs font-bold text-white">{formatPrice(position.futuresEntry)}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-xs text-gray-400">Spread</p>
                      <p className={`text-xs font-bold ${entrySpread >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {entrySpread.toFixed(2)}%
                      </p>
                    </div>
                  </div>

                  {/* Preços Atuais - alinhados à esquerda */}
                  <div className="grid grid-cols-2 gap-2 mb-3 py-2 border-t border-gray-600">
                    <div className="text-left">
                      <p className="text-xs text-gray-400">Preço atual-Spot</p>
                      <p className="text-xs font-bold text-white">{formatPrice(currentSpotPrice)}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-xs text-gray-400">Preço atual-Futures</p>
                      <p className="text-xs font-bold text-white">{formatPrice(currentFuturesPrice)}</p>
                    </div>
                  </div>

                  {/* PnL - alinhados à esquerda */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="text-left">
                      <p className="text-xs text-gray-400">TotalPnL</p>
                      <p className={`text-sm font-bold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(2)}
                      </p>
                    </div>
                    <div className="text-left">
                      <p className="text-xs text-gray-400">pnlPercent</p>
                      <p className={`text-sm font-bold ${pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                      </p>
                    </div>
                  </div>

                  {/* Botão Finalizar */}
                  <div className="pt-2 border-t border-gray-600">
                    <button
                      onClick={() => handleFinalizePosition(position.id)}
                      className="w-full py-2 bg-custom-cyan hover:bg-custom-cyan/90 text-black font-bold rounded-md transition-colors text-sm"
                    >
                      Finalizar Posição
                    </button>
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </div>
      )}

      {/* Modal de Cadastro de Posição */}
      <Dialog open={isPositionModalOpen} onOpenChange={setIsPositionModalOpen}>
        <DialogContent className="max-w-2xl bg-gray-900 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Cadastro de Posição</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Posição Spot */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Posição Spot</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Exchange</label>
                  <select
                    value={newPosition.spotExchange}
                    onChange={(e) => setNewPosition(prev => ({ ...prev, spotExchange: e.target.value }))}
                    className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-custom-cyan focus:border-custom-cyan"
                  >
                    {EXCHANGES.map(ex => (
                      <option key={ex.value} value={ex.value}>{ex.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Símbolo</label>
                  <input
                    type="text"
                    value={newPosition.symbol}
                    onChange={(e) => setNewPosition(prev => ({ ...prev, symbol: e.target.value }))}
                    className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-custom-cyan focus:border-custom-cyan"
                    placeholder="Ex: BTC/USDT"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Preço de Entrada</label>
                  <input
                    type="number"
                    step="0.00000001"
                    min="0"
                    value={newPosition.spotEntry}
                    onChange={(e) => setNewPosition(prev => ({ ...prev, spotEntry: Number(e.target.value) }))}
                    className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-custom-cyan focus:border-custom-cyan"
                    placeholder="Preço de entrada spot"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Quantidade</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={newPosition.quantity}
                    onChange={(e) => setNewPosition(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                    className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-custom-cyan focus:border-custom-cyan"
                    placeholder="Quantidade a operar"
                  />
                </div>
              </div>
            </div>

            {/* Posição Futures */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Posição Futures</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Exchange</label>
                  <select
                    value={newPosition.futuresExchange}
                    onChange={(e) => setNewPosition(prev => ({ ...prev, futuresExchange: e.target.value }))}
                    className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-custom-cyan focus:border-custom-cyan"
                  >
                    {EXCHANGES.map(ex => (
                      <option key={ex.value} value={ex.value}>{ex.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Símbolo</label>
                  <input
                    type="text"
                    value={newPosition.symbol}
                    disabled
                    className="w-full bg-gray-600 border-gray-600 text-gray-400 rounded-md p-2 cursor-not-allowed"
                    placeholder="Mesmo símbolo do spot"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Preço de Entrada</label>
                  <input
                    type="number"
                    step="0.00000001"
                    min="0"
                    value={newPosition.futuresEntry}
                    onChange={(e) => setNewPosition(prev => ({ ...prev, futuresEntry: Number(e.target.value) }))}
                    className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-custom-cyan focus:border-custom-cyan"
                    placeholder="Preço de entrada futures"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Quantidade</label>
                  <input
                    type="number"
                    value={newPosition.quantity}
                    disabled
                    className="w-full bg-gray-600 border-gray-600 text-gray-400 rounded-md p-2 cursor-not-allowed"
                    placeholder="Mesma quantidade do spot"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setIsPositionModalOpen(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddPosition}
                disabled={isLoading}
                className="px-4 py-2 bg-custom-cyan hover:bg-custom-cyan/90 text-black font-bold rounded-md transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Cadastrando...' : 'Cadastrar Posição'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 