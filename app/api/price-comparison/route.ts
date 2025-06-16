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

// Temporariamente retornando dados vazios para limpar os gráficos
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'O parâmetro symbol é obrigatório' }, { status: 400 });
  }

  return NextResponse.json({
    data: [],
    symbol,
    totalRecords: 0,
    timeRange: '24h',
    nextUpdate: new Date().toISOString(),
  });
} 