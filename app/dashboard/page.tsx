'use client';

import { useState } from 'react';
import Sidebar from '@/components/dashboard/sidebar';
import MetricCard from '@/components/dashboard/metric-card';
import ArbitrageHistoryChart from '@/components/dashboard/arbitrage-history-chart';
import AccumulatedPercentageGauge from '@/components/dashboard/accumulated-percentage-gauge';
import TotalBalanceCard from '@/components/dashboard/total-balance-card';
import { LayoutDashboard, Repeat, Wallet, History, Settings, AlertCircle, RefreshCw } from 'lucide-react';

// Ícones Lucide com estilo
const iconProps = { className: "h-5 w-5" };
const AppIcons = {
  LayoutDashboard: <LayoutDashboard {...iconProps} />,
  Repeat: <Repeat {...iconProps} />,
  Wallet: <Wallet {...iconProps} />,
  History: <History {...iconProps} />,
  Settings: <Settings {...iconProps} />,
};

interface Balance {
  asset: string;
  free: string;
  locked: string;
}

interface BinanceAccountInfo {
  balances: Balance[];
  // Adicione outros campos que você espera da resposta da Binance se necessário
}

interface BybitWalletCoinInfo {
  coin: string;
  walletBalance: string;
  totalOrderIM?: string;
  equity?: string;
  usdValue?: string;
  borrowAmount?: string;
  availableToBorrow?: string;
  availableToWithdraw?: string;
  accruedInterest?: string;
  totalOrderMargin?: string;
  cumRealisedPnl?: string;
  freeCollateral?: string;
}

interface BybitResponse {
  retCode: number;
  retMsg: string;
  result: {
    list: BybitWalletCoinInfo[];
  };
}

export default function DashboardPage() {
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const metrics = [
    { title: 'Lucro Total ($)', value: '0.00' },
    { title: 'Nº. Oportunidades', value: '78' },
    { title: 'Spread Médio (%)', value: '0.45%' },
  ];

  const sidebarNavItems = [
    { title: 'Dashboard', href: '/dashboard', icon: AppIcons.LayoutDashboard },
    { title: 'Arbitragem', href: '/arbitragem', icon: AppIcons.Repeat },
    { title: 'Carteiras', href: '/carteiras', icon: AppIcons.Wallet },
    { title: 'Históricos', href: '/historicos', icon: AppIcons.History },
    { title: 'Configurações', href: '/configuracoes', icon: AppIcons.Settings },
  ];

  const handleRefresh = () => {
    setIsRefreshing(true);
  };

  const handleRefreshComplete = () => {
    setIsRefreshing(false);
  };

  return (
    <div className="flex min-h-screen bg-dark-bg text-white">
      <Sidebar
        user={{ 
          name: 'Edilson Matos', 
          imageUrl: '/images/avatar.png.png'
        }}
        navItems={sidebarNavItems}
      />
      <main className="flex-1 p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold text-white">Dashboard</h1>
          <p className="text-custom-cyan">Visão geral do sistema de arbitragem</p>
        </header>

        {error && (
          <div className="mb-4 p-4 bg-red-800 border border-red-600 text-white rounded-md flex items-center">
            <AlertCircle className="h-5 w-5 mr-3 text-red-300 flex-shrink-0" />
            <div>
              <p className="font-semibold">Erro ao carregar dados:</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <TotalBalanceCard />
          {metrics.map((metric) => (
            <MetricCard key={metric.title} title={metric.title} value={metric.value} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-dark-card p-6 rounded-lg shadow">
            <ArbitrageHistoryChart />
          </div>
          <div className="bg-dark-card p-6 rounded-lg shadow flex flex-col items-center justify-center">
            <AccumulatedPercentageGauge percentage={10} />
          </div>
        </div>

        <section>
          {/* A seção de oportunidades foi removida para centralizar a lógica na página de Arbitragem */}
        </section>
      </main>
    </div>
  );
} 