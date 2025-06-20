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
const { PrismaClient } = require('@prisma/client');
function cleanSpreadData() {
    return __awaiter(this, void 0, void 0, function* () {
        const prisma = new PrismaClient();
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
            console.log(`Registros antigos excluídos da spreadHistory: ${deletedSpreadHistory.count}`);
        }
        catch (error) {
            console.error('Erro ao excluir registros:', error);
        }
        finally {
            yield prisma.$disconnect();
        }
    });
}
// Executa a limpeza
cleanSpreadData();
