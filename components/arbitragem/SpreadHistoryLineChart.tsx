'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps
} from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface SpreadHistoryData {
  timestamp: string;
  spread_percentage: number;
}

interface SpreadHistoryLineChartProps {
  symbol: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function SpreadHistoryLineChart({ symbol, isOpen, onClose }: SpreadHistoryLineChartProps) {
  const [data, setData] = useState<SpreadHistoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!isOpen) return;
      
      try {
        setLoading(true);
        const response = await fetch(`/api/spread-history/24h/${encodeURIComponent(symbol)}`);
        if (!response.ok) throw new Error('Falha ao carregar dados');
        const result = await response.json();
        setData(result);
        setError(null);
      } catch (err) {
        console.error('Erro ao buscar histórico:', err);
        setError('Falha ao carregar dados do histórico');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [symbol, isOpen]);

  const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-700 p-2 rounded-md shadow-lg">
          <p className="text-white">{`Horário: ${label}`}</p>
          <p className="text-purple-400">{`Spread: ${payload[0].value.toFixed(2)}%`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl bg-dark-card border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white">
            Histórico de Spreads - {symbol}
          </DialogTitle>
        </DialogHeader>

        <div className="h-[400px] w-full mt-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-400">Carregando dados...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-red-400">{error}</p>
            </div>
          ) : data.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-400">Nenhum dado disponível</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="timestamp"
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  interval="preserveStartEnd"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="spread_percentage"
                  stroke="#A855F7"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#A855F7' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 