import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSpreadData() {
  try {
    // Busca os últimos 10 registros
    const lastRecords = await prisma.spreadHistory.findMany({
      take: 10,
      orderBy: {
        timestamp: 'desc'
      }
    });

    console.log('Últimos 10 registros:');
    lastRecords.forEach(record => {
      console.log({
        symbol: record.symbol,
        spread: record.spread,
        timestamp: record.timestamp.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        direction: record.direction
      });
    });

    // Conta total de registros
    const totalCount = await prisma.spreadHistory.count();
    console.log('\nTotal de registros:', totalCount);

    // Agrupa por símbolo
    const symbolCounts = await prisma.spreadHistory.groupBy({
      by: ['symbol'],
      _count: {
        symbol: true
      }
    });

    console.log('\nRegistros por símbolo:');
    symbolCounts.forEach(count => {
      console.log(`${count.symbol}: ${count._count.symbol} registros`);
    });

  } catch (error) {
    console.error('Erro ao verificar dados:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSpreadData(); 