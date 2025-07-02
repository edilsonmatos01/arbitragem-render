export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
import { NextResponse } from 'next/server';
import ccxt, { Balances } from 'ccxt';
import { getApiCredentials } from '@/app/api/config/api-keys/route';

export async function GET() {
  try {
    // Tentar obter credenciais do banco de dados primeiro
    let apiKey = process.env.BYBIT_API_KEY;
    let apiSecret = process.env.BYBIT_API_SECRET;
    
    const dbCredentials = await getApiCredentials('bybit');
    if (dbCredentials) {
      apiKey = dbCredentials.apiKey;
      apiSecret = dbCredentials.apiSecret;
    }

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { 
          error: 'Credenciais da Bybit não configuradas', 
          details: 'Configure suas API Keys na página de Configurações' 
        },
        { status: 401 }
      );
    }

    const exchange = new ccxt.bybit({
      apiKey,
      secret: apiSecret,
      options: {
        defaultType: 'spot',
      },
    });

    const balanceData: Balances = await exchange.fetchBalance({ type: 'spot' });

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
          coin: currency,
          walletBalance: freeAmount.toString(),
          locked: usedAmount.toString(),
        };
      });

    return NextResponse.json({ balances });
  } catch (error) {
    console.error('Erro ao buscar saldo da Bybit com CCXT:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    let details = errorMessage;
    let statusCode = 500;
    
    if (error instanceof ccxt.NetworkError) {
      details = `NetworkError: ${error.message}`;
      statusCode = 503;
    } else if (error instanceof ccxt.ExchangeError) {
      details = `ExchangeError: ${error.message}`;
      statusCode = 502;
    } else if (error instanceof ccxt.AuthenticationError) {
      details = `AuthenticationError: ${error.message}`;
      statusCode = 401;
    } else if (error instanceof ccxt.InvalidNonce) {
      details = `InvalidNonce: ${error.message}`;
      statusCode = 400;
    } else if (error instanceof ccxt.RateLimitExceeded) {
      details = `RateLimitExceeded: ${error.message}`;
      statusCode = 429;
    }

    return NextResponse.json(
      { 
        error: 'Erro ao buscar saldo da Bybit', 
        details,
        timestamp: new Date().toISOString()
      },
      { status: statusCode }
    );
  }
} 