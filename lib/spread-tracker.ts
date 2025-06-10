// lib/spread-tracker.ts
// Lógica para salvar histórico de spreads e calcular a média nas últimas 24h

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

interface SpreadSample {
  symbol: string
  exchangeBuy: string
  exchangeSell: string
  direction: 'spot-to-future' | 'future-to-spot'
  spread: number // This should be the raw spread value (e.g., 0.005 for 0.5%)
}

export async function recordSpread(sample: SpreadSample): Promise<void> {
  try {
    await prisma.spreadHistory.create({
      data: {
        symbol: sample.symbol,
        exchangeBuy: sample.exchangeBuy,
        exchangeSell: sample.exchangeSell,
        direction: sample.direction,
        spread: sample.spread, // raw spread value
        timestamp: new Date()
      }
    })
    // console.log('Spread recorded:', sample);
  } catch (error) {
    console.error("Error recording spread:", error);
    // Consider more robust error handling or re-throwing if needed
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
      select: { // Only select the spread field for efficiency
        spread: true
      }
    })

    if (records.length === 0) return null

    const average =
      records.reduce((sum: number, r: { spread: number }) => sum + r.spread, 0) / records.length

    return parseFloat(average.toFixed(8)); // Using more precision for average
  } catch (error) {
    console.error("Error getting average spread:", error);
    return null; // Or re-throw
  }
}

// Optional: Function to gracefully disconnect Prisma client on app shutdown
export async function disconnectPrisma() {
  await prisma.$disconnect();
} 