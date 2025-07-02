"use client";

import React, { useState } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, DollarSign, Play, Zap } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ConfirmOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (isRealOrder: boolean) => void;
  orderData: {
    symbol: string;
    quantity: number;
    spotExchange: string;
    futuresExchange: string;
    spotPrice: number;
    futuresPrice: number;
    spread: number;
    estimatedProfit: number;
  } | null;
  isLoading: boolean;
}

export default function ConfirmOrderModal({
  isOpen,
  onClose,
  onConfirm,
  orderData,
  isLoading
}: ConfirmOrderModalProps) {
  const [orderType, setOrderType] = useState<'simulada' | 'real'>('simulada');

  if (!orderData) return null;

  const totalValue = orderData.quantity * orderData.spotPrice;

  const handleConfirm = () => {
    onConfirm(orderType === 'real');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-gray-900 text-white">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            Confirmar Execução de Ordens
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Seleção do Tipo de Ordem */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-white font-medium mb-3">Tipo de Ordem:</h3>
            <div className="space-y-3">
              {/* Ordem Simulada */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="orderType"
                  value="simulada"
                  checked={orderType === 'simulada'}
                  onChange={(e) => setOrderType(e.target.value as 'simulada' | 'real')}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 focus:ring-blue-500"
                />
                <div className="flex items-center gap-2">
                  <Play className="h-4 w-4 text-blue-400" />
                  <div>
                    <span className="text-blue-400 font-medium">Ordem Simulada</span>
                    <p className="text-gray-400 text-xs">Apenas para teste, sem execução real</p>
                  </div>
                </div>
              </label>

              {/* Ordem Real */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="orderType"
                  value="real"
                  checked={orderType === 'real'}
                  onChange={(e) => setOrderType(e.target.value as 'simulada' | 'real')}
                  className="w-4 h-4 text-red-600 bg-gray-700 border-gray-600 focus:ring-red-500"
                />
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-red-400" />
                  <div>
                    <span className="text-red-400 font-medium">Ordem Real</span>
                    <p className="text-gray-400 text-xs">Execução real nas exchanges</p>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Aviso para Ordens Reais */}
          {orderType === 'real' && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-md p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <span className="text-red-400 font-medium text-sm">Atenção - Ordem Real!</span>
              </div>
              <p className="text-red-300 text-xs">
                Esta ordem será executada com dinheiro real nas exchanges. Verifique todos os dados antes de confirmar.
              </p>
            </div>
          )}

          {/* Aviso para Ordens Simuladas */}
          {orderType === 'simulada' && (
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-md p-3">
              <div className="flex items-center gap-2 mb-2">
                <Play className="h-4 w-4 text-blue-400" />
                <span className="text-blue-400 font-medium text-sm">Modo Simulação</span>
              </div>
              <p className="text-blue-300 text-xs">
                Esta é uma simulação. Nenhuma ordem real será executada nas exchanges.
              </p>
            </div>
          )}

          {/* Detalhes da Operação */}
          <div className="bg-gray-800 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Par:</span>
              <span className="font-bold text-white">{orderData.symbol}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Quantidade:</span>
              <span className="font-bold text-white">{orderData.quantity.toFixed(6)}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-300">Valor Total:</span>
              <span className="font-bold text-white">${totalValue.toFixed(2)}</span>
            </div>

            <hr className="border-gray-700" />

            {/* Operação Spot */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-400" />
                <span className="text-green-400 font-medium">Compra Spot</span>
              </div>
              <div className="ml-6 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Exchange:</span>
                  <span className="text-white">{orderData.spotExchange.toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Preço:</span>
                  <span className="text-white">${orderData.spotPrice.toFixed(4)}</span>
                </div>
              </div>
            </div>

            {/* Operação Futures */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-400" />
                <span className="text-red-400 font-medium">Venda Futures</span>
              </div>
              <div className="ml-6 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Exchange:</span>
                  <span className="text-white">{orderData.futuresExchange.toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Preço:</span>
                  <span className="text-white">${orderData.futuresPrice.toFixed(4)}</span>
                </div>
              </div>
            </div>

            <hr className="border-gray-700" />

            {/* Resumo do Spread */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Spread:</span>
                <span className={`font-bold ${orderData.spread > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {orderData.spread.toFixed(2)}%
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Lucro Estimado:</span>
                <div className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4 text-green-400" />
                  <span className="font-bold text-green-400">
                    ${orderData.estimatedProfit.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className={`flex-1 px-4 py-2 text-white font-bold rounded-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                orderType === 'real' 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {orderType === 'real' ? 'Executando...' : 'Simulando...'}
                </>
              ) : (
                <>
                  {orderType === 'real' ? (
                    <>
                      <Zap className="h-4 w-4" />
                      Executar Ordem Real
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Simular Ordem
                    </>
                  )}
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 