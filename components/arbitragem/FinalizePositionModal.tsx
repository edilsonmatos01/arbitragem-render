'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

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
  const [spotExitPrice, setSpotExitPrice] = useState('');
  const [futuresExitPrice, setFuturesExitPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Limpa os campos quando o modal abre
  useEffect(() => {
    if (isOpen && position) {
      setSpotExitPrice('');
      setFuturesExitPrice('');
      setError(null);
    }
  }, [isOpen, position]);

  const calculatePnL = () => {
    const spotExit = parseFloat(spotExitPrice);
    const futuresExit = parseFloat(futuresExitPrice);
    
    if (!position || !spotExitPrice || !futuresExitPrice || spotExit <= 0 || futuresExit <= 0) {
      return { spotPnL: 0, futuresPnL: 0, totalPnL: 0, percentPnL: 0 };
    }

    // ✅ Fórmula de Lucro (PnL) em Dólar:
    // PnL = (Preço de Saída - Preço de Entrada) × Quantidade
    
    // PnL Spot: venda do ativo comprado
    const spotPnL = (spotExit - position.spotEntry) * position.quantity;
    
    // PnL Futures: recompra do ativo vendido (posição short)
    const futuresPnL = (position.futuresEntry - futuresExit) * position.quantity;
    
    // PnL Total
    const totalPnL = spotPnL + futuresPnL;

    // ✅ Fórmula atualizada para Percentual Total:
    // Percentual = (Lucro Total / Spot Entry × Quantidade) × 100
    const investedOnlyInSpot = position.spotEntry * position.quantity;
    const percentPnL = investedOnlyInSpot > 0 ? (totalPnL / investedOnlyInSpot) * 100 : 0;

    return { spotPnL, futuresPnL, totalPnL, percentPnL };
  };

  const handleSubmit = async () => {
    if (!position) return;

    const spotExit = parseFloat(spotExitPrice);
    const futuresExit = parseFloat(futuresExitPrice);

    // Validações
    if (!spotExitPrice || !futuresExitPrice || spotExit <= 0 || futuresExit <= 0) {
      setError('Por favor, preencha todos os preços de saída com valores válidos');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onFinalize({
        spotExitPrice: spotExit,
        futuresExitPrice: futuresExit
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
      setSpotExitPrice('');
      setFuturesExitPrice('');
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
          <DialogTitle className="text-white">Finalizar Posição - {position.symbol}</DialogTitle>
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
                <p className="text-white font-medium">${position.spotEntry}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Futures (Entrada)</p>
                <p className="text-white font-medium">${position.futuresEntry}</p>
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
                  onChange={(e) => setSpotExitPrice(e.target.value)}
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
                  onChange={(e) => setFuturesExitPrice(e.target.value)}
                  className="w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-custom-cyan focus:border-custom-cyan"
                  placeholder={`Atual: $${currentFuturesPrice.toFixed(4)}`}
                  required
                />
                <p className="text-xs text-gray-400 mt-1">
                  Preço atual sugerido: ${currentFuturesPrice.toFixed(4)}
                </p>
              </div>
            </div>

            {/* PnL em tempo real - aparece assim que preencher um dos campos */}
            {(spotExitPrice || futuresExitPrice) && (
              <div className="mt-4 p-3 bg-gray-700/50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Resultado Parcial:</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-400">Spot PnL:</p>
                    <p className={`font-medium ${spotPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {spotPnL >= 0 ? '+' : ''}${spotPnL.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Futures PnL:</p>
                    <p className={`font-medium ${futuresPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {futuresPnL >= 0 ? '+' : ''}${futuresPnL.toFixed(2)}
                    </p>
                  </div>
                </div>
                {parseFloat(spotExitPrice) > 0 && parseFloat(futuresExitPrice) > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-600">
                    <p className="text-gray-400 text-sm">Total PnL:</p>
                    <p className={`text-lg font-bold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)} ({percentPnL >= 0 ? '+' : ''}{percentPnL.toFixed(2)}%)
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>



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
              disabled={isSubmitting || !spotExitPrice || !futuresExitPrice || parseFloat(spotExitPrice) <= 0 || parseFloat(futuresExitPrice) <= 0}
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