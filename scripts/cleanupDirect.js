const { Client } = require('pg');

const client = new Client({
  connectionString: "postgresql://arbitragem_banco_user:fj3tzJ1Gu1FVHdvscaOyUzKUVJbRoOSn@dpg-d14g0m15pdvs73f4uve0-a.oregon-postgres.render.com/arbitragem_banco",
  ssl: {
    rejectUnauthorized: false
  }
});

async function cleanup() {
  try {
    console.log('Tentando conectar ao banco de dados...');
    await client.connect();
    console.log('Conectado ao banco de dados com sucesso!');

    // Deletar registros antigos do SpreadHistory
    const deletedSpreads = await client.query(`
      DELETE FROM "SpreadHistory"
      WHERE timestamp < NOW() - INTERVAL '7 days'
      RETURNING COUNT(*) as count
    `);
    console.log(`Deletados ${deletedSpreads.rows[0].count} registros antigos de SpreadHistory`);

    // Deletar registros antigos do PriceHistory
    const deletedPrices = await client.query(`
      DELETE FROM "PriceHistory"
      WHERE timestamp < NOW() - INTERVAL '7 days'
      RETURNING COUNT(*) as count
    `);
    console.log(`Deletados ${deletedPrices.rows[0].count} registros antigos de PriceHistory`);

    // Executar VACUUM
    console.log('\nIniciando VACUUM...');
    await client.query('VACUUM FULL "SpreadHistory"');
    await client.query('VACUUM FULL "PriceHistory"');
    console.log('VACUUM executado com sucesso');

    // Contar registros restantes
    const remainingSpreads = await client.query('SELECT COUNT(*) as count FROM "SpreadHistory"');
    const remainingPrices = await client.query('SELECT COUNT(*) as count FROM "PriceHistory"');

    console.log('\nRegistros restantes:');
    console.log(`SpreadHistory: ${remainingSpreads.rows[0].count}`);
    console.log(`PriceHistory: ${remainingPrices.rows[0].count}`);

  } catch (error) {
    console.error('Erro durante a limpeza:', error);
  } finally {
    await client.end();
  }
}

cleanup(); 