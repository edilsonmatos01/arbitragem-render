const { MexcConnector } = require('./scripts/connectors/dist/mexc-connector');
const { MexcFuturesConnector } = require('./scripts/connectors/dist/mexc-futures-connector');

// Função para testar o WebSocket Spot
function testSpotWebSocket() {
    console.log('\n=== Testando WebSocket MEXC Spot ===');
    const spotConnector = new MexcConnector(
        'MEXC Spot',
        (data) => {
            console.log('[MEXC Spot] Atualização de preço recebida:', data);
        },
        () => {
            console.log('[MEXC Spot] Conectado com sucesso');
            // Inscreve em alguns pares para teste
            spotConnector.subscribe(['BTC/USDT', 'ETH/USDT']);
        }
    );

    spotConnector.connect();
}

// Função para testar o WebSocket Futures
function testFuturesWebSocket() {
    console.log('\n=== Testando WebSocket MEXC Futures ===');
    const futuresConnector = new MexcFuturesConnector(
        'MEXC Futures',
        (data) => {
            console.log('[MEXC Futures] Atualização de preço recebida:', data);
        },
        () => {
            console.log('[MEXC Futures] Conectado com sucesso');
            // Inscreve em alguns pares para teste
            futuresConnector.subscribe(['BTC/USDT', 'ETH/USDT']);
        }
    );

    futuresConnector.connect();
}

// Inicia os testes
console.log('Iniciando testes de WebSocket...');
testSpotWebSocket();
testFuturesWebSocket();

// Mantém o processo rodando
process.on('SIGINT', () => {
    console.log('Encerrando testes...');
    process.exit();
}); 