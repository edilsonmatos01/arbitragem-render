'use client';

import React from 'react';

// Componente simplificado da tabela
function SimpleArbitrageTable() {
  const staticData = [
    {
      pair: 'BTC/USDT',
      buyExchange: 'GATEIO',
      buyPrice: 97250.50,
      sellExchange: 'MEXC', 
      sellPrice: 98075.25,
      spread: 0.85
    },
    {
      pair: 'ETH/USDT',
      buyExchange: 'MEXC',
      buyPrice: 3425.80,
      sellExchange: 'GATEIO',
      sellPrice: 3441.25,
      spread: 0.45
    },
    {
      pair: 'SOL/USDT',
      buyExchange: 'GATEIO',
      buyPrice: 185.40,
      sellExchange: 'MEXC',
      sellPrice: 187.72,
      spread: 1.25
    }
  ];

  return (
    <div className="overflow-x-auto">
      <h2 className="text-2xl font-bold text-white mb-6">Oportunidades encontradas</h2>
      
      <div className="mb-4 text-sm text-green-400">
        🟢 Sistema funcionando - 3 oportunidades ativas
      </div>

      <table className="min-w-full bg-gray-800 rounded-lg overflow-hidden">
        <thead className="bg-gray-700">
          <tr>
            <th className="px-4 py-2 text-left text-white">Par</th>
            <th className="px-4 py-2 text-left text-white">Compra</th>
            <th className="px-4 py-2 text-left text-white">Venda</th>
            <th className="px-4 py-2 text-left text-white">Spread</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-gray-700">
            <td className="px-4 py-2 font-medium text-white">BTC/USDT</td>
            <td className="px-4 py-2 text-white">
              GATEIO: $97,250.50
            </td>
            <td className="px-4 py-2 text-white">
              MEXC: $98,075.25
            </td>
            <td className="px-4 py-2">
              <span className="font-medium text-green-400">0.85%</span>
            </td>
          </tr>
          <tr className="border-t border-gray-700">
            <td className="px-4 py-2 font-medium text-white">ETH/USDT</td>
            <td className="px-4 py-2 text-white">
              MEXC: $3,425.80
            </td>
            <td className="px-4 py-2 text-white">
              GATEIO: $3,441.25
            </td>
            <td className="px-4 py-2">
              <span className="font-medium text-yellow-400">0.45%</span>
            </td>
          </tr>
          <tr className="border-t border-gray-700">
            <td className="px-4 py-2 font-medium text-white">SOL/USDT</td>
            <td className="px-4 py-2 text-white">
              GATEIO: $185.40
            </td>
            <td className="px-4 py-2 text-white">
              MEXC: $187.72
            </td>
            <td className="px-4 py-2">
              <span className="font-medium text-green-400">1.25%</span>
            </td>
          </tr>
        </tbody>
      </table>
      
      <div className="mt-4 text-xs text-gray-500">
        Sistema em modo estático - Última atualização: {new Date().toLocaleTimeString('pt-BR')}
      </div>
    </div>
  );
}

// Componente simplificado do seletor
function SimpleExchangeSelector() {
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-white mb-2">
        Combinação de Exchanges:
      </label>
      <div className="px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md">
        Gate.io (Spot) → MEXC (Futures)
      </div>
    </div>
  );
}

// Sidebar simplificada
function SimpleSidebar() {
  return (
    <div className="w-64 bg-gray-900 p-6">
      <div className="mb-8">
        <h2 className="text-xl font-bold text-white">Robo Arbitragem</h2>
      </div>
      
      <nav className="space-y-2">
        <div className="px-3 py-2 bg-blue-600 text-white rounded">
          📊 Arbitragem
        </div>
        <div className="px-3 py-2 text-gray-400 hover:text-white cursor-pointer">
          📈 Dashboard
        </div>
        <div className="px-3 py-2 text-gray-400 hover:text-white cursor-pointer">
          💰 Carteiras
        </div>
      </nav>
      
      <div className="mt-8 pt-4 border-t border-gray-700">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm">
            E
          </div>
          <div className="ml-3">
            <div className="text-sm font-medium text-white">Edilson Matos</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ArbitragemPage() {
  return (
    <div className="flex min-h-screen bg-gray-900 text-white">
      <SimpleSidebar />
      <main className="flex-1 p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold text-white">Arbitragem</h1>
          <p className="text-blue-400">Oportunidades de arbitragem em tempo real</p>
        </header>
        
        <SimpleExchangeSelector />
        <SimpleArbitrageTable />
      </main>
    </div>
  );
} 