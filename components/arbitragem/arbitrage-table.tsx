"use client";
import React, { useEffect, useState } from 'react';
import { useArbitrageWebSocket } from './useArbitrageWebSocket';
import { MaxSpreadCell } from './MaxSpreadCell';

interface ExchangeConfig {
    spot: string;
    futures: string;
}

interface ArbitrageTableProps {
    exchangeConfig: ExchangeConfig;
}

interface SpreadData {
    symbol: string;
    spotExchange: string;
    futuresExchange: string;
    spotAsk: number;
    spotBid: number;
    futuresAsk: number;
    futuresBid: number;
    spread: number;
    maxSpread: number;
    timestamp: number;
}

export default function ArbitrageTable({ exchangeConfig }: ArbitrageTableProps) {
    const [opportunities, setOpportunities] = useState<SpreadData[]>([]);
    const [minSpread, setMinSpread] = useState<number>(0.1); // 0.1%
    const [minValue, setMinValue] = useState<number>(100); // $100
    const { ws } = useArbitrageWebSocket();

    useEffect(() => {
        if (!ws) return;

        // Envia a configuração atual para o servidor
        ws.send(JSON.stringify({
            type: 'config-update',
            exchangeConfig
        }));

        const handleMessage = (event: MessageEvent) => {
            try {
                const message = JSON.parse(event.data);

                if (message.type === 'spread-update') {
                    const newData = message.data as SpreadData;
                    
                    setOpportunities(prev => {
                        const index = prev.findIndex(item => item.symbol === newData.symbol);
                        if (index >= 0) {
                            const updated = [...prev];
                            updated[index] = newData;
                            return updated;
                        }
                        return [...prev, newData];
                    });
                }
            } catch (error) {
                console.error('Erro ao processar mensagem:', error);
            }
        };

        ws.addEventListener('message', handleMessage);

        return () => {
            ws.removeEventListener('message', handleMessage);
        };
    }, [ws, exchangeConfig]);

    const filteredOpportunities = opportunities
        .filter(opp => opp.spread >= minSpread)
        .filter(opp => calculateMinValue(opp.spotAsk) >= minValue)
        .sort((a, b) => b.spread - a.spread);

    const calculateMinValue = (price: number) => {
        // Assume um tamanho mínimo de ordem de 0.001 BTC ou equivalente
        return price * 0.001;
    };

    return (
        <div className="overflow-x-auto">
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
            </div>

            <table className="min-w-full bg-gray-800 rounded-lg overflow-hidden">
                <thead className="bg-gray-700">
                    <tr>
                        <th className="px-4 py-2">Par</th>
                        <th className="px-4 py-2">Compra (Spot)</th>
                        <th className="px-4 py-2">Venda (Futures)</th>
                        <th className="px-4 py-2">Spread Atual</th>
                        <th className="px-4 py-2">Spread Máx. 24h</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredOpportunities.map((opp) => (
                        <tr key={opp.symbol} className="border-t border-gray-700">
                            <td className="px-4 py-2">{opp.symbol}</td>
                            <td className="px-4 py-2">
                                {opp.spotAsk.toFixed(8)} ({opp.spotExchange})
                            </td>
                            <td className="px-4 py-2">
                                {opp.futuresBid.toFixed(8)} ({opp.futuresExchange})
                            </td>
                            <td className="px-4 py-2">
                                <span className={opp.spread >= 0.5 ? 'text-green-400' : ''}>
                                    {opp.spread.toFixed(3)}%
                                </span>
                            </td>
                            <td className="px-4 py-2">
                                <MaxSpreadCell maxSpread={opp.maxSpread} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
} 