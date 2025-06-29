"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function cleanup() {
    try {
        console.log('Iniciando limpeza do banco de dados...');
        const deletedSpreads = await prisma.spreadHistory.deleteMany({
            where: {
                timestamp: {
                    lt: new Date(Date.now() - 24 * 60 * 60 * 1000)
                }
            }
        });
        console.log(`Deletados ${deletedSpreads.count} registros antigos de SpreadHistory`);
        const deletedPrices = await prisma.$queryRaw `
            DELETE FROM "PriceHistory"
            WHERE timestamp < NOW() - INTERVAL '24 hours'
            RETURNING COUNT(*) as count
        `;
        console.log(`Deletados ${deletedPrices[0].count} registros antigos de PriceHistory`);
        const remainingSpreads = await prisma.spreadHistory.count();
        const remainingPrices = await prisma.$queryRaw `
            SELECT COUNT(*) as count FROM "PriceHistory"
        `;
        console.log('\nRegistros restantes:');
        console.log(`SpreadHistory: ${remainingSpreads}`);
        console.log(`PriceHistory: ${remainingPrices[0].count}`);
        console.log('\nLimpeza concluída com sucesso!');
    }
    catch (error) {
        console.error('Erro durante a limpeza:', error);
        throw error;
    }
    finally {
        await prisma.$disconnect();
    }
}
cleanup()
    .catch(console.error)
    .finally(() => process.exit());
//# sourceMappingURL=cleanupDatabase.js.map