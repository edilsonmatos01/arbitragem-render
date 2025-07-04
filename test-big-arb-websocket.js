const WebSocket = require('ws');

// Lista de pares Big Arb
const BIG_ARB_PAIRS = [
  "BTC_USDT", "ETH_USDT", "SOL_USDT", "BNB_USDT", "XRP_USDT",
  "LINK_USDT", "AAVE_USDT", "APT_USDT", "SUI_USDT", "NEAR_USDT", "ONDO_USDT"
];

console.log('🔍 TESTE BIG ARB WEBSOCKET');
console.log('📋 Pares monitorados:', BIG_ARB_PAIRS);
console.log('⏳ Conectando ao WebSocket...\n');

// Conectar ao WebSocket
const ws = new WebSocket('ws://localhost:8080');

// Contadores para estatísticas
const stats = {
  totalMessages: 0,
  arbitrageOpportunities: 0,
  bigArbOpportunities: 0,
  priceUpdates: 0,
  bigArbPriceUpdates: 0,
  foundPairs: new Set(),
  bigArbFoundPairs: new Set()
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
      stats.foundPairs.add(message.baseSymbol);
      
      // Verificar se é um par Big Arb
      if (BIG_ARB_PAIRS.includes(message.baseSymbol)) {
        stats.bigArbOpportunities++;
        stats.bigArbFoundPairs.add(message.baseSymbol);
        
        console.log(`🎯 BIG ARB OPORTUNIDADE ENCONTRADA:`);
        console.log(`   Par: ${message.baseSymbol}`);
        console.log(`   Spread: ${message.profitPercentage.toFixed(4)}%`);
        console.log(`   Compra: ${message.buyAt.exchange} (${message.buyAt.marketType}) - ${message.buyAt.price.toFixed(8)}`);
        console.log(`   Venda: ${message.sellAt.exchange} (${message.sellAt.marketType}) - ${message.sellAt.price.toFixed(8)}`);
        console.log(`   Direção: ${message.arbitrageType}`);
        console.log('');
      }
    } else if (message.type === 'price-update') {
      stats.priceUpdates++;
      
      // Verificar se é um par Big Arb
      if (BIG_ARB_PAIRS.includes(message.symbol)) {
        stats.bigArbPriceUpdates++;
        console.log(`💰 BIG ARB PREÇO: ${message.symbol} - Ask: ${message.bestAsk}, Bid: ${message.bestBid} (${message.marketType})`);
      }
    }

    // Mostrar estatísticas a cada 50 mensagens
    if (stats.totalMessages % 50 === 0) {
      console.log(`📈 ESTATÍSTICAS (${stats.totalMessages} mensagens):`);
      console.log(`   Oportunidades totais: ${stats.arbitrageOpportunities}`);
      console.log(`   Oportunidades Big Arb: ${stats.bigArbOpportunities}`);
      console.log(`   Atualizações de preço: ${stats.priceUpdates}`);
      console.log(`   Atualizações Big Arb: ${stats.bigArbPriceUpdates}`);
      console.log(`   Pares encontrados: ${Array.from(stats.foundPairs).join(', ')}`);
      console.log(`   Pares Big Arb encontrados: ${Array.from(stats.bigArbFoundPairs).join(', ')}`);
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
  console.log(`   Oportunidades Big Arb: ${stats.bigArbOpportunities}`);
  console.log(`   Atualizações de preço: ${stats.priceUpdates}`);
  console.log(`   Atualizações Big Arb: ${stats.bigArbPriceUpdates}`);
  console.log(`   Pares encontrados: ${Array.from(stats.foundPairs).join(', ')}`);
  console.log(`   Pares Big Arb encontrados: ${Array.from(stats.bigArbFoundPairs).join(', ')}`);
  console.log('\n✅ Teste concluído!');
  process.exit(0);
});

// Encerrar após 2 minutos
setTimeout(() => {
  console.log('\n⏰ Tempo limite atingido. Encerrando teste...');
  ws.close();
}, 120000); 