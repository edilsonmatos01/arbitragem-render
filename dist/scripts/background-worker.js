"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mexc_connector_1 = require("./connectors/mexc-connector");
async function startWorker() {
    console.log('[Worker] Iniciando worker em segundo plano...');
    const mexcSpot = new mexc_connector_1.MexcConnector('MEXC Spot', (data) => {
        console.log('[MEXC Spot] Atualização de preço:', JSON.stringify(data));
    }, () => {
        console.log('[MEXC Spot] Conexão estabelecida');
    });
    console.log('[Worker] Iniciando conexão MEXC...');
    mexcSpot.connect();
    const symbols = [
        'BTC/USDT',
        'ETH/USDT',
        'SOL/USDT',
        'XRP/USDT',
        'BNB/USDT'
    ];
    setTimeout(() => {
        console.log('[Worker] Iniciando subscrições MEXC...');
        mexcSpot.subscribe(symbols);
    }, 5000);
    process.on('SIGINT', () => {
        console.log('[Worker] Recebido sinal de encerramento, desconectando...');
        mexcSpot.disconnect();
        process.exit(0);
    });
    console.log(`[Worker ${new Date().toISOString()}] Iniciando monitoramento...`);
    return { mexcSpot };
}
startWorker().catch(error => {
    console.error('[Worker] Erro fatal:', error);
    process.exit(1);
});
//# sourceMappingURL=background-worker.js.map