import { NextResponse } from 'next/server';

// Função auxiliar para converter UTC para horário de Brasília
function convertToBrasiliaTime(date: Date): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
}

// Função para gerar preços simulados
function generateSimulatedPrices(basePrice: number = 1000) {
  const variation = (Math.random() - 0.5) * 0.002; // Variação de ±0.1%
  return {
    spot: basePrice * (1 + variation),
    futures: basePrice * (1 - variation)
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'O parâmetro symbol é obrigatório' }, { status: 400 });
  }

  try {
    // Gerar dados para as últimas 24 horas em intervalos de 30 minutos
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const data = [];

    // Arredondar para o intervalo de 30 minutos mais próximo
    now.setMinutes(Math.floor(now.getMinutes() / 30) * 30, 0, 0);
    twentyFourHoursAgo.setMinutes(Math.floor(twentyFourHoursAgo.getMinutes() / 30) * 30, 0, 0);

    // Gerar pontos a cada 30 minutos
    let currentTime = new Date(twentyFourHoursAgo);
    
    // Preço base que será usado para gerar variações
    const basePrice = 1000; // Você pode ajustar este valor conforme necessário
    
    while (currentTime <= now) {
      const brasiliaTime = convertToBrasiliaTime(currentTime);
      const timeLabel = brasiliaTime.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo'
      }).replace(',', '');

      // Gerar preços simulados para este intervalo
      const timeProgress = (currentTime.getTime() - twentyFourHoursAgo.getTime()) / (now.getTime() - twentyFourHoursAgo.getTime());
      const cyclicVariation = Math.sin(timeProgress * Math.PI * 4) * 0.005; // Variação cíclica de ±0.5%
      
      const prices = generateSimulatedPrices(basePrice * (1 + cyclicVariation));

      data.push({
        timestamp: timeLabel,
        spot: Number(prices.spot.toFixed(4)),
        futures: Number(prices.futures.toFixed(4)),
      });

      // Avançar 30 minutos
      currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
    }

    // Calcular próxima atualização (próximo intervalo de 30 minutos)
    const nextUpdateTime = new Date(now);
    nextUpdateTime.setMinutes(Math.ceil(nextUpdateTime.getMinutes() / 30) * 30, 0, 0);
    if (nextUpdateTime <= now) {
      nextUpdateTime.setTime(nextUpdateTime.getTime() + 30 * 60 * 1000);
    }

    return NextResponse.json({
      data,
      symbol,
      totalRecords: data.length,
      timeRange: '24h',
      nextUpdate: nextUpdateTime.toISOString(),
    });

  } catch (error) {
    console.error(`Erro ao buscar dados de comparação para ${symbol}:`, error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' }, 
      { status: 500 }
    );
  }
} 