const { PrismaClient } = require('@prisma/client');

async function cleanSpreadData() {
  const prisma = new PrismaClient();

  try {
    // Calcula a data limite (24 horas atrás)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Excluir registros mais antigos que 24 horas
    const deletedSpreadHistory = await prisma.spreadHistory.deleteMany({
      where: {
        timestamp: {
          lt: twentyFourHoursAgo
        }
      }
    });

    console.log(`Registros antigos excluídos da spreadHistory: ${deletedSpreadHistory.count}`);
  } catch (error) {
    console.error('Erro ao excluir registros:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executa a limpeza
cleanSpreadData(); 