import { PrismaClient } from '@prisma/client';

// Criando uma única instância do PrismaClient
let prismaInstance: PrismaClient | null = null;

// Função para obter a instância do PrismaClient
export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      errorFormat: 'minimal',
    });
  }
  return prismaInstance;
}

// Função para desconectar o cliente
export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}

// Função para criar múltiplos registros de spread
export async function createSpreads(data: Array<{
  symbol: string;
  exchangeBuy: string;
  exchangeSell: string;
  direction: string;
  spread: number;
  spotPrice: number;
  futuresPrice: number;
  timestamp: Date;
}>): Promise<void> {
  const client = getPrismaClient();
  await client.spreadHistory.createMany({
    data
  });
}

// Função para criar um único registro de spread
export async function createSpread(data: {
  symbol: string;
  exchangeBuy: string;
  exchangeSell: string;
  direction: string;
  spread: number;
  spotPrice: number;
  futuresPrice: number;
  timestamp: Date;
}): Promise<void> {
  const client = getPrismaClient();
  await client.spreadHistory.create({
    data
  });
} 