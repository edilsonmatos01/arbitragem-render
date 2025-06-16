'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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
}

// Componente de Tooltip customizado para formatar os valores
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-3 bg-gray-800 border border-gray-700 rounded-md shadow-lg">
        <p className="label text-white font-semibold mb-2">{`${label}`}</p>
        <p className="text-green-400">{`Gate.io (spot): $${payload[0].value.toLocaleString('pt-BR', { minimumFractionDigits: 4 })}`}</p>
        <p className="text-blue-400">{`MEXC (futures): $${payload[1].value.toLocaleString('pt-BR', { minimumFractionDigits: 4 })}`}</p>
        {payload[0].value !== payload[1].value && (
          <p className="text-gray-400 text-sm mt-1">
            {`Diferença: ${((Math.abs(payload[1].value - payload[0].value) / payload[0].value) * 100).toFixed(4)}%`}
          </p>
        )}
      </div>
    );
  }
  return null;
};

export default function PriceComparisonChart({ symbol }: PriceComparisonChartProps) {
  const [data, setData] = useState<PriceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
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
        }
      } catch (err) {
        console.error('Erro ao buscar dados de comparação:', err);
        setError('Erro ao carregar dados de comparação');
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // Atualiza a cada 30 segundos
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [symbol]);

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

  // Calcular o domínio do eixo Y para manter uma boa proporção visual
  const allPrices = data.flatMap(item => [item.spot, item.futures]);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const priceRange = maxPrice - minPrice;
  const yDomain = [
    minPrice - (priceRange * 0.1), // 10% abaixo do mínimo
    maxPrice + (priceRange * 0.1)  // 10% acima do máximo
  ];

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 60, // Aumentado para acomodar labels de data/hora
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
            interval={Math.max(0, Math.floor(data.length / 8))} // Mostra no máximo 8 labels
          />
          <YAxis 
            stroke="#9CA3AF" 
            domain={yDomain}
            tickFormatter={(value) => `$${value.toLocaleString('pt-BR', { minimumFractionDigits: 4 })}`}
            tick={{ fontSize: 10 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ color: '#9CA3AF' }} />
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
  );
} 