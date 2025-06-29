'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { X } from 'lucide-react';

interface Position {
  id: string;
  symbol: string;
  quantity: number;
  spotEntry: number;
  futuresEntry: number;
  spotExchange: string;
  futuresExchange: string;
  createdAt: Date | string;
}

interface FinalizePositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: Position | null;
  currentSpotPrice: number;
  currentFuturesPrice: number;
  onFinalize: (exitData: {
    spotExitPrice: number;
    futuresExitPrice: number;
  }) => Promise<void>;
}

export default function FinalizePositionModal({
  isOpen,
  onClose,
  position,
  currentSpotPrice,
  currentFuturesPrice,
  onFinalize
}: FinalizePositionModalProps) {
  const [spotExitPrice, setSpotExitPrice] = useState(0);
  const [futuresExitPrice, setFuturesExitPrice] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Atualiza os preços quando o modal abre
  useEffect(() => {
    if (isOpen && position) {
      setSpotExitPrice(currentSpotPrice);
      setFuturesExitPrice(currentFuturesPrice);
      setError(null);
    }
  }, [isOpen, position, currentSpotPrice, currentFuturesPrice]);

  const calculatePnL = () => {
    if (!position || spotExitPrice <= 0 || futuresExitPrice <= 0) {
      return { spotPnL: 0, futuresPnL: 0, totalPnL: 0, percentPnL: 0 };
    }

    // ✅ Fórmula de Lucro (PnL) em Dólar:
    // PnL = (Preço de Saída - Preço de Entrada) × Quantidade
    
    // PnL Spot: venda do ativo comprado
    const spotPnL = (spotExitPrice - position.spotEntry) * position.quantity;
    
    // PnL Futures: recompra do ativo vendido (posição short)
    const futuresPnL = (position.futuresEntry - futuresExitPrice) * position.quantity;
    
    // PnL Total
    const totalPnL = spotPnL + futuresPnL;

    // Cálculo do PnL percentual para referência
    const spotPnLPercent = position.spotEntry > 0 ? ((spotExitPrice - position.spotEntry) / position.spotEntry) * 100 : 0;
    const futuresPnLPercent = position.futuresEntry > 0 ? ((position.futuresEntry - futuresExitPrice) / position.futuresEntry) * 100 : 0;
    const percentPnL = spotPnLPercent + futuresPnLPercent;

    return { spotPnL, futuresPnL, totalPnL, percentPnL };
  };

  const handleSubmit = async () => {
    if (!position) return;

    // Validações
    if (spotExitPrice <= 0 || futuresExitPrice <= 0) {
      setError('Por favor, preencha todos os preços de saída');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onFinalize({
        spotExitPrice,
        futuresExitPrice
      });
      onClose();
    } catch (error) {
      console.error('Erro ao finalizar posição:', error);
      setError('Erro ao finalizar posição. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setSpotExitPrice(0);
      setFuturesExitPrice(0);
      setError(null);
      onClose();
    }
  };

  const { spotPnL, futuresPnL, totalPnL, percentPnL } = calculatePnL();

  if (!position) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl bg-gray-900 text-white">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle className="text-white">Finalizar Posição - {position.symbol}</DialogTitle>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações da Posição */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-3">Informações da Posição</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-400">Símbolo</p>
                <p className="text-white font-medium">{position.symbol}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Quantidade</p>
                <p className="text-white font-medium">{position.quantity.toFixed(4)} {position.symbol.split('/')[0]}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Exchange Spot</p>
                <p className="text-white font-medium">{position.spotExchange.toUpperCase()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Exchange Futures</p>
                <p className="text-white font-medium">{position.futuresExchange.toUpperCase()}</p>
              </div>
            </div>
          </div>

          {/* Preços de Entrada */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-white mb-3">Preços de Entrada</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-400">Spot (Entrada)</p>
                <p className="text-white font-medium">${position.spotEntry.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Futures (Entrada)</p>
                <p className="text-white font-medium">${position.futuresEntry.toFixed(4)}</p>
              </div>
            </div>
          </div>

          {/* Preços de Saída - OBRIGATÓRIO */}
          <div className="bg-gray-800 p-4 rounded-lg border-2 border-custom-cyan">
            <h3 className="text-lg font-semibold text-custom-cyan mb-3">
              Preços de Saída (Obrigatório) *
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Preço Spot Atual *
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={spotExitPrice}
                  onChange={(e) => setSpotExitPrice(Number(e.target.value))}
                  className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-custom-cyan focus:border-custom-cyan"
                  placeholder={`Atual: $${currentSpotPrice.toFixed(4)}`}
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  Preço atual sugerido: ${currentSpotPrice.toFixed(4)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Preço Futures Atual *
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={futuresExitPrice}
                  onChange={(e) => setFuturesExitPrice(Number(e.target.value))}
                  className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-custom-cyan focus:border-custom-cyan"
                  placeholder={`Atual: $${currentFuturesPrice.toFixed(4)}`}
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  Preço atual sugerido: ${currentFuturesPrice.toFixed(4)}
                </p>
              </div>
            </div>
          </div>

          {/* Previsão de Resultado */}
          {spotExitPrice > 0 && futuresExitPrice > 0 && (
            <div className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-white mb-3">Previsão de Resultado</h3>
              
              {/* Fórmula explicativa */}
              <div className="mb-4 p-3 bg-gray-700 rounded-lg">
                <p className="text-xs text-gray-300 mb-1">
                  ✅ <strong>Fórmula:</strong> PnL = (Preço de Saída - Preço de Entrada) × Quantidade
                </p>
                <div className="text-xs text-gray-400 space-y-1">
                  <p>• Spot: ({spotExitPrice.toFixed(4)} - {position.spotEntry.toFixed(4)}) × {position.quantity.toFixed(4)} = ${spotPnL.toFixed(2)}</p>
                  <p>• Futures: ({position.futuresEntry.toFixed(4)} - {futuresExitPrice.toFixed(4)}) × {position.quantity.toFixed(4)} = ${futuresPnL.toFixed(2)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">PnL Spot (Venda)</p>
                  <p className={`font-medium ${spotPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {spotPnL >= 0 ? '+' : ''}${spotPnL.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">PnL Futures (Recompra)</p>
                  <p className={`font-medium ${futuresPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {futuresPnL >= 0 ? '+' : ''}${futuresPnL.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Lucro/Prejuízo Total</p>
                  <p className={`text-lg font-bold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Percentual Total</p>
                  <p className={`text-lg font-bold ${percentPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {percentPnL >= 0 ? '+' : ''}{percentPnL.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Erro */}
          {error && (
            <div className="bg-red-900/20 border border-red-500 p-3 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || spotExitPrice <= 0 || futuresExitPrice <= 0}
              className="px-6 py-2 bg-custom-cyan hover:bg-custom-cyan/90 text-black font-bold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Finalizando...' : 'Finalizar Posição'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 