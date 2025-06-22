const { GateIoConnector } = require('./dist/src/gateio-connector');

console.log('🧪 TESTE INDIVIDUAL - Gate.io Spot');
console.log('================================');

let messageCount = 0;
let connectionTime = Date.now();
let lastMessageTime = Date.now();

function handlePriceUpdate(data) {
    messageCount++;
    lastMessageTime = Date.now();
    const uptime = Math.round((Date.now() - connectionTime) / 1000);
    
    console.log(`📊 [${messageCount}] ${data.symbol} - Ask: ${data.bestAsk}, Bid: ${data.bestBid} (${uptime}s)`);
}

function onConnected() {
    console.log('✅ Gate.io conectado! Iniciando monitoramento...');
    connectionTime = Date.now();
}

// Criar conector
const gateioConnector = new GateIoConnector(
    'GATEIO_TEST',
    handlePriceUpdate,
    onConnected
);

// Conectar com símbolos
setTimeout(() => {
    console.log('📡 Conectando com símbolos de teste...');
    gateioConnector.connect(['BTC/USDT', 'ETH/USDT', 'SOL/USDT']);
}, 2000);

// Monitorar estatísticas a cada 30 segundos
setInterval(() => {
    const uptime = Math.round((Date.now() - connectionTime) / 1000);
    const timeSinceLastMessage = Math.round((Date.now() - lastMessageTime) / 1000);
    
    console.log(`\n📈 ESTATÍSTICAS Gate.io:`);
    console.log(`   ⏱️  Tempo online: ${uptime}s`);
    console.log(`   📨 Mensagens recebidas: ${messageCount}`);
    console.log(`   🕐 Última mensagem: ${timeSinceLastMessage}s atrás`);
    console.log(`   📊 Taxa: ${(messageCount / (uptime || 1) * 60).toFixed(1)} msg/min\n`);
}, 30000);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Encerrando teste Gate.io...');
    gateioConnector.disconnect();
    process.exit(0);
}); 