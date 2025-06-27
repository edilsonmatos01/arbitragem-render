"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var mexc_connector_1 = require("./scripts/connectors/mexc-connector");
// Função para processar atualizações de preço
var handlePriceUpdate = function (data) {
    console.log('\n[MEXC] Atualização de preço recebida:');
    console.log(JSON.stringify(data, null, 2));
};
// Função de callback para conexão
var handleConnected = function () {
    console.log('[MEXC] Conexão estabelecida com sucesso');
    // Lista de pares para teste
    var testPairs = [
        'BTC/USDT',
        'ETH/USDT',
        'SOL/USDT',
        'XRP/USDT',
        'BNB/USDT'
    ];
    console.log("[MEXC] Inscrevendo nos pares: ".concat(testPairs.join(', ')));
    mexcConnector.subscribe(testPairs);
};
// Inicializa o conector MEXC
console.log('[MEXC] Iniciando teste de conexão WebSocket...');
var mexcConnector = new mexc_connector_1.MexcConnector('MEXC_SPOT', handlePriceUpdate, handleConnected);
// Conecta ao WebSocket
mexcConnector.connect();
// Mantém o script rodando
process.on('SIGINT', function () {
    console.log('\n[MEXC] Encerrando conexão...');
    mexcConnector.disconnect();
    process.exit();
});
