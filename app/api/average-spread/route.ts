import { NextResponse } from 'next/server';
import { getAverageSpread24h } from '@/lib/spread-tracker';

// Helper para validar a direção do tracker
function isValidTrackerDirection(direction: any): direction is 'spot-to-future' | 'future-to-spot' {
  return direction === 'spot-to-future' || direction === 'future-to-spot';
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const exchangeBuy = searchParams.get('exchangeBuy');
  const exchangeSell = searchParams.get('exchangeSell');
  const direction = searchParams.get('direction'); // 'spot-to-future' or 'future-to-spot'

  if (!symbol || !exchangeBuy || !exchangeSell || !direction) {
    return NextResponse.json(
      { error: 'Parâmetros ausentes: symbol, exchangeBuy, exchangeSell e direction são obrigatórios.' },
      { status: 400 }
    );
  }

  if (!isValidTrackerDirection(direction)) {
    return NextResponse.json(
      { error: 'Parâmetro direction inválido. Use \'spot-to-future\' ou \'future-to-spot\'.' },
      { status: 400 }
    );
  }

  try {
    const averageSpread = await getAverageSpread24h(symbol, exchangeBuy, exchangeSell, direction);
    
    if (averageSpread === null) {
      return NextResponse.json({ averageSpread: null, message: 'Nenhum dado de spread encontrado para as últimas 24h.' }, { status: 200 });
    }
    
    return NextResponse.json({ averageSpread }, { status: 200 });

  } catch (error) {
    console.error("API Error - /api/average-spread:", error);
    return NextResponse.json(
      { error: 'Erro ao calcular o spread médio.', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 