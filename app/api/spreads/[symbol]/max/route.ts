import { NextResponse } from 'next/server';

// Temporariamente retornando valores nulos para limpar os gráficos
export async function GET(
  request: Request,
  { params }: { params: { symbol: string } }
) {
  const symbol = params.symbol;

  if (!symbol) {
    return NextResponse.json({ error: 'O símbolo é obrigatório' }, { status: 400 });
  }

  return NextResponse.json({ spMax: null, crosses: 0 });
} 