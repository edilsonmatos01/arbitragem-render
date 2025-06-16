'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

interface PriceComparisonChartProps {
  symbol: string;
}

interface PriceData {
  timestamp: string;
  spot: number;
  futures: number;
}

interface ApiResponse {
  data: PriceData[];
  symbol: string;
  totalRecords: number;
  timeRange: string;
  message?: string;
  nextUpdate: string;
}

// Componente de Tooltip customizado para formatar os valores
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const spotPrice = payload[0].value;
    const futuresPrice = payload[1].value;
    const difference = futuresPrice - spotPrice;
    const percentDiff = (difference / spotPrice) * 100;
    const isPriceEqual = Math.abs(difference) < 0.0001;

    return (
      <div className="p-3 bg-gray-800 border border-gray-700 rounded-md shadow-lg">
        <p className="label text-white font-semibold mb-2">{`${label}`}</p>
        <p className="text-green-400">{`Gate.io (spot): $${spotPrice.toLocaleString('pt-BR', { minimumFractionDigits: 4 })}`}</p>
        <p className="text-blue-400">{`MEXC (futures): $${futuresPrice.toLocaleString('pt-BR', { minimumFractionDigits: 4 })}`}</p>
        <p className={`text-sm mt-1 ${isPriceEqual ? 'text-yellow-400' : difference > 0 ? 'text-green-400' : 'text-red-400'}`}>
          {isPriceEqual 
            ? '⚠️ Preços Iguais!'
            : `${difference > 0 ? 'Futures > Spot' : 'Spot > Futures'}: $${Math.abs(difference).toLocaleString('pt-BR', { minimumFractionDigits: 4 })} (${Math.abs(percentDiff).toFixed(4)}%)`
          }
        </p>
      </div>
    );
  }
  return null;
};

// Componente memoizado para o gráfico
const MemoizedLineChart = React.memo(({ data, crossPoints, yDomain }: { 
  data: PriceData[], 
  crossPoints: string[],
  yDomain: [number, number]
}) => (
  <div className="relative" style={{ width: '100%', height: 300 }}>
    {crossPoints.length > 0 && (
      <div className="absolute top-0 right-0 bg-gray-800 p-2 rounded-md text-xs text-yellow-400 z-10">
        ⚠️ {crossPoints.length} cruzamento(s) detectado(s)
      </div>
    )}
    <ResponsiveContainer>
      <LineChart
        data={data}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 60,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis 
          dataKey="timestamp" 
          stroke="#9CA3AF" 
          tick={{ fontSize: 10 }}
          angle={-45}
          textAnchor="end"
          height={60}
          interval={Math.max(0, Math.floor(data.length / 8))}
        />
        <YAxis 
          stroke="#9CA3AF" 
          domain={yDomain}
          tickFormatter={(value) => `$${value.toLocaleString('pt-BR', { minimumFractionDigits: 4 })}`}
          tick={{ fontSize: 10 }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ color: '#9CA3AF' }} />
        
        {crossPoints.map((timestamp, index) => (
          <ReferenceLine
            key={index}
            x={timestamp}
            stroke="#FBBF24"
            strokeDasharray="3 3"
            label={{
              value: "⚠️",
              position: "top",
              fill: "#FBBF24",
              fontSize: 12
            }}
          />
        ))}

        <Line 
          type="monotone" 
          dataKey="spot" 
          stroke="#86EFAC" 
          strokeWidth={2} 
          dot={{ r: 2 }} 
          activeDot={{ r: 6 }} 
          name="Gate.io (spot)"
        />
        <Line 
          type="monotone" 
          dataKey="futures" 
          stroke="#60A5FA" 
          strokeWidth={2} 
          dot={{ r: 2 }} 
          activeDot={{ r: 6 }} 
          name="MEXC (futures)"
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
));

MemoizedLineChart.displayName = 'MemoizedLineChart';

export default function PriceComparisonChart({ symbol }: PriceComparisonChartProps) {
  const [data, setData] = useState<PriceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextUpdate, setNextUpdate] = useState<Date | null>(null);

  // Função memoizada para calcular os pontos de cruzamento
  const findCrossPoints = useCallback((chartData: PriceData[]) => {
    return chartData.reduce((points: string[], current, index, arr) => {
      if (index === 0) return points;
      const prev = arr[index - 1];
      
      const prevDiff = prev.futures - prev.spot;
      const currDiff = current.futures - current.spot;
      
      if ((prevDiff >= 0 && currDiff <= 0) || (prevDiff <= 0 && currDiff >= 0)) {
        points.push(current.timestamp);
      }
      
      return points;
    }, []);
  }, []);

  // Valores calculados memoizados
  const { crossPoints, yDomain } = useMemo(() => {
    if (data.length === 0) {
      return { crossPoints: [], yDomain: [0, 0] as [number, number] };
    }

    const points = findCrossPoints(data);
    const allPrices = data.flatMap(item => [item.spot, item.futures]);
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceRange = maxPrice - minPrice;
    
    return {
      crossPoints: points,
      yDomain: [
        minPrice - (priceRange * 0.1),
        maxPrice + (priceRange * 0.1)
      ] as [number, number]
    };
  }, [data, findCrossPoints]);

  // Função memoizada para buscar dados
  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/price-comparison?symbol=${encodeURIComponent(symbol)}`);
      
      if (!response.ok) {
        throw new Error('Falha ao buscar dados de comparação');
      }
      
      const result: ApiResponse = await response.json();
      
      if (result.data.length === 0) {
        setError(result.message || 'Sem dados suficientes para comparação');
        setData([]);
      } else {
        setData(result.data);
        setNextUpdate(new Date(result.nextUpdate));
      }
    } catch (err) {
      console.error('Erro ao buscar dados de comparação:', err);
      setError('Erro ao carregar dados de comparação');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    
    fetchData();
    
    // Configura o próximo intervalo de atualização
    const interval = setInterval(() => {
      const now = new Date();
      if (nextUpdate && now >= nextUpdate) {
        fetchData();
      }
    }, 1000); // Verifica a cada segundo se é hora de atualizar

    return () => clearInterval(interval);
  }, [fetchData, nextUpdate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Carregando dados de comparação...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-400 mb-2">⚠️ {error}</div>
          <div className="text-gray-500 text-sm">
            Dados de comparação serão exibidos quando houver registros suficientes
          </div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-gray-400 mb-2">📊 Sem dados disponíveis</div>
          <div className="text-gray-500 text-sm">
            Aguarde a coleta de dados de preços para visualizar a comparação
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-xs text-gray-500 mb-2">
        Próxima atualização: {nextUpdate?.toLocaleString('pt-BR', { 
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>
      <MemoizedLineChart data={data} crossPoints={crossPoints} yDomain={yDomain} />
    </div>
  );
} 