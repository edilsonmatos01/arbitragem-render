import { NextResponse } from 'next/server';
import WebSocket from 'ws';

// Função auxiliar para converter UTC para horário de Brasília
function convertToBrasiliaTime(date: Date): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}

interface MarketPrice {
  bestBid: number;
  bestAsk: number;
}

interface MarketPrices {
  [symbol: string]: {
    spot?: MarketPrice;
    futures?: MarketPrice;
  };
}

let marketPrices: MarketPrices = {};

// Conectar ao websocket local
const ws = new WebSocket('ws://localhost:3001');

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    if (message.type === 'marketPrices') {
      marketPrices = message.data;
    }
  } catch (error) {
    console.error('Erro ao processar mensagem do websocket:', error);
  }
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'O parâmetro symbol é obrigatório' }, { status: 400 });
  }

  try {
    // Obter preços atuais do websocket
    const currentPrices = marketPrices[symbol];
    if (!currentPrices || !currentPrices.spot || !currentPrices.futures) {
      return NextResponse.json({ 
        data: [], 
        message: 'Dados de preço não disponíveis no momento' 
      });
    }

    const spotPrice = (currentPrices.spot.bestBid + currentPrices.spot.bestAsk) / 2;
    const futuresPrice = (currentPrices.futures.bestBid + currentPrices.futures.bestAsk) / 2;

    // Gerar dados para as últimas 24 horas em intervalos de 30 minutos
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const data = [];

    // Arredondar para o intervalo de 30 minutos mais próximo
    now.setMinutes(Math.floor(now.getMinutes() / 30) * 30, 0, 0);
    twentyFourHoursAgo.setMinutes(Math.floor(twentyFourHoursAgo.getMinutes() / 30) * 30, 0, 0);

    // Gerar pontos a cada 30 minutos
    let currentTime = new Date(twentyFourHoursAgo);
    while (currentTime <= now) {
      const brasiliaTime = convertToBrasiliaTime(currentTime);
      const timeLabel = brasiliaTime.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo'
      }).replace(',', '');

      // Adicionar uma pequena variação aos preços para simular movimento
      const timeProgress = (currentTime.getTime() - twentyFourHoursAgo.getTime()) / (now.getTime() - twentyFourHoursAgo.getTime());
      const variation = Math.sin(timeProgress * Math.PI * 4) * 0.001; // Variação suave de ±0.1%

      data.push({
        timestamp: timeLabel,
        spot: Number((spotPrice * (1 + variation)).toFixed(4)),
        futures: Number((futuresPrice * (1 - variation)).toFixed(4)),
      });

      // Avançar 30 minutos
      currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
    }

    return NextResponse.json({
      data,
      symbol,
      totalRecords: data.length,
      timeRange: '24h',
      nextUpdate: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
    });

  } catch (error) {
    console.error(`Erro ao buscar dados de comparação para ${symbol}:`, error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' }, 
      { status: 500 }
    );
  }
} 