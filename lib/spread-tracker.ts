// lib/spread-tracker.ts
// Lógica para salvar histórico de spreads e calcular a média nas últimas 24h

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

interface SpreadSample {
  symbol: string
  exchangeBuy: string
  exchangeSell: string
  direction: 'spot-to-future' | 'future-to-spot'
  spread: number // Valor em porcentagem (ex: 1.5 para 1.5%)
}

export async function recordSpread(sample: SpreadSample): Promise<void> {
  try {
    // Garante que o spread está em porcentagem
    const spreadValue = Math.abs(sample.spread);
    
    await prisma.spreadHistory.create({
      data: {
        symbol: sample.symbol,
        exchangeBuy: sample.exchangeBuy,
        exchangeSell: sample.exchangeSell,
        direction: sample.direction,
        spread: spreadValue,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error("Error recording spread:", error);
  }
}

export async function getAverageSpread24h(
  symbol: string,
  exchangeBuy: string,
  exchangeSell: string,
  direction: 'spot-to-future' | 'future-to-spot'
): Promise<number | null> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const records = await prisma.spreadHistory.findMany({
      where: {
        symbol,
        exchangeBuy,
        exchangeSell,
        direction,
        timestamp: { gte: since }
      },
      select: {
        spread: true
      }
    })

    if (records.length < 2) return null;

    const average = records.reduce((sum, r) => sum + r.spread, 0) / records.length;
    return parseFloat(average.toFixed(2));
  } catch (error) {
    console.error("Error getting average spread:", error);
    return null;
  }
}

// Optional: Function to gracefully disconnect Prisma client on app shutdown
export async function disconnectPrisma() {
  await prisma.$disconnect();
} 