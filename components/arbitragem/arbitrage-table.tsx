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

interface ArbitrageOpportunity {
    type: 'arbitrage';
    baseSymbol: string; 
    profitPercentage: number;
    buyAt: {
        exchange: string;
        price: number;
        marketType: 'spot' | 'futures';
    };
    sellAt: {
        exchange: string;
        price: number;
        marketType: 'spot' | 'futures';
    };
    arbitrageType: string;
    timestamp: number;
    maxSpread24h?: number;
}

export default function ArbitrageTable({ exchangeConfig }: ArbitrageTableProps) {
    const [minSpread, setMinSpread] = useState<number>(0.1); // 0.1%
    const [minValue, setMinValue] = useState<number>(100); // $100
    const { opportunities, connectionStatus } = useArbitrageWebSocket();

    console.log('🔍 [TABELA] Dados recebidos:', opportunities.length, 'oportunidades');
    console.log('📊 [TABELA] Status conexão:', connectionStatus);

    // Simplificado para evitar problemas com Array.filter
    const getFilteredOpportunities = (): ArbitrageOpportunity[] => {
        const filtered: ArbitrageOpportunity[] = [];
        
        for (let i = 0; i < opportunities.length; i++) {
            const opp = opportunities[i];
            if (opp && opp.profitPercentage >= minSpread) {
                const minValueCalc = calculateMinValue(opp.buyAt.price);
                if (minValueCalc >= minValue) {
                    filtered.push(opp);
                }
            }
        }
        
        // Ordenar manualmente
        for (let i = 0; i < filtered.length - 1; i++) {
            for (let j = i + 1; j < filtered.length; j++) {
                if (filtered[i].profitPercentage < filtered[j].profitPercentage) {
                    const temp: ArbitrageOpportunity = filtered[i];
                    filtered[i] = filtered[j];
                    filtered[j] = temp;
                }
            }
        }
        
        return filtered;
    };

    const filteredOpportunities = getFilteredOpportunities();

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
                    <label className="block text-sm font-medium mb-1 text-white">
                        Spread Mínimo (%)
                    </label>
                    <input
                        type="number"
                        value={minSpread}
                        onChange={(e) => setMinSpread(Number(e.target.value))}
                        className="p-2 rounded bg-gray-700 text-white border border-gray-600"
                        step="0.1"
                        min="0"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1 text-white">
                        Valor Mínimo ($)
                    </label>
                    <input
                        type="number"
                        value={minValue}
                        onChange={(e) => setMinValue(Number(e.target.value))}
                        className="p-2 rounded bg-gray-700 text-white border border-gray-600"
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
                        <th className="px-4 py-2 text-left text-white">Par</th>
                        <th className="px-4 py-2 text-left text-white">Compra ({exchangeConfig.spot})</th>
                        <th className="px-4 py-2 text-left text-white">Venda ({exchangeConfig.futures})</th>
                        <th className="px-4 py-2 text-left text-white">Spread Atual</th>
                        <th className="px-4 py-2 text-left text-white">Spread Máx. 24h</th>
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
                        (() => {
                            const rows: React.JSX.Element[] = [];
                            for (let i = 0; i < filteredOpportunities.length; i++) {
                                const opp = filteredOpportunities[i];
                                rows.push(
                                    <tr key={`${opp.baseSymbol}-${opp.timestamp}-${i}`} className="border-t border-gray-700 hover:bg-gray-750">
                                        <td className="px-4 py-2 font-medium text-white">{opp.baseSymbol}</td>
                                        <td className="px-4 py-2">
                                            <div className="text-sm">
                                                <div className="font-medium text-white">${formatPrice(opp.buyAt.price)}</div>
                                                <div className="text-gray-400 text-xs">
                                                    {opp.buyAt.exchange} ({opp.buyAt.marketType})
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2">
                                            <div className="text-sm">
                                                <div className="font-medium text-white">${formatPrice(opp.sellAt.price)}</div>
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
                                );
                            }
                            return rows;
                        })()
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