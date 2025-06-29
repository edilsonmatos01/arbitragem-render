const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function safeProductionBuild() {
    try {
        console.log('🔧 Iniciando build seguro para produção...');
        
        // 1. Gerar apenas o Prisma Client
        console.log('📦 Gerando Prisma Client...');
        await execAsync('npx prisma generate');
        console.log('✅ Prisma Client gerado com sucesso');
        
        // 2. Compilar TypeScript
        console.log('🔨 Compilando TypeScript...');
        await execAsync('npx tsc -p tsconfig.server.json');
        console.log('✅ TypeScript compilado com sucesso');
        
        console.log('🎉 Build seguro concluído com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro durante o build:', error.message);
        
        // Se falhar, tenta uma abordagem mais básica
        console.log('🔄 Tentando abordagem alternativa...');
        try {
            await execAsync('npx tsc -p tsconfig.server.json');
            console.log('✅ Compilação alternativa bem-sucedida');
        } catch (fallbackError) {
            console.error('❌ Falha na compilação alternativa:', fallbackError.message);
            process.exit(1);
        }
    }
}

if (require.main === module) {
    safeProductionBuild()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('❌ Build falhou:', error);
            process.exit(1);
        });
}

module.exports = { safeProductionBuild }; 