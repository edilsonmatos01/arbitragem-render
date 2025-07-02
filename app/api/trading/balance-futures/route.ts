import { NextRequest, NextResponse } from 'next/server';
import * as ccxt from 'ccxt';

const exchanges = {
  mexc: {
    apiKey: process.env.MEXC_API_KEY,
    secret: process.env.MEXC_API_SECRET,
    sandbox: false,
  }
};

async function getMexcFuturesBalance() {
  try {
    const config = exchanges.mexc;
    if (!config.apiKey || !config.secret) {
      throw new Error('Credenciais da MEXC não configuradas');
    }

    const exchange = new ccxt.mexc({
      apiKey: config.apiKey,
      secret: config.secret,
      sandbox: config.sandbox,
      enableRateLimit: true,
    });

    console.log('🔄 Buscando saldo de futures da MEXC...');
    
    // Tentar diferentes métodos para buscar futures
    let futuresBalance = null;
    
    try {
      // Método 1: type: 'swap'
      futuresBalance = await exchange.fetchBalance({ type: 'swap' });
      console.log('✅ Método swap funcionou');
    } catch (error1) {
      console.log('❌ Método swap falhou:', (error1 as Error).message);
      
      try {
        // Método 2: type: 'future'
        futuresBalance = await exchange.fetchBalance({ type: 'future' });
        console.log('✅ Método future funcionou');
      } catch (error2) {
        console.log('❌ Método future falhou:', (error2 as Error).message);
        
        try {
          // Método 3: defaultType: 'swap'
          exchange.options['defaultType'] = 'swap';
          futuresBalance = await exchange.fetchBalance();
          console.log('✅ Método defaultType funcionou');
        } catch (error3) {
          console.log('❌ Método defaultType falhou:', (error3 as Error).message);
          throw error3;
        }
      }
    }

    // Filtrar apenas moedas com saldo > 0
    const relevantBalances = Object.entries(futuresBalance.total)
      .filter(([currency, amount]) => amount && amount > 0)
      .reduce((acc, [currency, amount]) => {
        acc[currency] = {
          total: amount,
          free: (futuresBalance.free as any)[currency] || 0,
          used: (futuresBalance.used as any)[currency] || 0,
          type: 'futures'
        };
        return acc;
      }, {} as Record<string, any>);

    return NextResponse.json({
      success: true,
      exchange: 'mexc',
      balances: relevantBalances,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro ao buscar saldo de futures da MEXC:', error);
    return NextResponse.json({
      success: false,
      exchange: 'mexc',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

export async function GET(req: NextRequest) {
  return await getMexcFuturesBalance();
} 