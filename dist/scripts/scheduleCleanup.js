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
        const deletedSpreads = await prisma.spreadHistory.deleteMany({
            where: {
                timestamp: {
                    lt: new Date(Date.now() - 24 * 60 * 60 * 1000)
                }
            }
        });
        console.log(`[${timestamp}] Deletados ${deletedSpreads.count} registros antigos de SpreadHistory`);
        const deletedPrices = await prisma.$queryRaw `
            DELETE FROM "PriceHistory"
            WHERE timestamp < NOW() - INTERVAL '24 hours'
            RETURNING COUNT(*) as count
        `;
        console.log(`[${timestamp}] Deletados ${deletedPrices[0].count} registros antigos de PriceHistory`);
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
node_cron_1.default.schedule('0 2 * * *', async () => {
    try {
        await cleanup();
    }
    catch (error) {
        console.error('Erro ao executar limpeza agendada:', error);
    }
});
cleanup()
    .catch(error => {
    console.error('Erro na limpeza inicial:', error);
});
console.log('Script de limpeza agendada iniciado. Rodará diariamente às 02:00 (mantém apenas últimas 24h).');
process.on('SIGINT', async () => {
    console.log('Encerrando script de limpeza...');
    await prisma.$disconnect();
    process.exit(0);
});
//# sourceMappingURL=scheduleCleanup.js.map