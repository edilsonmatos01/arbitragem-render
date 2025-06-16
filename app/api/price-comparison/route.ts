import { NextResponse } from 'next/server';

// Função auxiliar para converter UTC para horário de Brasília
function convertToBrasiliaTime(date: Date): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
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

    // Gerar pontos a cada 30 minutos
    let currentTime = twentyFourHoursAgo;
    while (currentTime <= now) {
      const brasiliaTime = convertToBrasiliaTime(currentTime);
      const timeLabel = brasiliaTime.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo'
      }).replace(',', '');

      // Gerar dados simulados para teste
      const basePrice = 1000; // Preço base para simulação
      const timeProgress = (currentTime.getTime() - twentyFourHoursAgo.getTime()) / (now.getTime() - twentyFourHoursAgo.getTime());
      const variation = Math.sin(timeProgress * Math.PI * 4) * 0.001; // Variação suave de ±0.1%

      data.push({
        timestamp: timeLabel,
        spot: Number((basePrice * (1 + variation)).toFixed(4)),
        futures: Number((basePrice * (1 - variation)).toFixed(4)),
      });

      // Avançar 30 minutos
      currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
    }

    return NextResponse.json({
      data,
      symbol,
      totalRecords: data.length,
      timeRange: '24h',
    });

  } catch (error) {
    console.error(`Erro ao buscar dados de comparação para ${symbol}:`, error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' }, 
      { status: 500 }
    );
  }
} 