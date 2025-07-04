'use client';

import { useState, useEffect } from 'react';
import { Calendar, Filter, TrendingUp, TrendingDown, BarChart3, Download, Search, RefreshCw, Activity, PieChart, LayoutDashboard, Repeat, Wallet, History, Settings, Trash2 } from 'lucide-react';
import { OperationHistoryStorage } from '@/lib/operation-history-storage';
import HistoryChart from '@/components/historico/HistoryChart';
import SymbolAnalysis from '@/components/historico/SymbolAnalysis';
import Sidebar from '@/components/dashboard/sidebar';
import ConfirmationModal from '@/components/ui/confirmation-modal';

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

interface HistoryStats {
  totalOperations: number;
  totalProfit: number;
  totalProfitPercent: number;
  winRate: number;
  avgProfitPerOperation: number;
  bestOperation: OperationHistory | null;
  worstOperation: OperationHistory | null;
  totalVolume: number;
  avgHoldingTime: number;
}

export default function HistoricoPage() {
  const [operations, setOperations] = useState<OperationHistory[]>([]);
  const [filteredOperations, setFilteredOperations] = useState<OperationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [operationToDelete, setOperationToDelete] = useState<OperationHistory | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Estados de filtro
  const [filter, setFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [selectedExchange, setSelectedExchange] = useState('');
  const [profitFilter, setProfitFilter] = useState('all'); // 'all', 'profit', 'loss'
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('finalizedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Estados de paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // Estados de visualização
  const [activeTab, setActiveTab] = useState<'table' | 'chart' | 'analysis'>('table');
  const [chartPeriod, setChartPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  const fetchOperations = async () => {
    try {
      setLoading(true);
      
      // Primeiro, tentar buscar da API
      try {
        const response = await fetch('/api/operation-history');
        if (response.ok) {
          const data = await response.json();
          if (data && data.length > 0) {
            console.log('✅ Dados carregados da API:', data.length, 'operações');
            setOperations(data);
            return;
          }
        }
      } catch (apiError) {
        console.error('❌ Erro ao buscar da API:', apiError);
      }

      // Fallback: buscar do localStorage
      console.log('📱 Carregando do localStorage...');
      const localData = OperationHistoryStorage.getAllOperations();
      console.log('✅ Dados carregados do localStorage:', localData.length, 'operações');
      setOperations(localData);

    } catch (error) {
      console.error('❌ Erro geral ao buscar histórico:', error);
      setOperations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (operation: OperationHistory) => {
    setOperationToDelete(operation);
    setShowDeleteModal(true);
  };

  const confirmDeleteOperation = async () => {
    if (!operationToDelete) return;

    try {
      setDeletingId(operationToDelete.id);
      
      // Tentar excluir da API primeiro
      try {
        const response = await fetch(`/api/operation-history?id=${operationToDelete.id}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          console.log('✅ Operação excluída da API:', operationToDelete.id);
        } else {
          console.log('⚠️ Erro ao excluir da API, continuando com localStorage');
        }
      } catch (apiError) {
        console.error('❌ Erro na API, usando fallback:', apiError);
      }

      // Sempre tentar excluir do localStorage também
      OperationHistoryStorage.deleteOperation(operationToDelete.id);

      // Atualizar a lista local imediatamente
      setOperations(prev => prev.filter(op => op.id !== operationToDelete.id));
      
      console.log('✅ Operação excluída com sucesso:', operationToDelete.id);
      
      // Fechar modal
      setShowDeleteModal(false);
      setOperationToDelete(null);
    } catch (error) {
      console.error('❌ Erro ao excluir operação:', error);
      alert('Erro ao excluir operação. Tente novamente.');
    } finally {
      setDeletingId(null);
    }
  };

  const cancelDeleteOperation = () => {
    setShowDeleteModal(false);
    setOperationToDelete(null);
  };

  // Função para aplicar filtros
  const applyFilters = () => {
    let filtered = [...operations];

    // Filtro por período
    if (filter !== 'all') {
      const now = new Date();
      let startTime: Date | null = null;

      switch (filter) {
        case '24h':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'custom':
          if (startDate && endDate) {
            filtered = filtered.filter(op => {
              const opDate = new Date(op.finalizedAt);
              return opDate >= new Date(startDate) && opDate <= new Date(endDate);
            });
          }
          break;
        default:
          break;
      }

      if (filter !== 'custom' && startTime) {
        filtered = filtered.filter(op => new Date(op.finalizedAt) >= startTime);
      }
    }

    // Filtro por símbolo
    if (selectedSymbol) {
      filtered = filtered.filter(op => op.symbol.toLowerCase().includes(selectedSymbol.toLowerCase()));
    }

    // Filtro por exchange
    if (selectedExchange) {
      filtered = filtered.filter(op => 
        op.spotExchange.toLowerCase().includes(selectedExchange.toLowerCase()) ||
        op.futuresExchange.toLowerCase().includes(selectedExchange.toLowerCase())
      );
    }

    // Filtro por lucro/prejuízo
    if (profitFilter !== 'all') {
      filtered = filtered.filter(op => 
        profitFilter === 'profit' ? op.profitLossUsd > 0 : op.profitLossUsd < 0
      );
    }

    // Filtro por termo de busca
    if (searchTerm) {
      filtered = filtered.filter(op => 
        op.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.spotExchange.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.futuresExchange.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Ordenação
    filtered.sort((a, b) => {
      let aValue: any = a[sortBy as keyof OperationHistory];
      let bValue: any = b[sortBy as keyof OperationHistory];

      if (sortBy === 'finalizedAt' || sortBy === 'createdAt') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredOperations(filtered);
    setCurrentPage(1); // Reset para primeira página
  };

  // Calcular estatísticas
  const calculateStats = (ops: OperationHistory[]): HistoryStats => {
    if (ops.length === 0) {
      return {
        totalOperations: 0,
        totalProfit: 0,
        totalProfitPercent: 0,
        winRate: 0,
        avgProfitPerOperation: 0,
        bestOperation: null,
        worstOperation: null,
        totalVolume: 0,
        avgHoldingTime: 0
      };
    }

    const totalProfit = ops.reduce((sum, op) => sum + op.profitLossUsd, 0);
    const totalProfitPercent = ops.reduce((sum, op) => sum + op.profitLossPercent, 0) / ops.length;
    const profitableOps = ops.filter(op => op.profitLossUsd > 0);
    const winRate = (profitableOps.length / ops.length) * 100;
    const avgProfitPerOperation = totalProfit / ops.length;
    
    const bestOperation = ops.reduce((best, current) => 
      current.profitLossUsd > (best?.profitLossUsd || -Infinity) ? current : best, null as OperationHistory | null
    );
    
    const worstOperation = ops.reduce((worst, current) => 
      current.profitLossUsd < (worst?.profitLossUsd || Infinity) ? current : worst, null as OperationHistory | null
    );

    const totalVolume = ops.reduce((sum, op) => sum + (op.quantity * op.spotEntryPrice), 0);
    
    const avgHoldingTime = ops.reduce((sum, op) => {
      const created = new Date(op.createdAt).getTime();
      const finalized = new Date(op.finalizedAt).getTime();
      return sum + (finalized - created);
    }, 0) / ops.length / (1000 * 60 * 60); // Em horas

    return {
      totalOperations: ops.length,
      totalProfit,
      totalProfitPercent,
      winRate,
      avgProfitPerOperation,
      bestOperation,
      worstOperation,
      totalVolume,
      avgHoldingTime
    };
  };

  useEffect(() => {
    fetchOperations();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [operations, filter, startDate, endDate, selectedSymbol, selectedExchange, profitFilter, searchTerm, sortBy, sortOrder]);

  useEffect(() => {
    setStats(calculateStats(filteredOperations));
  }, [filteredOperations]);

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

  const formatTime = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}min`;
    if (hours < 24) return `${hours.toFixed(1)}h`;
    return `${Math.round(hours / 24)}d`;
  };

  // Obter símbolos únicos para o filtro
  const uniqueSymbols = [...new Set(operations.map(op => op.symbol))].sort();
  const uniqueExchanges = [...new Set([
    ...operations.map(op => op.spotExchange),
    ...operations.map(op => op.futuresExchange)
  ])].sort();

  // Paginação
  const totalPages = Math.ceil(filteredOperations.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentOperations = filteredOperations.slice(startIndex, endIndex);

  const exportToCSV = () => {
    const headers = [
      'Símbolo', 'Quantidade', 'Preço Entrada Spot', 'Preço Entrada Futures',
      'Preço Saída Spot', 'Preço Saída Futures', 'Exchange Spot', 'Exchange Futures',
      'Lucro USD', 'Lucro %', 'Data Criação', 'Data Finalização'
    ];

    const csvContent = [
      headers.join(','),
      ...filteredOperations.map(op => [
        op.symbol,
        op.quantity,
        op.spotEntryPrice,
        op.futuresEntryPrice,
        op.spotExitPrice,
        op.futuresExitPrice,
        op.spotExchange,
        op.futuresExchange,
        op.profitLossUsd,
        op.profitLossPercent,
        op.createdAt,
        op.finalizedAt
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historico-arbitragem-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Ícones e configuração do menu
  const iconProps = { className: "h-5 w-5" };
  const AppIcons = {
    LayoutDashboard: <LayoutDashboard {...iconProps} />,
    Repeat: <Repeat {...iconProps} />,
    TrendingUp: <TrendingUp {...iconProps} />,
    Wallet: <Wallet {...iconProps} />,
    History: <History {...iconProps} />,
    Settings: <Settings {...iconProps} />,
  };

  const sidebarNavItems = [
    { title: 'Dashboard', href: '/dashboard', icon: AppIcons.LayoutDashboard },
    { title: 'Arbitragem', href: '/arbitragem', icon: AppIcons.Repeat },
    { title: 'Big Arb', href: '/big-arb', icon: AppIcons.TrendingUp },
    { title: 'Carteiras', href: '/carteiras', icon: AppIcons.Wallet },
    { title: 'Histórico', href: '/historico', icon: AppIcons.History },
    { title: 'Configurações', href: '/configuracoes', icon: AppIcons.Settings },
  ];

  return (
    <div className="flex min-h-screen bg-dark-bg text-white">
      <Sidebar
        user={{ 
          name: 'Arbitrack',
          imageUrl: '/images/avatar.png.png'
        }}
        navItems={sidebarNavItems}
      />
      <main className="flex-1 p-8">
        <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-semibold text-white">Histórico de Operações</h1>
          <p className="text-sm text-gray-400 mt-1">
            {filteredOperations.length} de {operations.length} operações
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchOperations}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-custom-cyan hover:bg-custom-cyan/90 text-black font-semibold rounded-lg transition-colors"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Estatísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total de Operações</p>
                <p className="text-2xl font-bold text-white">{stats.totalOperations}</p>
              </div>
              <Calendar className="h-8 w-8 text-custom-cyan" />
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Lucro Total</p>
                <p className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(stats.totalProfit)}
                </p>
              </div>
              {stats.totalProfit >= 0 ? (
                <TrendingUp className="h-8 w-8 text-green-400" />
              ) : (
                <TrendingDown className="h-8 w-8 text-red-400" />
              )}
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Taxa de Acerto</p>
                <p className={`text-2xl font-bold ${stats.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                  {stats.winRate.toFixed(1)}%
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-custom-cyan" />
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Lucro Médio</p>
                <p className={`text-2xl font-bold ${stats.avgProfitPerOperation >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(stats.avgProfitPerOperation)}
                </p>
              </div>
              <Filter className="h-8 w-8 text-custom-cyan" />
            </div>
          </div>
        </div>
      )}

      {/* Estatísticas Detalhadas */}
      {stats && stats.totalOperations > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-2">Melhor Operação</h3>
            {stats.bestOperation && (
              <div>
                <p className="text-custom-cyan font-semibold">{stats.bestOperation.symbol}</p>
                <p className="text-green-400 font-bold">{formatCurrency(stats.bestOperation.profitLossUsd)}</p>
                <p className="text-xs text-gray-400">{formatDate(stats.bestOperation.finalizedAt)}</p>
              </div>
            )}
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-2">Pior Operação</h3>
            {stats.worstOperation && (
              <div>
                <p className="text-custom-cyan font-semibold">{stats.worstOperation.symbol}</p>
                <p className="text-red-400 font-bold">{formatCurrency(stats.worstOperation.profitLossUsd)}</p>
                <p className="text-xs text-gray-400">{formatDate(stats.worstOperation.finalizedAt)}</p>
              </div>
            )}
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-2">Estatísticas Gerais</h3>
            <div className="space-y-1">
              <p className="text-sm text-gray-400">Volume Total: <span className="text-white">{formatCurrency(stats.totalVolume)}</span></p>
              <p className="text-sm text-gray-400">Tempo Médio: <span className="text-white">{formatTime(stats.avgHoldingTime)}</span></p>
              <p className="text-sm text-gray-400">Retorno Médio: <span className={`${stats.totalProfitPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.totalProfitPercent >= 0 ? '+' : ''}{stats.totalProfitPercent.toFixed(2)}%
              </span></p>
            </div>
          </div>
        </div>
      )}

      {/* Abas de Visualização */}
      <div className="bg-gray-800 rounded-lg">
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab('table')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              activeTab === 'table'
                ? 'text-custom-cyan border-b-2 border-custom-cyan bg-gray-700'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Filter className="h-4 w-4" />
            Tabela de Operações
          </button>
          <button
            onClick={() => setActiveTab('chart')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              activeTab === 'chart'
                ? 'text-custom-cyan border-b-2 border-custom-cyan bg-gray-700'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Activity className="h-4 w-4" />
            Gráfico de Evolução
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              activeTab === 'analysis'
                ? 'text-custom-cyan border-b-2 border-custom-cyan bg-gray-700'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <PieChart className="h-4 w-4" />
            Análise por Símbolos
          </button>
        </div>
      </div>

      {/* Filtros (apenas para a aba de tabela) */}
      {activeTab === 'table' && (
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-white mb-4">Filtros</h3>
          
          {/* Linha 1: Filtros principais */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Período</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-custom-cyan focus:border-custom-cyan"
              >
                <option value="all">Todos os períodos</option>
                <option value="24h">Últimas 24h</option>
                <option value="7d">Últimos 7 dias</option>
                <option value="30d">Últimos 30 dias</option>
                <option value="custom">Período personalizado</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Símbolo</label>
              <select
                value={selectedSymbol}
                onChange={(e) => setSelectedSymbol(e.target.value)}
                className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-custom-cyan focus:border-custom-cyan"
              >
                <option value="">Todos os símbolos</option>
                {uniqueSymbols.map(symbol => (
                  <option key={symbol} value={symbol}>{symbol}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Exchange</label>
              <select
                value={selectedExchange}
                onChange={(e) => setSelectedExchange(e.target.value)}
                className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-custom-cyan focus:border-custom-cyan"
              >
                <option value="">Todas as exchanges</option>
                {uniqueExchanges.map(exchange => (
                  <option key={exchange} value={exchange}>{exchange}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Resultado</label>
              <select
                value={profitFilter}
                onChange={(e) => setProfitFilter(e.target.value)}
                className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-custom-cyan focus:border-custom-cyan"
              >
                <option value="all">Todos os resultados</option>
                <option value="profit">Apenas lucros</option>
                <option value="loss">Apenas prejuízos</option>
              </select>
            </div>
          </div>

          {/* Linha 2: Filtros de data (quando período personalizado está selecionado) */}
          {filter === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
            </div>
          )}

          {/* Linha 3: Busca e ordenação */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Buscar</label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por símbolo ou exchange..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 pl-10 focus:ring-custom-cyan focus:border-custom-cyan"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Ordenar por</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-custom-cyan focus:border-custom-cyan"
              >
                <option value="finalizedAt">Data de finalização</option>
                <option value="createdAt">Data de criação</option>
                <option value="profitLossUsd">Lucro (USD)</option>
                <option value="profitLossPercent">Lucro (%)</option>
                <option value="symbol">Símbolo</option>
                <option value="quantity">Quantidade</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Ordem</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-custom-cyan focus:border-custom-cyan"
              >
                <option value="desc">Decrescente</option>
                <option value="asc">Crescente</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo baseado na aba ativa */}
      {activeTab === 'table' && (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white">Operações Finalizadas</h3>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-custom-cyan mx-auto"></div>
              <p className="text-gray-400 mt-2">Carregando...</p>
            </div>
          ) : currentOperations.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-400">Nenhuma operação encontrada para os filtros selecionados.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Símbolo</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Quantidade</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Entrada</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Saída</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Resultado</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Duração</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Data</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {currentOperations.map((operation) => {
                      const duration = new Date(operation.finalizedAt).getTime() - new Date(operation.createdAt).getTime();
                      const durationHours = duration / (1000 * 60 * 60);
                      
                      return (
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
                            {formatTime(durationHours)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                            {formatDate(operation.finalizedAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <button
                              onClick={() => handleDeleteClick(operation)}
                              disabled={deletingId === operation.id}
                              className="text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors p-1 rounded hover:bg-red-400/10"
                              title="Excluir operação"
                            >
                              {deletingId === operation.id ? (
                                <div className="animate-spin h-4 w-4 border-2 border-red-400 border-t-transparent rounded-full"></div>
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-700 flex items-center justify-between">
                  <div className="text-sm text-gray-400">
                    Mostrando {startIndex + 1} a {Math.min(endIndex, filteredOperations.length)} de {filteredOperations.length} operações
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"
                    >
                      Anterior
                    </button>
                    <span className="px-3 py-1 text-gray-400">
                      {currentPage} de {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Aba de Gráfico */}
      {activeTab === 'chart' && (
        <div className="space-y-4">
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">Período do Gráfico</h3>
              <div className="flex gap-2">
                {(['7d', '30d', '90d', 'all'] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setChartPeriod(period)}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                      chartPeriod === period
                        ? 'bg-custom-cyan text-black font-semibold'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {period === 'all' ? 'Todos' : period.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <HistoryChart operations={operations} period={chartPeriod} />
        </div>
      )}

      {/* Aba de Análise */}
      {activeTab === 'analysis' && (
        <SymbolAnalysis operations={operations} />
      )}
        </div>
      </main>
      
      {/* Modal de Confirmação de Exclusão */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={cancelDeleteOperation}
        onConfirm={confirmDeleteOperation}
        title="Excluir Operação"
        message={
          operationToDelete 
            ? `Tem certeza que deseja excluir a operação ${operationToDelete.symbol}? Esta ação não pode ser desfeita.`
            : 'Tem certeza que deseja excluir esta operação?'
        }
        confirmText="Excluir"
        cancelText="Cancelar"
        type="danger"
        loading={deletingId === operationToDelete?.id}
      />
    </div>
  );
} 