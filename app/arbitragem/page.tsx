'use client';

import React from 'react';
import ArbitrageTable from '@/components/arbitragem/arbitrage-table';
import { ExchangeSelector } from '@/components/arbitragem/exchange-selector';
import Sidebar from '@/components/dashboard/sidebar';
import { LayoutDashboard, Repeat, Wallet, History, Settings } from 'lucide-react';

const iconProps = { className: "h-5 w-5" };
const AppIcons = {
  LayoutDashboard: <LayoutDashboard {...iconProps} />,
  Repeat: <Repeat {...iconProps} />,
  Wallet: <Wallet {...iconProps} />,
  History: <History {...iconProps} />,
  Settings: <Settings {...iconProps} />,
};

const sidebarNavItems = [
  { title: 'Dashboard', href: '/dashboard', icon: AppIcons.LayoutDashboard },
  { title: 'Arbitragem', href: '/arbitragem', icon: AppIcons.Repeat },
  { title: 'Carteiras', href: '/carteiras', icon: AppIcons.Wallet },
  { title: 'Históricos', href: '/historicos', icon: AppIcons.History },
  { title: 'Configurações', href: '/configuracoes', icon: AppIcons.Settings },
];

export default function ArbitragemPage() {
  const [exchangeConfig, setExchangeConfig] = React.useState({
    spot: 'GATE_SPOT',
    futures: 'MEXC_FUTURES'
  });

  const handleConfigChange = (newConfig: { spot: string; futures: string }) => {
    setExchangeConfig(newConfig);
    // O WebSocket vai se reconectar automaticamente com a nova configuração
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
          <h1 className="text-3xl font-semibold text-white">Arbitragem</h1>
          <p className="text-custom-cyan">Oportunidades de arbitragem em tempo real</p>
        </header>
        <div className="mb-6">
          <ExchangeSelector
            currentConfig={exchangeConfig}
            onConfigChange={handleConfigChange}
          />
        </div>
        <ArbitrageTable exchangeConfig={exchangeConfig} />
      </main>
    </div>
  );
} 