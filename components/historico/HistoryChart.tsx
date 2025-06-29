'use client';

import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface OperationHistory {
  id: string;
  symbol: string;
  quantity: number;
  spotEntryPrice: number;
  futuresEntryPrice: number;
  spotExitPrice: number;
  futuresExitPrice: number;
  spotExchange: string;
  futuresExchange: string;
  profitLossUsd: number;
  profitLossPercent: number;
  createdAt: string;
  finalizedAt: string;
}

interface HistoryChartProps {
  operations: OperationHistory[];
  period: '7d' | '30d' | '90d' | 'all';
}

export default function HistoryChart({ operations, period }: HistoryChartProps) {
  const chartData = useMemo(() => {
    if (operations.length === 0) return [];

    // Filtrar operações por período
    const now = new Date();
    let filteredOps = operations;

    if (period !== 'all') {
      const daysBack = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const cutoffDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
      filteredOps = operations.filter(op => new Date(op.finalizedAt) >= cutoffDate);
    }

    if (filteredOps.length === 0) return [];

    // Ordenar por data de finalização
    const sortedOps = [...filteredOps].sort((a, b) => 
      new Date(a.finalizedAt).getTime() - new Date(b.finalizedAt).getTime()
    );

    // Agrupar por dia e calcular lucro acumulado
    const dailyData: { [key: string]: { date: string; dailyProfit: number; operations: number } } = {};
    let cumulativeProfit = 0;

    sortedOps.forEach(op => {
      const date = new Date(op.finalizedAt).toISOString().split('T')[0];
      
      if (!dailyData[date]) {
        dailyData[date] = { date, dailyProfit: 0, operations: 0 };
      }
      
      dailyData[date].dailyProfit += op.profitLossUsd;
      dailyData[date].operations += 1;
    });

    // Converter para array e adicionar lucro acumulado
    const result = Object.values(dailyData).map(day => {
      cumulativeProfit += day.dailyProfit;
      return {
        date: day.date,
        dateFormatted: new Date(day.date).toLocaleDateString('pt-BR', { 
          day: '2-digit', 
          month: '2-digit' 
        }),
        dailyProfit: day.dailyProfit,
        cumulativeProfit: cumulativeProfit,
        operations: day.operations
      };
    });

    return result;
  }, [operations, period]);

  if (chartData.length === 0) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-4">Evolução do Lucro</h3>
        <div className="h-64 flex items-center justify-center">
          <p className="text-gray-400">Nenhum dado disponível para o período selecionado</p>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="text-gray-300 text-sm mb-1">{`Data: ${label}`}</p>
          <p className="text-custom-cyan font-semibold">
            {`Lucro Diário: ${formatCurrency(payload[0]?.value || 0)}`}
          </p>
          <p className="text-green-400 font-semibold">
            {`Lucro Acumulado: ${formatCurrency(payload[1]?.value || 0)}`}
          </p>
          <p className="text-gray-400 text-xs">
            {`${payload[0]?.payload?.operations || 0} operação(ões)`}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <h3 className="text-lg font-semibold text-white mb-4">Evolução do Lucro - {period.toUpperCase()}</h3>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="dateFormatted" 
              stroke="#9CA3AF" 
              tick={{ fontSize: 12 }}
              tickLine={{ stroke: '#6B7280' }}
            />
            <YAxis 
              stroke="#9CA3AF" 
              tick={{ fontSize: 12 }}
              tickLine={{ stroke: '#6B7280' }}
              tickFormatter={(value) => formatCurrency(value)}
            />
            <Tooltip content={<CustomTooltip />} />
            
            {/* Linha do lucro diário */}
            <Line 
              type="monotone" 
              dataKey="dailyProfit" 
              stroke="#06D6A0" 
              strokeWidth={2}
              dot={{ fill: '#06D6A0', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#06D6A0', strokeWidth: 2 }}
              name="Lucro Diário"
            />
            
            {/* Linha do lucro acumulado */}
            <Line 
              type="monotone" 
              dataKey="cumulativeProfit" 
              stroke="#10B981" 
              strokeWidth={3}
              dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#10B981', strokeWidth: 2 }}
              name="Lucro Acumulado"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {/* Legenda */}
      <div className="flex justify-center mt-4 space-x-6">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-custom-cyan rounded-full mr-2"></div>
          <span className="text-sm text-gray-300">Lucro Diário</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
          <span className="text-sm text-gray-300">Lucro Acumulado</span>
        </div>
      </div>
    </div>
  );
} 