"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrismaClient = getPrismaClient;
exports.disconnectPrisma = disconnectPrisma;
exports.createSpreads = createSpreads;
exports.createSpread = createSpread;
const client_1 = require("@prisma/client");
// Criando uma única instância do PrismaClient
let prismaInstance = null;
// Função para obter a instância do PrismaClient
function getPrismaClient() {
    if (!prismaInstance) {
        prismaInstance = new client_1.PrismaClient({
            errorFormat: 'minimal',
        });
    }
    return prismaInstance;
}
// Função para desconectar o cliente
async function disconnectPrisma() {
    if (prismaInstance) {
        await prismaInstance.$disconnect();
        prismaInstance = null;
    }
}
// Função para criar múltiplos registros de spread
async function createSpreads(data) {
    const client = getPrismaClient();
    await client.spreadHistory.createMany({
        data
    });
}
// Função para criar um único registro de spread
async function createSpread(data) {
    const client = getPrismaClient();
    await client.spreadHistory.create({
        data
    });
}
