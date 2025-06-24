"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function checkSpreadData() {
    try {
        const lastRecords = await prisma.spreadHistory.findMany({
            take: 10,
            orderBy: {
                timestamp: 'desc'
            }
        });
        console.log('Últimos 10 registros:');
        lastRecords.forEach(record => {
            console.log({
                symbol: record.symbol,
                spread: record.spread,
                timestamp: record.timestamp.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
                direction: record.direction
            });
        });
        const totalCount = await prisma.spreadHistory.count();
        console.log('\nTotal de registros:', totalCount);
        const symbolCounts = await prisma.spreadHistory.groupBy({
            by: ['symbol'],
            _count: {
                symbol: true
            }
        });
        console.log('\nRegistros por símbolo:');
        symbolCounts.forEach(count => {
            console.log(`${count.symbol}: ${count._count.symbol} registros`);
        });
    }
    catch (error) {
        console.error('Erro ao verificar dados:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
checkSpreadData();
//# sourceMappingURL=check-spread-data.js.map