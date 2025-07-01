"use client";

import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

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

interface ChartDataPoint {
  name: string;
  value: number;
  date: string;
  operationsCount: number;
  totalProfit: number;
}

const filterButtons = [
  { label: '7D', dataKey: '7D', days: 7 }, 
  { label: '15D', dataKey: '15D', days: 15 }, 
  { label: '30D', dataKey: '30D', days: 30 }, 
  { label: '6M', dataKey: '6M', days: 180 }, 
  { label: '1A', dataKey: '1A', days: 365 }
];

interface ArbitrageHistoryChartProps {
  operations?: OperationHistory[];
  onDataUpdate?: (operations: OperationHistory[]) => void;
}

export default function ArbitrageHistoryChart({ operations: externalOperations, onDataUpdate }: ArbitrageHistoryChartProps) {
  const [activeButton, setActiveButton] = useState('30D');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalReturn, setTotalReturn] = useState(0);
  const [internalOperations, setInternalOperations] = useState<OperationHistory[]>([]);

  const fetchOperationsData = async (days: number) => {
    try {
      setIsLoading(true);
      
      let operations: OperationHistory[] = [];
      
      // Usar operações externas se fornecidas, senão buscar da API
      if (externalOperations && externalOperations.length > 0) {
        operations = externalOperations;
      } else {
        const response = await fetch('/api/operation-history');
        operations = await response.json();
        setInternalOperations(operations);
        
        // Notificar componente pai sobre os dados carregados
        if (onDataUpdate) {
          onDataUpdate(operations);
        }
      }

      if (!Array.isArray(operations) || operations.length === 0) {
        setChartData([]);
        setTotalReturn(0);
        return;
      }

      // Filtrar operações pelo período selecionado
      const now = new Date();
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      
      const filteredOperations = operations.filter(op => {
        const opDate = new Date(op.finalizedAt);
        return opDate >= startDate && opDate <= now;
      });

      if (filteredOperations.length === 0) {
        setChartData([]);
        setTotalReturn(0);
        return;
      }

      // Agrupar operações por dia e calcular retorno acumulado
      const groupedByDay = new Map<string, OperationHistory[]>();
      
      filteredOperations.forEach(op => {
        const date = new Date(op.finalizedAt);
        const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
        
        if (!groupedByDay.has(dayKey)) {
          groupedByDay.set(dayKey, []);
        }
        groupedByDay.get(dayKey)!.push(op);
      });

      // Criar dados do gráfico com retorno acumulado
      const sortedDays = Array.from(groupedByDay.keys()).sort();
      let accumulatedReturn = 0;
      
      const data: ChartDataPoint[] = sortedDays.map(dayKey => {
        const dayOperations = groupedByDay.get(dayKey)!;
        const dayProfit = dayOperations.reduce((sum, op) => sum + op.profitLossUsd, 0);
        const dayReturnPercent = dayOperations.reduce((sum, op) => sum + op.profitLossPercent, 0);
        
        accumulatedReturn += dayReturnPercent;
        
        const date = new Date(dayKey);
        const formattedName = date.toLocaleDateString('pt-BR', { 
          day: '2-digit', 
          month: 'short' 
        });

        return {
          name: formattedName,
          value: parseFloat(accumulatedReturn.toFixed(2)),
          date: dayKey,
          operationsCount: dayOperations.length,
          totalProfit: parseFloat(dayProfit.toFixed(2))
        };
      });

      setChartData(data);
      setTotalReturn(parseFloat(accumulatedReturn.toFixed(2)));
      
    } catch (error) {
      console.error('Erro ao buscar dados das operações:', error);
      setChartData([]);
      setTotalReturn(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const selectedFilter = filterButtons.find(btn => btn.label === activeButton);
    if (selectedFilter) {
      fetchOperationsData(selectedFilter.days);
    }
  }, [activeButton, externalOperations]);

  const handleFilterClick = (label: string) => {
    setActiveButton(label);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800 border border-gray-700 p-3 rounded-md shadow-lg">
          <p className="text-white font-semibold mb-1">{`${label}`}</p>
          <p className="text-custom-cyan">{`Retorno Acumulado: ${payload[0].value.toFixed(2)}%`}</p>
          <p className="text-gray-300 text-sm">{`Operações: ${data.operationsCount}`}</p>
          <p className="text-green-400 text-sm">{`Lucro do dia: $${data.totalProfit}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Histórico de Arbitragem</h2>
          {!isLoading && (
            <p className="text-sm text-gray-400 mt-1">
              {chartData.length > 0 
                ? `Retorno acumulado: ${totalReturn > 0 ? '+' : ''}${totalReturn.toFixed(2)}%`
                : 'Nenhuma operação no período'
              }
            </p>
          )}
        </div>
        <div className="flex space-x-1">
          {filterButtons.map((period) => (
            <button 
              key={period.label} 
              onClick={() => handleFilterClick(period.label)}
              className={`px-3 py-1 text-xs rounded-md focus:outline-none transition-colors
                          ${activeButton === period.label 
                            ? 'bg-custom-cyan text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>
      
      <div style={{ width: '100%', height: 300 }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400">Carregando dados...</div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-400">
              <div className="mb-2">📊 Nenhuma operação encontrada</div>
              <div className="text-sm">Dados aparecerão quando houver operações finalizadas</div>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: -30, bottom: 5 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00C49F" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#00C49F" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="name" 
                stroke="#6B7280" 
                tick={{ fontSize: 12 }} 
              />
              <YAxis 
                stroke="#6B7280" 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#00C49F" 
                fillOpacity={1} 
                fill="url(#colorValue)" 
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
} 