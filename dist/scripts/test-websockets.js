"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const gateio_connector_1 = require("./connectors/gateio-connector");
const mexc_connector_1 = require("./connectors/mexc-connector");
const gateio_futures_connector_1 = require("./connectors/gateio-futures-connector");
const mexc_futures_connector_1 = require("./connectors/mexc-futures-connector");
const handlePriceUpdate = (data) => {
    console.log(`[${new Date().toISOString()}] Atualização de preço:`, data);
};
const handleConnected = (exchange) => {
    console.log(`[${new Date().toISOString()}] ✅ ${exchange}: Conexão estabelecida com sucesso`);
};
console.log('[TESTE] Iniciando teste de conexões WebSocket...\n');
const gateioSpot = new gateio_connector_1.GateIoConnector('GATEIO_SPOT', handlePriceUpdate);
const mexcSpot = new mexc_connector_1.MexcConnector('MEXC_SPOT', handlePriceUpdate, () => handleConnected('MEXC Spot'));
const gateioFutures = new gateio_futures_connector_1.GateIoFuturesConnector('GATEIO_FUTURES', handlePriceUpdate, () => handleConnected('Gate.io Futures'));
const mexcFutures = new mexc_futures_connector_1.MexcFuturesConnector('MEXC_FUTURES', handlePriceUpdate, () => handleConnected('MEXC Futures'));
async function testTradablePairs() {
    try {
        console.log('\n[TESTE] Obtendo pares negociáveis...\n');
        const gateioSpotPairs = await gateioSpot.getTradablePairs();
        console.log('Gate.io Spot - Primeiros 5 pares:', gateioSpotPairs.slice(0, 5));
        const mexcSpotPairs = await mexcSpot.getTradablePairs();
        console.log('MEXC Spot - Primeiros 5 pares:', mexcSpotPairs.slice(0, 5));
        const gateioFuturesPairs = await gateioFutures.getTradablePairs();
        console.log('Gate.io Futures - Primeiros 5 pares:', gateioFuturesPairs.slice(0, 5));
        const mexcFuturesPairs = await mexcFutures.getTradablePairs();
        console.log('MEXC Futures - Primeiros 5 pares:', mexcFuturesPairs.slice(0, 5));
    }
    catch (error) {
        console.error('\n[ERRO] Falha ao obter pares negociáveis:', error);
    }
}
console.log('Aguardando conexões (30 segundos)...\n');
setTimeout(async () => {
    await testTradablePairs();
    console.log('\nAguardando atualizações de preço (30 segundos)...');
    setTimeout(() => {
        console.log('\n[TESTE] Teste concluído. Encerrando...');
        process.exit(0);
    }, 30000);
}, 30000);
//# sourceMappingURL=test-websockets.js.map