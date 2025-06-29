'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Info, XCircle, Bell, X } from 'lucide-react';

interface Alert {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  dismissible?: boolean;
}

interface AlertItemProps {
  alert: Alert;
  onDismiss: (id: string) => void;
}

function AlertItem({ alert, onDismiss }: AlertItemProps) {
  const getAlertConfig = (type: Alert['type']) => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircle className="h-5 w-5 text-green-400" />,
          bgColor: 'bg-green-900/20',
          borderColor: 'border-green-500/30',
          textColor: 'text-green-400'
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="h-5 w-5 text-yellow-400" />,
          bgColor: 'bg-yellow-900/20',
          borderColor: 'border-yellow-500/30',
          textColor: 'text-yellow-400'
        };
      case 'error':
        return {
          icon: <XCircle className="h-5 w-5 text-red-400" />,
          bgColor: 'bg-red-900/20',
          borderColor: 'border-red-500/30',
          textColor: 'text-red-400'
        };
      default:
        return {
          icon: <Info className="h-5 w-5 text-blue-400" />,
          bgColor: 'bg-blue-900/20',
          borderColor: 'border-blue-500/30',
          textColor: 'text-blue-400'
        };
    }
  };

  const config = getAlertConfig(alert.type);

  return (
    <div className={`${config.bgColor} ${config.borderColor} border rounded-lg p-4 mb-3 last:mb-0`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`font-medium ${config.textColor} mb-1`}>
            {alert.title}
          </h4>
          <p className="text-sm text-gray-300 mb-2">
            {alert.message}
          </p>
          <p className="text-xs text-gray-500">
            {alert.timestamp.toLocaleString('pt-BR')}
          </p>
        </div>
        {alert.dismissible && (
          <button
            onClick={() => onDismiss(alert.id)}
            className="flex-shrink-0 text-gray-400 hover:text-white transition-colors p-1 hover:bg-gray-800 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function AlertsPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  const generateSystemAlerts = () => {
    const now = new Date();
    const systemAlerts: Alert[] = [];

    // Verificar conexão WebSocket
    systemAlerts.push({
      id: 'websocket-status',
      type: 'info',
      title: 'WebSocket Conectado',
      message: 'Recebendo dados em tempo real das exchanges',
      timestamp: now,
      dismissible: false
    });

    // Alerta de spread alto
    systemAlerts.push({
      id: 'high-spread',
      type: 'success',
      title: 'Spread Alto Detectado',
      message: 'BTC/USDT com spread de 1.2% - Oportunidade de arbitragem!',
      timestamp: new Date(now.getTime() - 5 * 60 * 1000),
      dismissible: true
    });

    // Alerta de saldo baixo
    systemAlerts.push({
      id: 'low-balance',
      type: 'warning',
      title: 'Saldo Baixo',
      message: 'Saldo em Gate.io abaixo de $100. Considere fazer um depósito.',
      timestamp: new Date(now.getTime() - 15 * 60 * 1000),
      dismissible: true
    });

    return systemAlerts;
  };

  const dismissAlert = (id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  };

  useEffect(() => {
    const initialAlerts = generateSystemAlerts();
    setAlerts(initialAlerts);

    // Simular novos alertas periodicamente
    const interval = setInterval(() => {
      const randomAlerts = [
        {
          id: `alert-${Date.now()}`,
          type: 'success' as const,
          title: 'Operação Concluída',
          message: 'Arbitragem ETH/USDT finalizada com lucro de $12.50',
          timestamp: new Date(),
          dismissible: true
        },
        {
          id: `alert-${Date.now()}-2`,
          type: 'warning' as const,
          title: 'Spread Reduzido',
          message: 'Spread BNB/USDT caiu para 0.3% - Monitorando',
          timestamp: new Date(),
          dismissible: true
        }
      ];

      if (Math.random() > 0.7) { // 30% chance de novo alerta
        const newAlert = randomAlerts[Math.floor(Math.random() * randomAlerts.length)];
        setAlerts(prev => [newAlert, ...prev.slice(0, 9)]); // Manter máximo 10 alertas
      }
    }, 30000); // A cada 30 segundos

    return () => clearInterval(interval);
  }, []);

  const criticalAlerts = alerts.filter(alert => alert.type === 'error' || alert.type === 'warning');
  const displayAlerts = isExpanded ? alerts : alerts.slice(0, 3);

  return (
    <div className="bg-dark-card p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-custom-cyan" />
          <h2 className="text-xl font-semibold text-white">Alertas do Sistema</h2>
          {criticalAlerts.length > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
              {criticalAlerts.length}
            </span>
          )}
        </div>
        
        {alerts.length > 3 && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-custom-cyan hover:text-white transition-colors text-sm"
          >
            {isExpanded ? 'Mostrar menos' : `Ver todos (${alerts.length})`}
          </button>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-8">
          <Bell className="h-12 w-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Nenhum alerta no momento</p>
          <p className="text-sm text-gray-500 mt-1">
            Sistema funcionando normalmente
          </p>
        </div>
      ) : (
        <div className="space-y-0">
          {displayAlerts.map(alert => (
            <AlertItem 
              key={alert.id} 
              alert={alert} 
              onDismiss={dismissAlert}
            />
          ))}
        </div>
      )}
    </div>
  );
} 