'use client';

import React, { useState, useEffect } from 'react';

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

export default function EnhancedPercentageGauge() {
  const [currentPercentage, setCurrentPercentage] = useState(0);
  const [targetPercentage] = useState(25); // Meta mensal fixa
  const [isLoading, setIsLoading] = useState(true);
  const [totalProfitUsd, setTotalProfitUsd] = useState(0);

  useEffect(() => {
    const fetchPerformanceData = async () => {
      try {
        setIsLoading(true);
        
        // Buscar histórico de operações
        const response = await fetch('/api/operation-history');
        const operations: OperationHistory[] = await response.json();

        if (Array.isArray(operations) && operations.length > 0) {
          // Calcular retorno acumulado total baseado no profit/loss percent
          const totalReturnPercent = operations.reduce((sum, op) => sum + op.profitLossPercent, 0);
          
          // Calcular lucro total em USD
          const totalProfitUsd = operations.reduce((sum, op) => sum + op.profitLossUsd, 0);
          
          setCurrentPercentage(parseFloat(totalReturnPercent.toFixed(2)));
          setTotalProfitUsd(totalProfitUsd);
        } else {
          // Se não houver operações, valores zerados
          setCurrentPercentage(0);
          setTotalProfitUsd(0);
        }
      } catch (error) {
        console.error('Erro ao buscar dados de performance:', error);
        setCurrentPercentage(0);
        setTotalProfitUsd(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPerformanceData();
  }, []);

  const progressPercentage = Math.min((Math.abs(currentPercentage) / targetPercentage) * 100, 100);

  const getProgressColor = (percentage: number, isNegative: boolean) => {
    if (isNegative) return 'text-red-400';
    if (percentage > 0) return 'text-custom-cyan'; // Verde/ciano do tema
    return 'text-white'; // Branco quando zerado
  };

  const getProgressBgColor = (percentage: number, isNegative: boolean) => {
    if (isNegative) return 'bg-red-400';
    if (percentage > 0) return 'bg-custom-cyan'; // Verde/ciano do tema
    return 'bg-gray-600'; // Cinza neutro quando zerado
  };

  const isNegative = currentPercentage < 0;
  const displayPercentage = Math.abs(currentPercentage);

  return (
    <div className="space-y-6">
      {/* Gauge Principal */}
      <div className="text-center">
        <div className="relative inline-flex items-center justify-center">
          {/* Círculo de fundo */}
          <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-gray-700"
            />
            {/* Círculo de progresso */}
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={`${progressPercentage * 2.51} 251`}
              className={getProgressBgColor(progressPercentage, isNegative)}
              strokeLinecap="round"
            />
          </svg>
          
          {/* Conteúdo central */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {isLoading ? (
              <div className="text-gray-400 text-sm">...</div>
            ) : (
              <div className={`text-2xl font-bold ${getProgressColor(progressPercentage, isNegative)}`}>
                {isNegative ? '-' : '+'}{displayPercentage.toFixed(1)}%
              </div>
            )}
          </div>
        </div>

        {/* Barra de progresso linear */}
        <div className="mt-4 w-full bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${getProgressBgColor(progressPercentage, isNegative)}`}
            style={{ width: `${Math.min(progressPercentage, 100)}%` }}
          ></div>
        </div>
        
        <div className="flex justify-between text-xs text-gray-400 mt-2">
          <span>0%</span>
          <span className="font-medium">Meta: {targetPercentage}%</span>
        </div>

        {/* Informações adicionais */}
        {!isLoading && (
          <div className="mt-4 space-y-2">
            <div className="text-sm text-gray-400">
              Lucro Total: <span className={`font-semibold ${totalProfitUsd >= 0 ? 'text-custom-cyan' : 'text-red-400'}`}>
                ${totalProfitUsd.toFixed(2)}
              </span>
            </div>
            {currentPercentage === 0 ? (
              <div className="text-xs text-gray-500">
                Aguardando operações para calcular performance
              </div>
            ) : (
              <div className="text-xs text-gray-500">
                {progressPercentage >= 100 
                  ? '🎉 Meta atingida!' 
                  : `${(progressPercentage).toFixed(1)}% da meta mensal`
                }
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 