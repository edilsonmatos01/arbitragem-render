"use client";

import React, { useState, useEffect } from 'react';
import { Save, Eye, EyeOff, Key, Shield, AlertTriangle, CheckCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

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
  const [gateioForm, setGateioForm] = useState<ExchangeForm>({
    apiKey: '', apiSecret: '', showApiKey: false, showApiSecret: false, isActive: true
  });
  const [mexcForm, setMexcForm] = useState<ExchangeForm>({
    apiKey: '', apiSecret: '', showApiKey: false, showApiSecret: false, isActive: true
  });
  const [binanceForm, setBinanceForm] = useState<ExchangeForm>({
    apiKey: '', apiSecret: '', showApiKey: false, showApiSecret: false, isActive: true
  });
  const [bybitForm, setBybitForm] = useState<ExchangeForm>({
    apiKey: '', apiSecret: '', showApiKey: false, showApiSecret: false, isActive: true
  });
  const [bitgetForm, setBitgetForm] = useState<ExchangeForm>({
    apiKey: '', apiSecret: '', passphrase: '', showApiKey: false, showApiSecret: false, showPassphrase: false, isActive: true
  });

  // Carregar configurações existentes
  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const response = await fetch('/api/config/api-keys');
      if (response.ok) {
        const data = await response.json();
        setConfigs(data);
      } else {
        console.error('Erro ao carregar configurações:', response.status);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSaveConfig = async (exchange: string, form: ExchangeForm) => {
    if (!form.apiKey || !form.apiSecret) {
      showMessage('error', 'API Key e API Secret são obrigatórios');
      return;
    }

    if (exchange === 'bitget' && !form.passphrase) {
      showMessage('error', 'Passphrase é obrigatória para Bitget');
      return;
    }

    setIsLoading(true);
    try {
      const body = {
        exchange,
        apiKey: form.apiKey,
        apiSecret: form.apiSecret,
        ...(form.passphrase && { passphrase: form.passphrase }),
        isActive: form.isActive
      };

      const response = await fetch('/api/config/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        showMessage('success', `Configuração ${exchange.toUpperCase()} salva com sucesso!`);
        loadConfigs();
        
        // Manter os campos preenchidos para permitir futuras atualizações
        // Apenas ocultar as senhas por segurança
        const updatedForm = {
          ...form,
          showApiKey: false, 
          showApiSecret: false, 
          showPassphrase: false
        };
        
        switch(exchange) {
          case 'gateio': setGateioForm(updatedForm); break;
          case 'mexc': setMexcForm(updatedForm); break;
          case 'binance': setBinanceForm(updatedForm); break;
          case 'bybit': setBybitForm(updatedForm); break;
          case 'bitget': setBitgetForm(updatedForm); break;
        }
      } else {
        const errorData = await response.json();
        showMessage('error', errorData.error || 'Erro ao salvar configuração');
      }
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      showMessage('error', 'Erro de conexão ao salvar configuração');
    } finally {
      setIsLoading(false);
    }
  };

  const renderExchangeCard = (
    exchange: string, 
    displayName: string, 
    form: ExchangeForm, 
    setForm: React.Dispatch<React.SetStateAction<ExchangeForm>>,
    instructions: string,
    needsPassphrase = false
  ) => {
    const config = configs.find(c => c.exchange === exchange);
    const isConfigured = !!config;

    return (
      <div key={exchange} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-custom-cyan" />
            <h3 className="text-lg font-semibold">{displayName}</h3>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs ${
            isConfigured 
              ? 'bg-green-600 text-white' 
              : 'bg-gray-600 text-gray-300'
          }`}>
            {isConfigured ? 'Configurada' : 'Não configurada'}
          </span>
        </div>

        <p className="text-sm text-gray-400 mb-4">{instructions}</p>

        <div className="space-y-4">
          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              API Key *
            </label>
            <div className="relative">
              <input
                type={form.showApiKey ? "text" : "password"}
                value={form.apiKey}
                onChange={(e) => setForm({...form, apiKey: e.target.value})}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-custom-cyan focus:border-transparent"
                placeholder="Sua API Key"
              />
              <button
                type="button"
                onClick={() => setForm({...form, showApiKey: !form.showApiKey})}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {form.showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* API Secret */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              API Secret *
            </label>
            <div className="relative">
              <input
                type={form.showApiSecret ? "text" : "password"}
                value={form.apiSecret}
                onChange={(e) => setForm({...form, apiSecret: e.target.value})}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-custom-cyan focus:border-transparent"
                placeholder="Sua API Secret"
              />
              <button
                type="button"
                onClick={() => setForm({...form, showApiSecret: !form.showApiSecret})}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {form.showApiSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Passphrase (apenas para Bitget) */}
          {needsPassphrase && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Passphrase *
              </label>
              <div className="relative">
                <input
                  type={form.showPassphrase ? "text" : "password"}
                  value={form.passphrase || ''}
                  onChange={(e) => setForm({...form, passphrase: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-custom-cyan focus:border-transparent"
                  placeholder="Sua Passphrase"
                />
                <button
                  type="button"
                  onClick={() => setForm({...form, showPassphrase: !form.showPassphrase})}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {form.showPassphrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Checkbox Ativa */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id={`${exchange}-active`}
              checked={form.isActive}
              onChange={(e) => setForm({...form, isActive: e.target.checked})}
              className="h-4 w-4 text-custom-cyan focus:ring-custom-cyan border-gray-600 rounded bg-gray-700"
            />
            <label htmlFor={`${exchange}-active`} className="ml-2 text-sm text-gray-300">
              Configuração ativa
            </label>
          </div>

          {/* Botão Salvar */}
          <button
            onClick={() => handleSaveConfig(exchange, form)}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-custom-cyan hover:bg-custom-cyan/80 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            <Save className="h-4 w-4" />
            {isLoading ? 'Salvando...' : 'Salvar Configuração'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header com botão de voltar */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link 
              href="/dashboard" 
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              Voltar ao Dashboard
            </Link>
          </div>
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

        {/* Cards das Exchanges */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {renderExchangeCard(
            'gateio', 
            'Gate.io', 
            gateioForm, 
            setGateioForm,
            'Acesse sua conta Gate.io → API Management → Create API Key'
          )}
          
          {renderExchangeCard(
            'mexc', 
            'MEXC', 
            mexcForm, 
            setMexcForm,
            'Acesse sua conta MEXC → API Management → Create API Key'
          )}
          
          {renderExchangeCard(
            'binance', 
            'Binance', 
            binanceForm, 
            setBinanceForm,
            'Acesse sua conta Binance → API Management → Create API Key'
          )}
          
          {renderExchangeCard(
            'bybit', 
            'Bybit', 
            bybitForm, 
            setBybitForm,
            'Acesse sua conta Bybit → API → Create New Key'
          )}
          
          {renderExchangeCard(
            'bitget', 
            'Bitget', 
            bitgetForm, 
            setBitgetForm,
            'Acesse sua conta Bitget → API Management → Create API Key (Passphrase obrigatória)',
            true
          )}
        </div>

        {/* Aviso de segurança */}
        <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-5 w-5 text-blue-400" />
            <span className="text-blue-400 font-medium">Segurança</span>
          </div>
          <p className="text-blue-300 text-sm">
            Suas chaves de API são criptografadas antes de serem armazenadas no banco de dados. 
            Nunca compartilhe suas chaves de API com terceiros.
          </p>
        </div>
      </div>
    </div>
  );
} 