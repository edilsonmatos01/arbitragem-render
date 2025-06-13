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

// Componente de Tooltip customizado
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-3 bg-gray-800 border border-gray-700 rounded-md shadow-lg">
        <p className="label text-white font-semibold mb-2">{`Horário: ${label}`}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className={`text-${entry.color === '#86EFAC' ? 'green' : 'blue'}-400`}>
            {`${entry.name}: $${entry.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          </p>
        ))}
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

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="timestamp" 
            stroke="#9CA3AF" 
            tick={{ fontSize: 12 }}
          />
          <YAxis 
            stroke="#9CA3AF" 
            tickFormatter={(value) => `$${value.toLocaleString('pt-BR')}`}
            tick={{ fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ color: '#9CA3AF' }} />
          <Line 
            type="monotone" 
            dataKey="spot" 
            stroke="#86EFAC" 
            strokeWidth={2} 
            dot={{ r: 3 }} 
            activeDot={{ r: 6 }} 
            name="Preço Spot" 
          />
          <Line 
            type="monotone" 
            dataKey="futures" 
            stroke="#60A5FA" 
            strokeWidth={2} 
            dot={{ r: 3 }} 
            activeDot={{ r: 6 }} 
            name="Preço Futures" 
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
} 