const { MexcConnector } = require('./dist/src/mexc-connector');

console.log('🧪 TESTE INDIVIDUAL - MEXC Futures');
console.log('==================================');

let messageCount = 0;
let connectionTime = Date.now();
let lastMessageTime = Date.now();
let reconnectionCount = 0;

function handlePriceUpdate(data) {
    messageCount++;
    lastMessageTime = Date.now();
    const uptime = Math.round((Date.now() - connectionTime) / 1000);
    
    console.log(`📊 [${messageCount}] ${data.symbol} - Ask: ${data.bestAsk}, Bid: ${data.bestBid} (${uptime}s)`);
}

function onConnected() {
    console.log('✅ MEXC conectado! Iniciando monitoramento...');
    if (connectionTime === 0) {
        connectionTime = Date.now();
    } else {
        reconnectionCount++;
        console.log(`🔄 Reconexão #${reconnectionCount}`);
    }
}

// Criar conector
const mexcConnector = new MexcConnector(
    'MEXC_TEST',
    handlePriceUpdate,
    onConnected
);

// Conectar
mexcConnector.connect();

// Inscrever em alguns símbolos
setTimeout(() => {
    console.log('📡 Inscrevendo em símbolos de teste...');
    mexcConnector.subscribe(['BTC/USDT', 'ETH/USDT', 'SOL/USDT']);
}, 2000);

// Monitorar estatísticas a cada 30 segundos
setInterval(() => {
    const uptime = Math.round((Date.now() - connectionTime) / 1000);
    const timeSinceLastMessage = Math.round((Date.now() - lastMessageTime) / 1000);
    
    console.log(`\n📈 ESTATÍSTICAS MEXC:`);
    console.log(`   ⏱️  Tempo online: ${uptime}s`);
    console.log(`   📨 Mensagens recebidas: ${messageCount}`);
    console.log(`   🔄 Reconexões: ${reconnectionCount}`);
    console.log(`   🕐 Última mensagem: ${timeSinceLastMessage}s atrás`);
    console.log(`   📊 Taxa: ${(messageCount / (uptime || 1) * 60).toFixed(1)} msg/min\n`);
    
    // Alerta se não recebeu mensagens por muito tempo
    if (timeSinceLastMessage > 60) {
        console.log('⚠️  ALERTA: Sem mensagens há mais de 1 minuto!');
    }
}, 30000);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Encerrando teste MEXC...');
    mexcConnector.disconnect();
    process.exit(0);
}); 