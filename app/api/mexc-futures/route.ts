import { NextRequest, NextResponse } from 'next/server';
import * as ccxt from 'ccxt';

export async function GET(req: NextRequest) {
  try {
    if (!process.env.MEXC_API_KEY || !process.env.MEXC_API_SECRET) {
      return NextResponse.json({
        success: false,
        error: 'Credenciais da MEXC não configuradas'
      });
    }

    // Configurar MEXC para futures
    const exchange = new ccxt.mexc({
      apiKey: process.env.MEXC_API_KEY,
      secret: process.env.MEXC_API_SECRET,
      sandbox: false,
      enableRateLimit: true,
      options: {
        defaultType: 'swap', // Configurar para futures por padrão
      }
    });

    console.log('🔄 Buscando saldo de futures da MEXC...');
    
    // Buscar saldo de futures
    const balance = await exchange.fetchBalance();
    
    console.log('📊 Saldo bruto MEXC:', balance);
    
    // Filtrar apenas moedas com saldo > 0
    const relevantBalances = Object.entries(balance.total)
      .filter(([currency, amount]) => amount && amount > 0)
      .reduce((acc, [currency, amount]) => {
        acc[currency] = {
          total: amount,
          free: (balance.free as any)[currency] || 0,
          used: (balance.used as any)[currency] || 0,
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