"use client";
import React, { useState } from 'react';
import { useArbitrageWebSocket } from './useArbitrageWebSocket';
import { MaxSpreadCell } from './MaxSpreadCell';

interface ExchangeConfig {
    spot: string;
    futures: string;
}

interface ArbitrageTableProps {
    exchangeConfig: ExchangeConfig;
}

export default function ArbitrageTable({ exchangeConfig }: ArbitrageTableProps) {
    const [minSpread, setMinSpread] = useState<number>(0.1); // 0.1%
    const [minValue, setMinValue] = useState<number>(100); // $100
    const { opportunities, connectionStatus } = useArbitrageWebSocket();

    console.log('🔍 [TABELA] Dados recebidos:', opportunities.length, 'oportunidades');
    console.log('📊 [TABELA] Status conexão:', connectionStatus);

    const filteredOpportunities = opportunities
        .filter(opp => opp.profitPercentage >= minSpread)
        .filter(opp => calculateMinValue(opp.buyAt.price) >= minValue)
        .sort((a, b) => b.profitPercentage - a.profitPercentage);

    const calculateMinValue = (price: number) => {
        // Assume um tamanho mínimo de ordem de 0.001 BTC ou equivalente
        return price * 0.001;
    };

    const formatPrice = (price: number) => {
        if (price > 1000) return price.toFixed(2);
        if (price > 1) return price.toFixed(4);
        return price.toFixed(8);
    };

    return (
        <div className="overflow-x-auto">
            {/* Título da seção */}
            <h2 className="text-2xl font-bold text-white mb-6">Oportunidades encontradas</h2>
            
            <div className="mb-4 flex space-x-4">
                <div>
                    <label className="block text-sm font-medium mb-1">
                        Spread Mínimo (%)
                    </label>
                    <input
                        type="number"
                        value={minSpread}
                        onChange={(e) => setMinSpread(Number(e.target.value))}
                        className="p-2 rounded bg-gray-700 text-white"
                        step="0.1"
                        min="0"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">
                        Valor Mínimo ($)
                    </label>
                    <input
                        type="number"
                        value={minValue}
                        onChange={(e) => setMinValue(Number(e.target.value))}
                        className="p-2 rounded bg-gray-700 text-white"
                        step="10"
                        min="0"
                    />
                </div>
                <div className="flex items-end">
                    <div className="text-sm">
                        <div className={`px-2 py-1 rounded ${connectionStatus === 'connected' ? 'bg-green-600' : 'bg-yellow-600'}`}>
                            {connectionStatus === 'connected' ? '🟢 Conectado' : '🟡 Simulando'}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mb-2 text-sm text-gray-400">
                Exibindo {filteredOpportunities.length} de {opportunities.length} oportunidades
            </div>

            <table className="min-w-full bg-gray-800 rounded-lg overflow-hidden">
                <thead className="bg-gray-700">
                    <tr>
                        <th className="px-4 py-2 text-left">Par</th>
                        <th className="px-4 py-2 text-left">Compra ({exchangeConfig.spot})</th>
                        <th className="px-4 py-2 text-left">Venda ({exchangeConfig.futures})</th>
                        <th className="px-4 py-2 text-left">Spread Atual</th>
                        <th className="px-4 py-2 text-left">Spread Máx. 24h</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredOpportunities.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                                {opportunities.length === 0 ? 'Carregando oportunidades...' : 'Nenhuma oportunidade encontrada com os filtros atuais'}
                            </td>
                        </tr>
                    ) : (
                        filteredOpportunities.map((opp, index) => (
                            <tr key={`${opp.baseSymbol}-${opp.timestamp}-${index}`} className="border-t border-gray-700 hover:bg-gray-750">
                                <td className="px-4 py-2 font-medium">{opp.baseSymbol}</td>
                                <td className="px-4 py-2">
                                    <div className="text-sm">
                                        <div className="font-medium">${formatPrice(opp.buyAt.price)}</div>
                                        <div className="text-gray-400 text-xs">
                                            {opp.buyAt.exchange} ({opp.buyAt.marketType})
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-2">
                                    <div className="text-sm">
                                        <div className="font-medium">${formatPrice(opp.sellAt.price)}</div>
                                        <div className="text-gray-400 text-xs">
                                            {opp.sellAt.exchange} ({opp.sellAt.marketType})
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-2">
                                    <span className={`font-medium ${opp.profitPercentage >= 0.5 ? 'text-green-400' : 'text-yellow-400'}`}>
                                        {opp.profitPercentage.toFixed(2)}%
                                    </span>
                                </td>
                                <td className="px-4 py-2">
                                    <MaxSpreadCell maxSpread={opp.maxSpread24h || 0} />
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
            
            {filteredOpportunities.length > 0 && (
                <div className="mt-4 text-xs text-gray-500">
                    Última atualização: {new Date().toLocaleTimeString('pt-BR')}
                </div>
            )}
        </div>
    );
} 