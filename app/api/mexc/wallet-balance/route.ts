export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
import { NextResponse } from 'next/server';
import ccxt, { Balances } from 'ccxt';

export async function GET() {
  try {
    // Verificar se as variáveis de ambiente estão definidas
    if (!process.env.MEXC_API_KEY || !process.env.MEXC_API_SECRET) {
      return NextResponse.json(
        { error: 'Credenciais da MEXC não configuradas', details: 'MEXC_API_KEY ou MEXC_API_SECRET não encontrados' },
        { status: 500 }
      );
    }

    const exchange = new ccxt.mexc({
      apiKey: process.env.MEXC_API_KEY,
      secret: process.env.MEXC_API_SECRET,
      sandbox: false,
      enableRateLimit: true,
      options: {
        defaultType: 'swap', // Usar 'swap' ao invés de 'future' para futuros da MEXC
      },
    });

    let balanceData: Balances;
    
    try {
      // Tentar buscar saldo de futuros primeiro
      balanceData = await exchange.fetchBalance();
    } catch (futuresError) {
      console.warn('Erro ao buscar saldo de futuros, tentando spot:', futuresError);
      
      // Se falhar, tentar spot como fallback
      exchange.options['defaultType'] = 'spot';
      try {
        balanceData = await exchange.fetchBalance();
      } catch (spotError) {
        console.error('Erro ao buscar saldo spot também:', spotError);
        throw futuresError; // Lançar o erro original de futuros
      }
    }

    // Verificar se balanceData existe e tem a estrutura esperada
    if (!balanceData || !balanceData.total) {
      return NextResponse.json(
        { error: 'Resposta inválida da MEXC', details: 'Estrutura de saldo não encontrada' },
        { status: 500 }
      );
    }

    const balances = Object.entries(balanceData.total)
      .filter(([, totalAmount]) => typeof totalAmount === 'number' && totalAmount > 0)
      .map(([currency, totalAmount]) => {
        let freeAmount = 0;
        const freeBalances = balanceData.free as unknown as Record<string, number> | undefined;
        if (freeBalances && typeof freeBalances === 'object' && freeBalances.hasOwnProperty(currency)) {
          const freeVal = freeBalances[currency];
          if (typeof freeVal === 'number') {
            freeAmount = freeVal;
          }
        }

        let usedAmount = 0;
        const usedBalances = balanceData.used as unknown as Record<string, number> | undefined;
        if (usedBalances && typeof usedBalances === 'object' && usedBalances.hasOwnProperty(currency)) {
          const usedVal = usedBalances[currency];
          if (typeof usedVal === 'number') {
            usedAmount = usedVal;
          }
        }

        return {
          asset: currency,
          free: freeAmount.toString(),
          locked: usedAmount.toString(),
        };
      });

    return NextResponse.json({ balances });
  } catch (error) {
    console.error('Erro ao buscar saldo da MEXC com CCXT:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    // Diagnóstico mais detalhado do erro
    let details = errorMessage;
    let statusCode = 500;
    
    if (error instanceof ccxt.NetworkError) {
      details = `NetworkError: ${error.message}`;
      statusCode = 503; // Service Unavailable
    } else if (error instanceof ccxt.ExchangeError) {
      details = `ExchangeError: ${error.message}`;
      statusCode = 502; // Bad Gateway
    } else if (error instanceof ccxt.AuthenticationError) {
      details = `AuthenticationError: ${error.message}`;
      statusCode = 401; // Unauthorized
    } else if (error instanceof ccxt.InvalidNonce) {
      details = `InvalidNonce: ${error.message}`;
      statusCode = 400; // Bad Request
    } else if (error instanceof ccxt.RateLimitExceeded) {
      details = `RateLimitExceeded: ${error.message}`;
      statusCode = 429; // Too Many Requests
    }

    return NextResponse.json(
      { 
        error: 'Erro ao buscar saldo da MEXC', 
        details,
        timestamp: new Date().toISOString()
      },
      { status: statusCode }
    );
  }
} 