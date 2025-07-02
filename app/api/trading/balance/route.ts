import { NextRequest, NextResponse } from 'next/server';
import * as ccxt from 'ccxt';
import { getApiCredentials } from '@/app/api/config/api-keys/route';

// Função para obter configurações das exchanges do banco de dados
async function getExchangeConfig(exchangeName: 'gateio' | 'mexc') {
  const credentials = await getApiCredentials(exchangeName);
  
  if (!credentials) {
    // Fallback para variáveis de ambiente se não houver no banco
    const envKey = exchangeName === 'gateio' ? process.env.GATEIO_API_KEY : process.env.MEXC_API_KEY;
    const envSecret = exchangeName === 'gateio' ? process.env.GATEIO_API_SECRET : process.env.MEXC_API_SECRET;
    
    if (envKey && envSecret) {
      return {
        apiKey: envKey,
        secret: envSecret,
        sandbox: false
      };
    }
    
    return null;
  }
  
  return {
    apiKey: credentials.apiKey,
    secret: credentials.apiSecret,
    sandbox: false
  };
}

async function getExchangeBalance(exchangeName: 'gateio' | 'mexc') {
  try {
    const config = await getExchangeConfig(exchangeName);
    if (!config || !config.apiKey || !config.secret) {
      throw new Error(`Credenciais da ${exchangeName.toUpperCase()} não configuradas. Configure as API Keys na página de configurações.`);
    }

    let exchange: ccxt.Exchange;
    
    if (exchangeName === 'gateio') {
      exchange = new ccxt.gateio({
        apiKey: config.apiKey,
        secret: config.secret,
        sandbox: config.sandbox,
        enableRateLimit: true,
      });
    } else {
      exchange = new ccxt.mexc({
        apiKey: config.apiKey,
        secret: config.secret,
        sandbox: config.sandbox,
        enableRateLimit: true,
      });
    }

    const balance = await exchange.fetchBalance();
    
    // Filtrar apenas moedas com saldo > 0
    const relevantBalances = Object.entries(balance.total)
      .filter(([currency, amount]) => amount && amount > 0)
      .reduce((acc, [currency, amount]) => {
        acc[currency] = {
          total: amount,
          free: (balance.free as any)[currency] || 0,
          used: (balance.used as any)[currency] || 0,
          type: 'spot'
        };
        return acc;
      }, {} as Record<string, any>);

    return {
      success: true,
      exchange: exchangeName,
      balances: relevantBalances,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error(`❌ Erro ao buscar saldo da ${exchangeName}:`, error);
    return {
      success: false,
      exchange: exchangeName,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const exchangeParam = searchParams.get('exchange');

    if (exchangeParam && !['gateio', 'mexc'].includes(exchangeParam)) {
      return NextResponse.json(
        { error: 'Exchange deve ser "gateio" ou "mexc"' },
        { status: 400 }
      );
    }

    if (exchangeParam) {
      // Buscar saldo de uma exchange específica
      const result = await getExchangeBalance(exchangeParam as 'gateio' | 'mexc');
      return NextResponse.json(result);
    } else {
      // Buscar saldos de todas as exchanges
      const results = await Promise.all([
        getExchangeBalance('gateio'),
        getExchangeBalance('mexc')
      ]);

      return NextResponse.json({
        success: true,
        exchanges: results
      });
    }

  } catch (error) {
    console.error('❌ Erro na API de saldos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
} 