'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { useArbitrageWebSocket } from './useArbitrageWebSocket';

interface PriceComparisonChartProps {
  symbol: string;
}

interface PriceData {
  timestamp: string;
  gateio_price: number | null;
  mexc_price: number | null;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number | null;
    dataKey: string;
    name: string;
  }>;
  label?: string;
}

const PRICE_HISTORY_LIMIT = 48; // 24 horas com intervalos de 30 minutos
const PRICE_UPDATE_INTERVAL = 30 * 60 * 1000; // 30 minutos



function formatDateTime(timestamp: string) {
  const [date, time] = timestamp.split(' - ');
  const [day, month] = date.split('/');
  return `${day}/${month} ${time}`;
}

// Componente de Tooltip customizado
const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length > 0) {
    const gateio = payload.find(p => p.dataKey === 'gateio_price');
    const mexc = payload.find(p => p.dataKey === 'mexc_price');

    return (
      <div className="p-3 bg-gray-800 border border-gray-700 rounded-md shadow-lg">
        <p className="text-white font-semibold mb-2">{`Data: ${formatDateTime(label || '')}`}</p>
        <p className="text-green-400">
          {`Gate.io (spot): $${gateio?.value?.toLocaleString('pt-BR', { minimumFractionDigits: 8 }) || 'N/D'}`}
        </p>
        <p className="text-blue-400">
          {`MEXC (futures): $${mexc?.value?.toLocaleString('pt-BR', { minimumFractionDigits: 8 }) || 'N/D'}`}
        </p>
      </div>
    );
  }
  return null;
};

export default function PriceComparisonChart({ symbol }: PriceComparisonChartProps) {
  const [data, setData] = useState<PriceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const priceHistoryRef = useRef<PriceData[]>([]);
  
  // Hook para dados WebSocket em tempo real
  const { livePrices } = useArbitrageWebSocket();

  // Função para formatar timestamp para exibição
  const formatTimestamp = (date: Date): string => {
    return date.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).replace(', ', ' - ');
  };

  // Função para arredondar para intervalos de 30 minutos
  const roundToNearestInterval = (date: Date): Date => {
    const minutes = date.getMinutes();
    const roundedMinutes = Math.floor(minutes / 30) * 30;
    const newDate = new Date(date);
    newDate.setMinutes(roundedMinutes);
    newDate.setSeconds(0);
    newDate.setMilliseconds(0);
    return newDate;
  };

  // Atualiza dados baseado nos preços WebSocket
  const updatePriceHistory = useCallback(() => {
    if (!livePrices[symbol]) {
      console.log(`[PriceChart] Aguardando dados WebSocket para ${symbol}`);
      return;
    }

    const gateioData = livePrices[symbol]['spot']; // Gate.io Spot
    const mexcData = livePrices[symbol]['futures']; // MEXC Futures

    if (!gateioData || !mexcData) {
      console.log(`[PriceChart] Dados incompletos para ${symbol}:`, {
        gateio: !!gateioData,
        mexc: !!mexcData
      });
      return;
    }

    const now = new Date();
    const roundedTime = roundToNearestInterval(now);
    const timestamp = formatTimestamp(roundedTime);

    // Calcula preço médio (bid + ask) / 2
    const gateioPrice = (gateioData.bestAsk + gateioData.bestBid) / 2;
    const mexcPrice = (mexcData.bestAsk + mexcData.bestBid) / 2;

    const newDataPoint: PriceData = {
      timestamp,
      gateio_price: gateioPrice,
      mexc_price: mexcPrice
    };

    setData(prevData => {
      // Remove pontos com o mesmo timestamp para evitar duplicatas
      const filteredData = prevData.filter(d => d.timestamp !== timestamp);
      
      // Adiciona novo ponto e mantém apenas os últimos 48 pontos (24h)
      const updatedData = [...filteredData, newDataPoint]
        .sort((a, b) => {
          const [dateA, timeA] = a.timestamp.split(' - ');
          const [dateB, timeB] = b.timestamp.split(' - ');
          const [dayA, monthA] = dateA.split('/').map(Number);
          const [dayB, monthB] = dateB.split('/').map(Number);
          const [hourA, minuteA] = timeA.split(':').map(Number);
          const [hourB, minuteB] = timeB.split(':').map(Number);
          
          if (monthA !== monthB) return monthA - monthB;
          if (dayA !== dayB) return dayA - dayB;
          if (hourA !== hourB) return hourA - hourB;
          return minuteA - minuteB;
        })
        .slice(-PRICE_HISTORY_LIMIT);

      return updatedData;
    });

    setLastUpdate(now);
    setLoading(false);
    setError(null);

    console.log(`[PriceChart] Dados atualizados para ${symbol}:`, {
      timestamp,
      gateio_price: gateioPrice.toFixed(8),
      mexc_price: mexcPrice.toFixed(8)
    });
  }, [symbol, livePrices]);

  // Atualiza dados quando recebe novos preços WebSocket
  useEffect(() => {
    updatePriceHistory();
  }, [updatePriceHistory]);

  // Atualiza dados em intervalos regulares
  useEffect(() => {
    const interval = setInterval(updatePriceHistory, PRICE_UPDATE_INTERVAL);
    return () => clearInterval(interval);
  }, [updatePriceHistory]);

  if (loading && data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] bg-gray-900 rounded-lg border border-gray-800">
        <div className="text-center text-gray-400">
          <div className="mb-2">🔄 Conectando ao WebSocket...</div>
          <div className="text-sm">Aguardando dados em tempo real para {symbol}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[400px] bg-gray-900 rounded-lg border border-gray-800">
        <div className="text-center text-red-400">
          <div className="mb-2">⚠️ {error}</div>
          <div className="text-sm text-gray-400">Verifique a conexão WebSocket</div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] bg-gray-900 rounded-lg border border-gray-800">
        <div className="text-center text-gray-400">
          <div className="mb-2">📊 Coletando dados...</div>
          <div className="text-sm">Dados serão exibidos conforme chegam via WebSocket</div>
        </div>
      </div>
    );
  }

  const allPrices = data.flatMap(d => [d.gateio_price, d.mexc_price] as number[]);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const padding = (maxPrice - minPrice) * 0.1;

  return (
    <div className="w-full h-[400px] bg-gray-900 rounded-lg border border-gray-800 p-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-white">Preços em Tempo Real - {symbol}</h3>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-400">WebSocket</span>
          </div>
        </div>
        {lastUpdate && (
          <div className="text-right">
            <div className="text-sm text-gray-400">
              Atualizado: {lastUpdate.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
            </div>
            <div className="text-xs text-gray-500">
              {data.length} pontos coletados
            </div>
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="timestamp"
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            angle={-45}
            textAnchor="end"
            height={60}
            interval={Math.max(0, Math.floor(data.length / 8))}
            tickFormatter={formatDateTime}
          />
          <YAxis
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            tickFormatter={(value) => `$${value.toFixed(6)}`}
            domain={[minPrice - padding, maxPrice + padding]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend verticalAlign="top" height={36} wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
          <Line 
            type="monotone" 
            dataKey="gateio_price" 
            name="Gate.io (Spot)" 
            stroke="#86EFAC" 
            dot={{ r: 2 }} 
            strokeWidth={2} 
            connectNulls 
            isAnimationActive={false} 
          />
          <Line 
            type="monotone" 
            dataKey="mexc_price" 
            name="MEXC (Futures)" 
            stroke="#60A5FA" 
            dot={{ r: 2 }} 
            strokeWidth={2} 
            connectNulls 
            isAnimationActive={false} 
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
} 