"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const node_cron_1 = __importDefault(require("node-cron"));
const prisma = new client_1.PrismaClient();
async function cleanOldData() {
    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const deletedSpreadHistory = await prisma.spreadHistory.deleteMany({
            where: {
                timestamp: {
                    lt: twentyFourHoursAgo
                }
            }
        });
        console.log(`[${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}] Registros antigos excluídos: ${deletedSpreadHistory.count}`);
    }
    catch (error) {
        console.error('Erro ao excluir registros:', error);
    }
}
node_cron_1.default.schedule('0 * * * *', cleanOldData, {
    timezone: "America/Sao_Paulo"
});
console.log('Limpeza automática agendada. Rodará a cada hora.');
process.stdin.resume();
//# sourceMappingURL=scheduleCleanup.js.map