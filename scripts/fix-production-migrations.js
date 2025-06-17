const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');

async function waitForDatabase(prisma, retries = 10, delay = 3000) {
  for (let i = 0; i < retries; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log('Conexão com o banco estabelecida com sucesso');
      return true;
    } catch (error) {
      console.log(`Tentativa ${i + 1} de ${retries} falhou. Aguardando ${delay}ms...`);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return false;
}

async function executeMigration() {
  const prisma = new PrismaClient({
    log: ['warn', 'error'],
    errorFormat: 'pretty',
  });

  try {
    console.log('Iniciando script de migração...');

    // Aguarda o banco estar pronto
    await waitForDatabase(prisma);
    
    // Lê e executa o arquivo de migração
    const migrationPath = path.join(__dirname, '..', 'prisma', 'migrations', '20240617_fix_table_name', 'migration.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    console.log('Executando migração...');
    await prisma.$executeRawUnsafe(migrationSQL);
    console.log('Migração executada com sucesso!');

    // Verifica se a tabela foi criada corretamente
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'spread_history'
      );
    `;

    if (tableExists[0].exists) {
      console.log('Tabela spread_history criada com sucesso!');
      
      // Tenta fazer uma query simples
      const count = await prisma.spreadHistory.count();
      console.log(`Conexão com Prisma estabelecida com sucesso. Registros na tabela: ${count}`);
    } else {
      throw new Error('Tabela spread_history não foi criada corretamente');
    }

  } catch (error) {
    console.error('Erro durante a migração:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Se o script for executado diretamente
if (require.main === module) {
  executeMigration()
    .then(() => {
      console.log('Script de migração concluído com sucesso');
      process.exit(0);
    })
    .catch(error => {
      console.error('Erro no script de migração:', error);
      process.exit(1);
    });
} 