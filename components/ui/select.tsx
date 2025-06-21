import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    value: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
}

export function Select({ value, onValueChange, children, ...props }: SelectProps) {
    return (
        <select
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            className="w-full bg-gray-700 text-white rounded-md p-2 focus:ring-2 focus:ring-custom-cyan focus:border-transparent"
            {...props}
        >
            {children}
        </select>
    );
}

export function SelectTrigger({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={`relative ${className}`} {...props}>
            {children}
        </div>
    );
}

export function SelectValue({ children }: { children: React.ReactNode }) {
    return <span>{children}</span>;
}

export function SelectContent({ children }: { children: React.ReactNode }) {
    return (
        <div className="absolute top-full left-0 w-full mt-1 bg-gray-700 rounded-md shadow-lg overflow-hidden">
            {children}
        </div>
    );
}

export function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
    return (
        <option value={value} className="px-4 py-2 hover:bg-gray-600 cursor-pointer">
            {children}
        </option>
    );
} 