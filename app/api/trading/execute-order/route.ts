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

interface OrderRequest {
  exchange: 'gateio' | 'mexc';
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  type: 'market' | 'limit';
  price?: number;
  marketType: 'spot' | 'futures';
}

interface OrderResponse {
  success: boolean;
  orderId?: string;
  price?: number;
  amount?: number;
  error?: string;
  details?: any;
}

async function executeOrder(orderRequest: OrderRequest): Promise<OrderResponse> {
  try {
    const { exchange: exchangeName, symbol, side, amount, type, price, marketType } = orderRequest;
    
    // Obter configurações da exchange do banco de dados
    const config = await getExchangeConfig(exchangeName);
    if (!config || !config.apiKey || !config.secret) {
      throw new Error(`Credenciais da ${exchangeName.toUpperCase()} não configuradas. Configure as API Keys na página de configurações.`);
    }

    // Inicializar exchange
    let exchange: ccxt.Exchange;
    
    if (exchangeName === 'gateio') {
      exchange = new ccxt.gateio({
        apiKey: config.apiKey,
        secret: config.secret,
        sandbox: config.sandbox,
        enableRateLimit: true,
        options: {
          createMarketBuyOrderRequiresPrice: false, // Permite ordens market de compra sem preço
        },
      });
    } else if (exchangeName === 'mexc') {
      exchange = new ccxt.mexc({
        apiKey: config.apiKey,
        secret: config.secret,
        sandbox: config.sandbox,
        enableRateLimit: true,
        timeout: 30000, // Aumentar timeout para 30 segundos
        options: {
          defaultType: 'swap', // Para futures
        },
      });
    } else {
      throw new Error(`Exchange ${exchangeName} não suportada`);
    }

    // Carregar mercados
    await exchange.loadMarkets();

    // Ajustar símbolo para futures se necessário
    let tradingSymbol = symbol;
    if (marketType === 'futures') {
      // Para Gate.io futures: BTC/USDT:USDT
      // Para MEXC futures: BTC/USDT:USDT
      if (!symbol.includes(':')) {
        tradingSymbol = `${symbol}:USDT`;
      }
    }

    // Verificar se o mercado existe
    if (!exchange.markets[tradingSymbol]) {
      throw new Error(`Mercado ${tradingSymbol} não encontrado na ${exchangeName.toUpperCase()}`);
    }

    // Verificar saldo antes da execução
    const balance = await exchange.fetchBalance();
    console.log(`💰 Saldo ${exchangeName.toUpperCase()}:`, balance);

    // Executar ordem
    const orderParams: any = {};
    
    // Para futures, pode ser necessário parâmetros específicos
    if (marketType === 'futures') {
      // Configurações específicas para futures
      if (exchangeName === 'gateio') {
        orderParams.settle = 'usdt'; // Para Gate.io futures
      }
    }

    // Para Gate.io, ordens market de compra usam valor total em USD
    if (exchangeName === 'gateio' && type === 'market' && side === 'buy') {
      // Buscar preço atual para calcular o valor total
      const ticker = await exchange.fetchTicker(tradingSymbol);
      const currentPrice = ticker.last || ticker.close || ticker.bid;
      if (!currentPrice) {
        throw new Error(`Não foi possível obter preço atual para ${tradingSymbol}`);
      }
      const totalCost = amount * currentPrice; // amount * preço atual
      
      console.log(`📋 Executando ordem market de compra Gate.io:`, {
        exchange: exchangeName,
        symbol: tradingSymbol,
        type,
        side,
        originalAmount: amount,
        totalCost,
        currentPrice,
        marketType,
        params: orderParams
      });

      const order = await exchange.createOrder(
        tradingSymbol,
        type,
        side,
        totalCost, // Usar valor total em USD
        undefined, // Sem preço para market orders
        orderParams
      );

      console.log(`✅ Ordem executada com sucesso:`, order);

      return {
        success: true,
        orderId: order.id,
        price: order.price || order.average || currentPrice,
        amount: order.amount || amount,
        details: order
      };
    }

    console.log(`📋 Executando ordem:`, {
      exchange: exchangeName,
      symbol: tradingSymbol,
      type,
      side,
      amount,
      price,
      marketType,
      params: orderParams
    });

    const order = await exchange.createOrder(
      tradingSymbol,
      type,
      side,
      amount,
      price,
      orderParams
    );

    console.log(`✅ Ordem executada com sucesso:`, order);

    return {
      success: true,
      orderId: order.id,
      price: order.price || order.average,
      amount: order.amount,
      details: order
    };

  } catch (error) {
    console.error(`❌ Erro ao executar ordem:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orders } = body;

    if (!orders || !Array.isArray(orders)) {
      return NextResponse.json(
        { error: 'Lista de ordens é obrigatória' },
        { status: 400 }
      );
    }

    console.log(`🔄 Executando ${orders.length} ordem(ns)...`);

    // Executar todas as ordens em paralelo
    const results = await Promise.all(
      orders.map((order: OrderRequest) => executeOrder(order))
    );

    // Verificar se todas as ordens foram executadas com sucesso
    const failures = results.filter(result => !result.success);
    
    if (failures.length > 0) {
      console.error(`❌ ${failures.length} ordem(ns) falharam:`, failures);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Algumas ordens falharam',
          results,
          failures 
        },
        { status: 400 }
      );
    }

    console.log(`✅ Todas as ${orders.length} ordem(ns) executadas com sucesso!`);

    return NextResponse.json({
      success: true,
      results,
      message: `${orders.length} ordem(ns) executada(s) com sucesso`
    });

  } catch (error) {
    console.error('❌ Erro na API de execução de ordens:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
} 