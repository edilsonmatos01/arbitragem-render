const { PrismaClient } = require('@prisma/client');

async function cleanSpreadData() {
  const prisma = new PrismaClient();

  try {
<<<<<<< HEAD
    // Calcula a data limite (24 horas atrás)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Excluir registros mais antigos que 24 horas
    const deletedSpreadHistory = await prisma.spreadHistory.deleteMany({
      where: {
        timestamp: {
          lt: twentyFourHoursAgo
=======
    // Excluir registros da tabela spreadHistory
    const deletedSpreadHistory = await prisma.spreadHistory.deleteMany({
      where: {
        timestamp: {
          gte: new Date('2025-06-12T00:00:00Z'),
          lt: new Date('2025-06-12T21:30:00Z') // 18:30 BRT = 21:30 UTC
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
        }
      }
    });

<<<<<<< HEAD
    console.log(`Registros antigos excluídos da spreadHistory: ${deletedSpreadHistory.count}`);
=======
    console.log(`Registros excluídos da spreadHistory: ${deletedSpreadHistory.count}`);
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
  } catch (error) {
    console.error('Erro ao excluir registros:', error);
  } finally {
    await prisma.$disconnect();
  }
}

<<<<<<< HEAD
// Executa a limpeza
=======
>>>>>>> bd60c0d217578f788aaefc3831a9600292f43cfc
cleanSpreadData(); 