const WebSocket = require('ws');

console.log('🔍 VERIFICANDO PARES DISPONÍVEIS NO WEBSOCKET');
console.log('⏳ Conectando ao WebSocket...\n');

const ws = new WebSocket('ws://localhost:8080');

const stats = {
  totalMessages: 0,
  arbitrageOpportunities: 0,
  priceUpdates: 0,
  allPairs: new Set(),
  arbitragePairs: new Set(),
  priceUpdatePairs: new Set()
};

ws.on('open', () => {
  console.log('✅ Conectado ao WebSocket!');
  console.log('📊 Monitorando mensagens...\n');
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data);
    stats.totalMessages++;

    if (message.type === 'arbitrage') {
      stats.arbitrageOpportunities++;
      stats.arbitragePairs.add(message.baseSymbol);
      stats.allPairs.add(message.baseSymbol);
      
      console.log(`🎯 OPORTUNIDADE: ${message.baseSymbol} - ${message.profitPercentage.toFixed(4)}%`);
      
    } else if (message.type === 'price-update') {
      stats.priceUpdates++;
      stats.priceUpdatePairs.add(message.symbol);
      stats.allPairs.add(message.symbol);
    }

    // Mostrar estatísticas a cada 1000 mensagens
    if (stats.totalMessages % 1000 === 0) {
      console.log(`📈 ESTATÍSTICAS (${stats.totalMessages} mensagens):`);
      console.log(`   Oportunidades: ${stats.arbitrageOpportunities}`);
      console.log(`   Atualizações de preço: ${stats.priceUpdates}`);
      console.log(`   Total de pares únicos: ${stats.allPairs.size}`);
      console.log(`   Pares com oportunidades: ${stats.arbitragePairs.size}`);
      console.log(`   Pares com preços: ${stats.priceUpdatePairs.size}`);
      console.log('');
    }

  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error);
  }
});

ws.on('error', (error) => {
  console.error('❌ Erro na conexão WebSocket:', error);
});

ws.on('close', () => {
  console.log('\n📊 ESTATÍSTICAS FINAIS:');
  console.log(`   Total de mensagens: ${stats.totalMessages}`);
  console.log(`   Oportunidades de arbitragem: ${stats.arbitrageOpportunities}`);
  console.log(`   Atualizações de preço: ${stats.priceUpdates}`);
  console.log(`   Total de pares únicos: ${stats.allPairs.size}`);
  console.log(`   Pares com oportunidades: ${stats.arbitragePairs.size}`);
  console.log(`   Pares com preços: ${stats.priceUpdatePairs.size}`);
  
  console.log('\n🎯 PARES COM OPORTUNIDADES DE ARBITRAGEM:');
  const arbitragePairsArray = Array.from(stats.arbitragePairs).sort();
  arbitragePairsArray.forEach(pair => {
    console.log(`   - ${pair}`);
  });
  
  console.log('\n💰 PARES COM ATUALIZAÇÕES DE PREÇO:');
  const pricePairsArray = Array.from(stats.priceUpdatePairs).sort();
  pricePairsArray.forEach(pair => {
    console.log(`   - ${pair}`);
  });
  
  console.log('\n✅ Teste concluído!');
  process.exit(0);
});

// Encerrar após 1 minuto
setTimeout(() => {
  console.log('\n⏰ Tempo limite atingido. Encerrando teste...');
  ws.close();
}, 60000); 