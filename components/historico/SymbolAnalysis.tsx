'use client';

import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Target, BarChart3 } from 'lucide-react';

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

interface SymbolAnalysisProps {
  operations: OperationHistory[];
}

interface SymbolStats {
  symbol: string;
  totalOperations: number;
  totalProfit: number;
  avgProfit: number;
  winRate: number;
  totalVolume: number;
  bestOperation: number;
  worstOperation: number;
}

const COLORS = ['#06D6A0', '#118AB2', '#073B4C', '#FFD166', '#F77F00', '#FCBF49', '#F18701', '#D62828'];

export default function SymbolAnalysis({ operations }: SymbolAnalysisProps) {
  const symbolStats = useMemo(() => {
    if (operations.length === 0) return [];

    const symbolMap: { [key: string]: OperationHistory[] } = {};
    
    // Agrupar operações por símbolo
    operations.forEach(op => {
      if (!symbolMap[op.symbol]) {
        symbolMap[op.symbol] = [];
      }
      symbolMap[op.symbol].push(op);
    });

    // Calcular estatísticas para cada símbolo
    const stats: SymbolStats[] = Object.entries(symbolMap).map(([symbol, ops]) => {
      const totalProfit = ops.reduce((sum, op) => sum + op.profitLossUsd, 0);
      const profitableOps = ops.filter(op => op.profitLossUsd > 0);
      const winRate = (profitableOps.length / ops.length) * 100;
      const totalVolume = ops.reduce((sum, op) => sum + (op.quantity * op.spotEntryPrice), 0);
      const bestOperation = Math.max(...ops.map(op => op.profitLossUsd));
      const worstOperation = Math.min(...ops.map(op => op.profitLossUsd));

      return {
        symbol,
        totalOperations: ops.length,
        totalProfit,
        avgProfit: totalProfit / ops.length,
        winRate,
        totalVolume,
        bestOperation,
        worstOperation
      };
    });

    // Ordenar por lucro total (decrescente)
    return stats.sort((a, b) => b.totalProfit - a.totalProfit);
  }, [operations]);

  const topSymbols = symbolStats.slice(0, 8); // Top 8 símbolos

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="text-gray-300 text-sm font-semibold mb-2">{label}</p>
          <p className="text-custom-cyan text-sm">
            {`Operações: ${data.totalOperations}`}
          </p>
          <p className="text-green-400 text-sm">
            {`Lucro Total: ${formatCurrency(data.totalProfit)}`}
          </p>
          <p className="text-blue-400 text-sm">
            {`Taxa de Acerto: ${data.winRate.toFixed(1)}%`}
          </p>
          <p className="text-yellow-400 text-sm">
            {`Volume: ${formatCurrency(data.totalVolume)}`}
          </p>
        </div>
      );
    }
    return null;
  };

  if (symbolStats.length === 0) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-4">Análise por Símbolos</h3>
        <div className="h-64 flex items-center justify-center">
          <p className="text-gray-400">Nenhum dado disponível</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabela de Top Símbolos */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-4">Top Símbolos por Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 text-gray-300">Símbolo</th>
                <th className="text-right py-2 text-gray-300">Operações</th>
                <th className="text-right py-2 text-gray-300">Lucro Total</th>
                <th className="text-right py-2 text-gray-300">Lucro Médio</th>
                <th className="text-right py-2 text-gray-300">Taxa Acerto</th>
                <th className="text-right py-2 text-gray-300">Volume</th>
              </tr>
            </thead>
            <tbody>
              {topSymbols.map((stat, index) => (
                <tr key={stat.symbol} className="border-b border-gray-700 hover:bg-gray-700">
                  <td className="py-3">
                    <div className="flex items-center">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-custom-cyan text-black text-xs font-bold mr-2">
                        {index + 1}
                      </div>
                      <span className="font-semibold text-white">{stat.symbol}</span>
                    </div>
                  </td>
                  <td className="text-right py-3 text-gray-300">{stat.totalOperations}</td>
                  <td className={`text-right py-3 font-semibold ${stat.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(stat.totalProfit)}
                  </td>
                  <td className={`text-right py-3 ${stat.avgProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(stat.avgProfit)}
                  </td>
                  <td className="text-right py-3">
                    <div className="flex items-center justify-end">
                      <span className={`${stat.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                        {stat.winRate.toFixed(1)}%
                      </span>
                      {stat.winRate >= 50 ? (
                        <TrendingUp className="w-4 h-4 ml-1 text-green-400" />
                      ) : (
                        <TrendingDown className="w-4 h-4 ml-1 text-red-400" />
                      )}
                    </div>
                  </td>
                  <td className="text-right py-3 text-gray-300">{formatCurrency(stat.totalVolume)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Barras - Lucro por Símbolo */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-4">Lucro por Símbolo</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topSymbols} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="symbol" 
                  stroke="#9CA3AF" 
                  tick={{ fontSize: 11 }}
                  tickLine={{ stroke: '#6B7280' }}
                />
                <YAxis 
                  stroke="#9CA3AF" 
                  tick={{ fontSize: 11 }}
                  tickLine={{ stroke: '#6B7280' }}
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="totalProfit" 
                  fill="#06D6A0"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Pizza - Distribuição de Operações */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-4">Distribuição de Operações</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topSymbols}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ symbol, percent }) => `${symbol} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="totalOperations"
                >
                  {topSymbols.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value, name) => [value, 'Operações']}
                  labelFormatter={(label) => `Símbolo: ${label}`}
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151',
                    borderRadius: '0.375rem',
                    color: '#E5E7EB'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Cards de Destaques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {symbolStats.length > 0 && (
          <>
            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Símbolo Mais Lucrativo</p>
                  <p className="text-xl font-bold text-green-400">{symbolStats[0].symbol}</p>
                  <p className="text-sm text-gray-300">{formatCurrency(symbolStats[0].totalProfit)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-400" />
              </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Maior Taxa de Acerto</p>
                  {(() => {
                    const bestWinRate = [...symbolStats].sort((a, b) => b.winRate - a.winRate)[0];
                    return (
                      <>
                        <p className="text-xl font-bold text-custom-cyan">{bestWinRate.symbol}</p>
                        <p className="text-sm text-gray-300">{bestWinRate.winRate.toFixed(1)}%</p>
                      </>
                    );
                  })()}
                </div>
                <Target className="h-8 w-8 text-custom-cyan" />
              </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Mais Operado</p>
                  {(() => {
                    const mostTraded = [...symbolStats].sort((a, b) => b.totalOperations - a.totalOperations)[0];
                    return (
                      <>
                        <p className="text-xl font-bold text-blue-400">{mostTraded.symbol}</p>
                        <p className="text-sm text-gray-300">{mostTraded.totalOperations} operações</p>
                      </>
                    );
                  })()}
                </div>
                                 <BarChart3 className="h-8 w-8 text-blue-400" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 