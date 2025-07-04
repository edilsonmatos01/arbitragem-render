'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/dashboard/sidebar';
import ArbitrageHistoryChart from '@/components/dashboard/arbitrage-history-chart';
import TotalBalanceCard from '@/components/dashboard/total-balance-card';
import StaticMetrics from '@/components/dashboard/static-metrics';
import EnhancedPercentageGauge from '@/components/dashboard/enhanced-percentage-gauge';
import { LayoutDashboard, Repeat, Wallet, History, Settings, AlertCircle, TrendingUp } from 'lucide-react';

// Ícones Lucide com estilo
const iconProps = { className: "h-5 w-5" };
const AppIcons = {
  LayoutDashboard: <LayoutDashboard {...iconProps} />,
  Repeat: <Repeat {...iconProps} />,
  TrendingUp: <TrendingUp {...iconProps} />,
  Wallet: <Wallet {...iconProps} />,
  History: <History {...iconProps} />,
  Settings: <Settings {...iconProps} />,
};

export default function DashboardPage() {
  const [error, setError] = useState<string | null>(null);

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
        <header className="mb-8">
          <h1 className="text-3xl font-semibold text-white">Dashboard</h1>
          <p className="text-custom-cyan">Visão geral do sistema de arbitragem - Dados estáticos</p>
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

        {/* Seção de Saldo Total */}
        <section className="mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <TotalBalanceCard />
            <div className="lg:col-span-3">
              <div className="bg-dark-card p-6 rounded-lg shadow h-full flex flex-col justify-center">
                <h2 className="text-xl font-semibold text-white mb-2">Sistema de Arbitragem</h2>
                <p className="text-gray-400 mb-4">
                  Plataforma otimizada para identificação e execução de oportunidades de arbitragem 
                  entre múltiplas exchanges de criptomoedas.
                </p>
                                 <div className="flex items-center gap-4 text-sm">
                   <div className="flex items-center gap-2">
                     <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                     <span className="text-green-400">Sistema Ativo</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                     <span className="text-blue-400">4 Exchanges Conectadas</span>
                   </div>
                 </div>
              </div>
            </div>
          </div>
        </section>

        {/* Seção de Métricas */}
        <section className="mb-8">
          <StaticMetrics />
        </section>

        {/* Seção de Gráfico e Performance */}
        <section className="mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-dark-card p-6 rounded-lg shadow">
              <ArbitrageHistoryChart />
            </div>
            <div className="bg-dark-card p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold text-white mb-4">Performance Acumulada</h2>
              <EnhancedPercentageGauge />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
} 