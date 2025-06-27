const WebSocket = require('ws');

console.log('Conectando ao WebSocket do servidor...');
const ws = new WebSocket('wss://arbitragem-render-03-correcao-de-spread.onrender.com');

ws.on('open', () => {
    console.log('✅ Conectado ao WebSocket do servidor');
});

ws.on('message', (data) => {
    try {
        const msg = JSON.parse(data.toString());
        
        if (msg.type === 'full_book') {
            console.log('\n📊 ESTRUTURA DOS DADOS DE MERCADO:');
            console.log('Exchanges disponíveis:', Object.keys(msg.data));
            
            Object.keys(msg.data).forEach(exchange => {
                const symbols = Object.keys(msg.data[exchange]);
                console.log(`${exchange}: ${symbols.length} símbolos`);
                if (symbols.length > 0) {
                    console.log(`  Primeiros 5: ${symbols.slice(0, 5).join(', ')}`);
                    // Mostra um exemplo de dados
                    const firstSymbol = symbols[0];
                    const priceData = msg.data[exchange][firstSymbol];
                    console.log(`  Exemplo (${firstSymbol}):`, priceData);
                }
            });
        }
        
        if (msg.type === 'price-update') {
            console.log(`💰 Price Update: ${msg.symbol} - Ask: ${msg.bestAsk}, Bid: ${msg.bestBid}`);
        }
        
        if (msg.type === 'arbitrage') {
            console.log(`🎯 OPORTUNIDADE ENCONTRADA!`);
            console.log(`   Par: ${msg.baseSymbol}`);
            console.log(`   Spread: ${msg.profitPercentage}%`);
            console.log(`   Compra: ${msg.buyAt.exchange} (${msg.buyAt.price})`);
            console.log(`   Venda: ${msg.sellAt.exchange} (${msg.sellAt.price})`);
        }
        
    } catch (error) {
        console.error('Erro ao processar mensagem:', error);
    }
});

ws.on('error', (error) => {
    console.error('❌ Erro na conexão:', error);
});

ws.on('close', () => {
    console.log('🔌 Conexão fechada');
});

// Encerra após 15 segundos
setTimeout(() => {
    console.log('\n⏰ Encerrando teste...');
    ws.close();
    process.exit(0);
}, 15000); 