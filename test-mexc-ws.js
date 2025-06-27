const { MexcConnector } = require('./scripts/connectors/mexc-connector');

// Função para processar atualizações de preço
const handlePriceUpdate = (data) => {
    console.log('\n[MEXC] Atualização de preço recebida:');
    console.log(JSON.stringify(data, null, 2));
};

// Função de callback para conexão
const handleConnected = () => {
    console.log('[MEXC] Conexão estabelecida com sucesso');
    
    // Lista de pares para teste
    const testPairs = [
        'BTC/USDT',
        'ETH/USDT',
        'SOL/USDT',
        'XRP/USDT',
        'BNB/USDT'
    ];
    
    console.log(`[MEXC] Inscrevendo nos pares: ${testPairs.join(', ')}`);
    mexcConnector.subscribe(testPairs);
};

// Inicializa o conector MEXC
console.log('[MEXC] Iniciando teste de conexão WebSocket...');
const mexcConnector = new MexcConnector('MEXC_SPOT', handlePriceUpdate, handleConnected);

// Conecta ao WebSocket
mexcConnector.connect();

// Mantém o script rodando
process.on('SIGINT', () => {
    console.log('\n[MEXC] Encerrando conexão...');
    mexcConnector.disconnect();
    process.exit();
}); 