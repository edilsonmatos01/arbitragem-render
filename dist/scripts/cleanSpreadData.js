const { PrismaClient } = require('@prisma/client');
async function cleanSpreadData() {
    const prisma = new PrismaClient();
    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const deletedSpreadHistory = await prisma.spreadHistory.deleteMany({
            where: {
                timestamp: {
                    lt: twentyFourHoursAgo
                }
            }
        });
        console.log(`Registros antigos excluídos da spreadHistory: ${deletedSpreadHistory.count}`);
    }
    catch (error) {
        console.error('Erro ao excluir registros:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
cleanSpreadData();
//# sourceMappingURL=cleanSpreadData.js.map