import React from 'react';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "../ui/select";

interface ExchangeConfig {
    spot: string;
    futures: string;
}

interface ExchangeSelectorProps {
    currentConfig: ExchangeConfig;
    onConfigChange: (newConfig: ExchangeConfig) => void;
}

export function ExchangeSelector({ currentConfig, onConfigChange }: ExchangeSelectorProps) {
    const combinations = [
        {
            label: "Gate.io (Spot) → MEXC (Futures)",
            value: "gate_mexc",
            config: { spot: "GATE_SPOT", futures: "MEXC_FUTURES" }
        },
        {
            label: "MEXC (Spot) → Gate.io (Futures)",
            value: "mexc_gate",
            config: { spot: "MEXC_SPOT", futures: "GATE_FUTURES" }
        }
    ];

    const getCurrentValue = () => {
        const current = combinations.find(
            combo => combo.config.spot === currentConfig.spot && combo.config.futures === currentConfig.futures
        );
        return current?.value || combinations[0].value;
    };

    return (
        <div className="flex items-center space-x-4">
            <label className="text-sm font-medium">Combinação de Exchanges:</label>
            <Select
                value={getCurrentValue()}
                onValueChange={(value) => {
                    const selected = combinations.find(combo => combo.value === value);
                    if (selected) {
                        onConfigChange(selected.config);
                    }
                }}
            >
                <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder="Selecione a combinação" />
                </SelectTrigger>
                <SelectContent>
                    {combinations.map((combo) => (
                        <SelectItem key={combo.value} value={combo.value}>
                            {combo.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
} 