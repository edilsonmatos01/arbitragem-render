"use client";

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'danger',
  loading = false
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const typeStyles = {
    danger: {
      icon: 'text-red-400',
      button: 'bg-red-600 hover:bg-red-700 text-white',
      border: 'border-red-500'
    },
    warning: {
      icon: 'text-yellow-400',
      button: 'bg-yellow-600 hover:bg-yellow-700 text-white',
      border: 'border-yellow-500'
    },
    info: {
      icon: 'text-blue-400',
      button: 'bg-blue-600 hover:bg-blue-700 text-white',
      border: 'border-blue-500'
    }
  };

  const currentStyle = typeStyles[type];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className={`h-6 w-6 ${currentStyle.icon}`} />
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-white disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <p className="text-gray-300 mb-6">{message}</p>
        
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-md transition-colors disabled:opacity-50 ${currentStyle.button}`}
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                Excluindo...
              </div>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
} 