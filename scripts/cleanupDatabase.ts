import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface DeleteResult {
    count: number;
}

async function cleanup() {
    try {
        console.log('Iniciando limpeza do banco de dados...');

        // Deletar registros antigos do SpreadHistory (mais de 24 horas)
        const deletedSpreads = await prisma.spreadHistory.deleteMany({
            where: {
                timestamp: {
                    lt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 horas atrás
                }
            }
        });
        console.log(`Deletados ${deletedSpreads.count} registros antigos de SpreadHistory`);

        // Deletar registros antigos do PriceHistory (mais de 24 horas)
        const deletedPrices = await prisma.$queryRaw<DeleteResult[]>`
            DELETE FROM "PriceHistory"
            WHERE timestamp < NOW() - INTERVAL '24 hours'
            RETURNING COUNT(*) as count
        `;
        console.log(`Deletados ${deletedPrices[0].count} registros antigos de PriceHistory`);

        // Contar registros restantes
        const remainingSpreads = await prisma.spreadHistory.count();
        const remainingPrices = await prisma.$queryRaw<DeleteResult[]>`
            SELECT COUNT(*) as count FROM "PriceHistory"
        `;

        console.log('\nRegistros restantes:');
        console.log(`SpreadHistory: ${remainingSpreads}`);
        console.log(`PriceHistory: ${remainingPrices[0].count}`);

        console.log('\nLimpeza concluída com sucesso!');
    } catch (error) {
        console.error('Erro durante a limpeza:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Executar limpeza
cleanup()
    .catch(console.error)
    .finally(() => process.exit()); 