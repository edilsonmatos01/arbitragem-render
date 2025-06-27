"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrismaClient = getPrismaClient;
exports.disconnectPrisma = disconnectPrisma;
exports.createSpreads = createSpreads;
exports.createSpread = createSpread;
const client_1 = require("@prisma/client");
let prismaInstance = null;
function getPrismaClient() {
    if (!prismaInstance) {
        prismaInstance = new client_1.PrismaClient({
            errorFormat: 'minimal',
        });
    }
    return prismaInstance;
}
async function disconnectPrisma() {
    if (prismaInstance) {
        await prismaInstance.$disconnect();
        prismaInstance = null;
    }
}
async function createSpreads(data) {
    const client = getPrismaClient();
    await client.spreadHistory.createMany({
        data
    });
}
async function createSpread(data) {
    const client = getPrismaClient();
    await client.spreadHistory.create({
        data
    });
}
//# sourceMappingURL=prisma-client.js.map