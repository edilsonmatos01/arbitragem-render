'use client';

import { useState, useEffect } from 'react';
import { Calendar, Filter, TrendingUp, TrendingDown } from 'lucide-react';

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

export default function HistoricoPage() {
  const [operations, setOperations] = useState<OperationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('24h');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('');

  const fetchOperations = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        filter,
        ...(filter === 'day' && startDate && { startDate }),
        ...(filter === 'range' && startDate && endDate && { startDate, endDate }),
        ...(selectedSymbol && { symbol: selectedSymbol })
      });

      const response = await fetch(`/api/operation-history?${params}`);
      if (response.ok) {
        const data = await response.json();
        setOperations(data);
      }
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOperations();
  }, [filter, startDate, endDate, selectedSymbol]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const totalProfit = operations.reduce((sum, op) => sum + op.profitLossUsd, 0);
  const totalPercent = operations.length > 0 
    ? operations.reduce((sum, op) => sum + op.profitLossPercent, 0) / operations.length 
    : 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-semibold text-white">Histórico de Operações</h1>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total de Operações</p>
              <p className="text-2xl font-bold text-white">{operations.length}</p>
            </div>
            <Calendar className="h-8 w-8 text-custom-cyan" />
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Lucro Total</p>
              <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(totalProfit)}
              </p>
            </div>
            {totalProfit >= 0 ? (
              <TrendingUp className="h-8 w-8 text-green-400" />
            ) : (
              <TrendingDown className="h-8 w-8 text-red-400" />
            )}
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Média Percentual</p>
              <p className={`text-2xl font-bold ${totalPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalPercent >= 0 ? '+' : ''}{totalPercent.toFixed(2)}%
              </p>
            </div>
            <Filter className="h-8 w-8 text-custom-cyan" />
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-4">Filtros</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Período</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-custom-cyan focus:border-custom-cyan"
            >
              <option value="24h">Últimas 24h</option>
              <option value="day">Dia específico</option>
              <option value="range">Intervalo de datas</option>
            </select>
          </div>

          {filter === 'day' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Data</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-custom-cyan focus:border-custom-cyan"
              />
            </div>
          )}

          {filter === 'range' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Data Inicial</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-custom-cyan focus:border-custom-cyan"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Data Final</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-custom-cyan focus:border-custom-cyan"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Símbolo (opcional)</label>
            <input
              type="text"
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              placeholder="Ex: BTC/USDT"
              className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-custom-cyan focus:border-custom-cyan"
            />
          </div>
        </div>
      </div>

      {/* Tabela de Operações */}
      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Operações Finalizadas</h3>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-custom-cyan mx-auto"></div>
            <p className="text-gray-400 mt-2">Carregando...</p>
          </div>
        ) : operations.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-400">Nenhuma operação encontrada para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Símbolo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Quantidade</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Entrada</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Saída</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Lucro/Prejuízo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {operations.map((operation) => (
                  <tr key={operation.id} className="hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">{operation.symbol}</div>
                      <div className="text-xs text-gray-400">
                        {operation.spotExchange} / {operation.futuresExchange}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-white">{operation.quantity.toFixed(4)}</div>
                      <div className="text-xs text-gray-400">{operation.symbol.split('/')[0]}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs text-gray-400">Spot: ${operation.spotEntryPrice.toFixed(4)}</div>
                      <div className="text-xs text-gray-400">Futures: ${operation.futuresEntryPrice.toFixed(4)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs text-gray-400">Spot: ${operation.spotExitPrice.toFixed(4)}</div>
                      <div className="text-xs text-gray-400">Futures: ${operation.futuresExitPrice.toFixed(4)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${operation.profitLossUsd >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(operation.profitLossUsd)}
                      </div>
                      <div className={`text-xs ${operation.profitLossPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {operation.profitLossPercent >= 0 ? '+' : ''}{operation.profitLossPercent.toFixed(2)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {formatDate(operation.finalizedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
} 