import React from 'react';

interface ExchangeConfig {
    spot: string;
    futures: string;
}

interface ExchangeSelectorProps {
    currentConfig: ExchangeConfig;
    onConfigChange: (newConfig: ExchangeConfig) => void;
}

export function ExchangeSelector({ currentConfig, onConfigChange }: ExchangeSelectorProps) {
    const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const value = event.target.value;
        
        if (value === "gate_mexc") {
            onConfigChange({ spot: "GATE_SPOT", futures: "MEXC_FUTURES" });
        } else if (value === "mexc_gate") {
            onConfigChange({ spot: "MEXC_SPOT", futures: "GATE_FUTURES" });
        }
    };

    const getCurrentValue = () => {
        if (currentConfig.spot === "GATE_SPOT" && currentConfig.futures === "MEXC_FUTURES") {
            return "gate_mexc";
        } else if (currentConfig.spot === "MEXC_SPOT" && currentConfig.futures === "GATE_FUTURES") {
            return "mexc_gate";
        }
        return "gate_mexc"; // default
    };

    return (
        <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-white">Combinação de Exchanges:</label>
            <select
                value={getCurrentValue()}
                onChange={handleChange}
                className="w-[300px] px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <option value="gate_mexc">Gate.io (Spot) → MEXC (Futures)</option>
                <option value="mexc_gate">MEXC (Spot) → Gate.io (Futures)</option>
            </select>
        </div>
    );
} 