const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuração do pool de conexão
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function setupDatabase() {
  try {
    // Lê o arquivo SQL
    const sqlPath = path.join(__dirname, 'create-table.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Executa o SQL
    await pool.query(sqlContent);
    console.log('Tabela criada com sucesso!');
  } catch (error) {
    console.error('Erro ao criar tabela:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupDatabase(); 