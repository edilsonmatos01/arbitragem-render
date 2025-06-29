const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function safeWebBuild() {
    try {
        console.log('🔧 Iniciando build seguro para aplicação web...');
        
        // 1. Gerar apenas o Prisma Client
        console.log('📦 Gerando Prisma Client...');
        await execAsync('npx prisma generate');
        console.log('✅ Prisma Client gerado com sucesso');
        
        // 2. Build do Next.js
        console.log('🏗️  Fazendo build do Next.js...');
        await execAsync('npx next build');
        console.log('✅ Build do Next.js concluído com sucesso');
        
        console.log('🎉 Build seguro da web concluído com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro durante o build:', error.message);
        
        // Se falhar, tenta uma abordagem mais básica
        console.log('🔄 Tentando abordagem alternativa...');
        try {
            await execAsync('npx next build');
            console.log('✅ Build alternativo bem-sucedido');
        } catch (fallbackError) {
            console.error('❌ Falha no build alternativo:', fallbackError.message);
            process.exit(1);
        }
    }
}

if (require.main === module) {
    safeWebBuild()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('❌ Build falhou:', error);
            process.exit(1);
        });
}

module.exports = { safeWebBuild }; 