"use client";

import React, { useState, useEffect } from 'react';
import { Save, Eye, EyeOff, Key, Shield, AlertTriangle, CheckCircle } from 'lucide-react';

interface ApiConfig {
  id: string;
  exchange: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ExchangeForm {
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  showApiKey: boolean;
  showApiSecret: boolean;
  showPassphrase?: boolean;
  isActive: boolean;
}

export default function ConfiguracoesPage() {
  const [configs, setConfigs] = useState<ApiConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Estados para os formulários
  const [forms, setForms] = useState<Record<string, ExchangeForm>>({
    gateio: {
      apiKey: '',
      apiSecret: '',
      showApiKey: false,
      showApiSecret: false,
      isActive: true
    },
    mexc: {
      apiKey: '',
      apiSecret: '',
      showApiKey: false,
      showApiSecret: false,
      isActive: true
    },
    binance: {
      apiKey: '',
      apiSecret: '',
      showApiKey: false,
      showApiSecret: false,
      isActive: true
    },
    bybit: {
      apiKey: '',
      apiSecret: '',
      showApiKey: false,
      showApiSecret: false,
      isActive: true
    },
    bitget: {
      apiKey: '',
      apiSecret: '',
      passphrase: '',
      showApiKey: false,
      showApiSecret: false,
      showPassphrase: false,
      isActive: true
    }
  });

  // Carregar configurações existentes
  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const response = await fetch('/api/config/api-keys');
      const data = await response.json();
      setConfigs(data);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const updateForm = (exchange: string, updates: Partial<ExchangeForm>) => {
    setForms(prev => ({
      ...prev,
      [exchange]: {
        ...prev[exchange],
        ...updates
      }
    }));
  };

  const handleSaveConfig = async (exchange: string) => {
    const form = forms[exchange];
    
    if (!form.apiKey || !form.apiSecret) {
      showMessage('error', 'API Key e API Secret são obrigatórios');
      return;
    }

    // Validar passphrase para Bitget
    if (exchange === 'bitget' && !form.passphrase) {
      showMessage('error', 'Passphrase é obrigatória para Bitget');
      return;
    }

    setIsLoading(true);
    try {
      const body: any = {
        exchange,
        apiKey: form.apiKey,
        apiSecret: form.apiSecret,
        isActive: form.isActive
      };

      if (form.passphrase) {
        body.passphrase = form.passphrase;
      }

      const response = await fetch('/api/config/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        showMessage('success', `Configuração da ${exchange.toUpperCase()} salva com sucesso!`);
        loadConfigs();
        
        // Limpar formulário
        updateForm(exchange, {
          apiKey: '',
          apiSecret: '',
          passphrase: ''
        });
      } else {
        const error = await response.json();
        showMessage('error', error.error || 'Erro ao salvar configuração');
      }
    } catch (error) {
      showMessage('error', 'Erro ao salvar configuração');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteConfig = async (exchange: string) => {
    if (!confirm(`Deseja realmente remover a configuração da ${exchange.toUpperCase()}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/config/api-keys?exchange=${exchange}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showMessage('success', `Configuração da ${exchange.toUpperCase()} removida com sucesso!`);
        loadConfigs();
      } else {
        const error = await response.json();
        showMessage('error', error.error || 'Erro ao remover configuração');
      }
    } catch (error) {
      showMessage('error', 'Erro ao remover configuração');
    }
  };

  const getConfigStatus = (exchange: string) => {
    const config = configs.find(c => c.exchange === exchange);
    return config ? (config.isActive ? 'Ativa' : 'Inativa') : 'Não configurada';
  };

  const isConfigured = (exchange: string) => {
    return configs.some(c => c.exchange === exchange);
  };

  const renderExchangeCard = (exchange: string, displayName: string, needsPassphrase: boolean = false) => {
    const form = forms[exchange];
    
    return (
      <div key={exchange} className="mb-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Key className="h-6 w-6 text-custom-cyan" />
            <h2 className="text-xl font-semibold">{displayName}</h2>
            <span className={`px-3 py-1 rounded-full text-xs ${
              isConfigured(exchange) 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-600 text-gray-300'
            }`}>
              {getConfigStatus(exchange)}
            </span>
          </div>
          {isConfigured(exchange) && (
            <button
              onClick={() => handleDeleteConfig(exchange)}
              className="text-red-400 hover:text-red-300 text-sm"
            >
              Remover
            </button>
          )}
        </div>

        <div className={`grid grid-cols-1 ${needsPassphrase ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4 mb-4`}>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              API Key
            </label>
            <div className="relative">
              <input
                type={form.showApiKey ? 'text' : 'password'}
                value={form.apiKey}
                onChange={(e) => updateForm(exchange, { apiKey: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-custom-cyan focus:border-transparent"
                placeholder={`Sua API Key da ${displayName}`}
              />
              <button
                type="button"
                onClick={() => updateForm(exchange, { showApiKey: !form.showApiKey })}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {form.showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              API Secret
            </label>
            <div className="relative">
              <input
                type={form.showApiSecret ? 'text' : 'password'}
                value={form.apiSecret}
                onChange={(e) => updateForm(exchange, { apiSecret: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-custom-cyan focus:border-transparent"
                placeholder={`Sua API Secret da ${displayName}`}
              />
              <button
                type="button"
                onClick={() => updateForm(exchange, { showApiSecret: !form.showApiSecret })}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {form.showApiSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {needsPassphrase && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Passphrase
              </label>
              <div className="relative">
                <input
                  type={form.showPassphrase ? 'text' : 'password'}
                  value={form.passphrase || ''}
                  onChange={(e) => updateForm(exchange, { passphrase: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-custom-cyan focus:border-transparent"
                  placeholder={`Passphrase da ${displayName}`}
                />
                <button
                  type="button"
                  onClick={() => updateForm(exchange, { showPassphrase: !form.showPassphrase })}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {form.showPassphrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => updateForm(exchange, { isActive: e.target.checked })}
              className="w-4 h-4 text-custom-cyan bg-gray-700 border-gray-600 rounded focus:ring-custom-cyan"
            />
            <span className="text-sm text-gray-300">Configuração ativa</span>
          </label>

          <button
            onClick={() => handleSaveConfig(exchange)}
            disabled={isLoading}
            className="flex items-center gap-2 bg-custom-cyan hover:bg-custom-cyan/90 text-black font-medium py-2 px-4 rounded-md transition-colors disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isLoading ? 'Salvando...' : `Salvar ${displayName}`}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Configurações de API</h1>
          <p className="text-gray-400">
            Configure suas chaves de API das exchanges de forma segura. As chaves são criptografadas antes do armazenamento.
          </p>
        </div>

        {/* Mensagem de feedback */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success' ? 'bg-green-900/20 border border-green-500/30 text-green-400' : 'bg-red-900/20 border border-red-500/30 text-red-400'
          }`}>
            {message.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            {message.text}
          </div>
        )}

        {/* Aviso de segurança */}
        <div className="mb-8 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-5 w-5 text-blue-400" />
            <span className="text-blue-400 font-medium">Segurança</span>
          </div>
          <p className="text-blue-300 text-sm">
            Suas chaves de API são criptografadas antes de serem armazenadas no banco de dados. 
            Nunca compartilhe suas chaves de API com terceiros.
          </p>
        </div>

        {/* Cards das Exchanges */}
        {renderExchangeCard('gateio', 'Gate.io')}
        {renderExchangeCard('mexc', 'MEXC')}
        {renderExchangeCard('binance', 'Binance')}
        {renderExchangeCard('bybit', 'Bybit')}
        {renderExchangeCard('bitget', 'Bitget', true)}

        {/* Instruções */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Como obter suas API Keys</h3>
          
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-custom-cyan mb-2">Gate.io:</h4>
              <ol className="list-decimal list-inside text-sm text-gray-300 space-y-1">
                <li>Acesse <a href="https://www.gate.io" target="_blank" className="text-custom-cyan hover:underline">gate.io</a> e faça login</li>
                <li>Vá em "API Management" no menu do usuário</li>
                <li>Clique em "Create API Key"</li>
                <li>Configure as permissões necessárias (Spot Trading, Futures Trading)</li>
                <li>Copie a API Key e Secret geradas</li>
              </ol>
            </div>

            <div>
              <h4 className="font-medium text-custom-cyan mb-2">MEXC:</h4>
              <ol className="list-decimal list-inside text-sm text-gray-300 space-y-1">
                <li>Acesse <a href="https://www.mexc.com" target="_blank" className="text-custom-cyan hover:underline">mexc.com</a> e faça login</li>
                <li>Vá em "API Management" nas configurações da conta</li>
                <li>Clique em "Create API"</li>
                <li>Configure as permissões (Spot Trading, Futures Trading)</li>
                <li>Copie a API Key e Secret geradas</li>
              </ol>
            </div>

            <div>
              <h4 className="font-medium text-custom-cyan mb-2">Binance:</h4>
              <ol className="list-decimal list-inside text-sm text-gray-300 space-y-1">
                <li>Acesse <a href="https://www.binance.com" target="_blank" className="text-custom-cyan hover:underline">binance.com</a> e faça login</li>
                <li>Vá em "API Management" no menu do usuário</li>
                <li>Clique em "Create API"</li>
                <li>Configure as permissões (Spot & Margin Trading, Futures)</li>
                <li>Copie a API Key e Secret geradas</li>
              </ol>
            </div>

            <div>
              <h4 className="font-medium text-custom-cyan mb-2">Bybit:</h4>
              <ol className="list-decimal list-inside text-sm text-gray-300 space-y-1">
                <li>Acesse <a href="https://www.bybit.com" target="_blank" className="text-custom-cyan hover:underline">bybit.com</a> e faça login</li>
                <li>Vá em "API" nas configurações da conta</li>
                <li>Clique em "Create New Key"</li>
                <li>Configure as permissões (Derivatives, Spot)</li>
                <li>Copie a API Key e Secret geradas</li>
              </ol>
            </div>

            <div>
              <h4 className="font-medium text-custom-cyan mb-2">Bitget:</h4>
              <ol className="list-decimal list-inside text-sm text-gray-300 space-y-1">
                <li>Acesse <a href="https://www.bitget.com" target="_blank" className="text-custom-cyan hover:underline">bitget.com</a> e faça login</li>
                <li>Vá em "API Management" nas configurações da conta</li>
                <li>Clique em "Create API Key"</li>
                <li>Configure as permissões (Spot Trading, Futures Trading)</li>
                <li>Copie a API Key, Secret e Passphrase geradas</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 