"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const node_cron_1 = __importDefault(require("node-cron"));
const prisma = new client_1.PrismaClient();
function cleanOldData() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Calcula a data limite (24 horas atrás)
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            // Excluir registros mais antigos que 24 horas
            const deletedSpreadHistory = yield prisma.spreadHistory.deleteMany({
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
    });
}
// Agenda a limpeza para rodar diariamente às 02:00 (mantém apenas últimas 24h)
// O '0 2 * * *' significa: às 02:00 de cada dia
node_cron_1.default.schedule('0 2 * * *', cleanOldData, {
    timezone: "America/Sao_Paulo"
});
console.log('Limpeza automática agendada. Rodará diariamente às 02:00 (mantém apenas últimas 24h).');
// Mantém o processo rodando
process.stdin.resume();
