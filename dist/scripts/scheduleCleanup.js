"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_cron_1 = __importDefault(require("node-cron"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function cleanup() {
    try {
        console.log('Iniciando limpeza do banco de dados...');
        const timestamp = new Date().toISOString();
        // Deletar registros antigos do SpreadHistory
        const deletedSpreads = await prisma.spreadHistory.deleteMany({
            where: {
                timestamp: {
                    lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 dias atrás
                }
            }
        });
        console.log(`[${timestamp}] Deletados ${deletedSpreads.count} registros antigos de SpreadHistory`);
        // Deletar registros antigos do PriceHistory
        const deletedPrices = await prisma.$queryRaw `
            DELETE FROM "PriceHistory"
            WHERE timestamp < NOW() - INTERVAL '7 days'
            RETURNING COUNT(*) as count
        `;
        console.log(`[${timestamp}] Deletados ${deletedPrices[0].count} registros antigos de PriceHistory`);
        // Contar registros restantes
        const remainingSpreads = await prisma.spreadHistory.count();
        const remainingPrices = await prisma.$queryRaw `
            SELECT COUNT(*) as count FROM "PriceHistory"
        `;
        console.log(`\n[${timestamp}] Registros restantes:`);
        console.log(`SpreadHistory: ${remainingSpreads}`);
        console.log(`PriceHistory: ${remainingPrices[0].count}`);
        console.log(`\n[${timestamp}] Limpeza concluída com sucesso!`);
    }
    catch (error) {
        console.error('Erro durante a limpeza:', error);
        throw error;
    }
}
// Agendar limpeza para rodar todos os dias às 00:00
node_cron_1.default.schedule('0 0 * * *', async () => {
    try {
        await cleanup();
    }
    catch (error) {
        console.error('Erro ao executar limpeza agendada:', error);
    }
});
// Também executar uma limpeza inicial ao iniciar o script
cleanup()
    .catch(error => {
    console.error('Erro na limpeza inicial:', error);
});
console.log('Script de limpeza agendada iniciado. Rodará todos os dias às 00:00.');
// Manter o processo rodando
process.on('SIGINT', async () => {
    console.log('Encerrando script de limpeza...');
    await prisma.$disconnect();
    process.exit(0);
});
//# sourceMappingURL=scheduleCleanup.js.map