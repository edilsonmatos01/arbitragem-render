import { MexcConnector } from './connectors/mexc-connector';

interface PriceUpdate {
    type: string;
    symbol: string;
    marketType: string;
    bestAsk: number;
    bestBid: number;
    identifier: string;
}

async function startWorker() {
    console.log('[Worker] Iniciando worker em segundo plano...');

    // Inicia o conector MEXC
    const mexcSpot = new MexcConnector(
        'MEXC Spot',
        (data: PriceUpdate) => {
            console.log('[MEXC Spot] Atualização de preço:', JSON.stringify(data));
        },
        () => {
            console.log('[MEXC Spot] Conexão estabelecida');
        }
    );

    // Inicia a conexão
    console.log('[Worker] Iniciando conexão MEXC...');
    mexcSpot.connect();

    // Lista de símbolos para monitorar
    const symbols = [
        'BTC/USDT',
        'ETH/USDT',
        'SOL/USDT',
        'XRP/USDT',
        'BNB/USDT'
    ];

    // Subscreve aos símbolos após um delay
    setTimeout(() => {
        console.log('[Worker] Iniciando subscrições MEXC...');
        mexcSpot.subscribe(symbols);
    }, 5000); // Aguarda 5 segundos antes de iniciar as subscrições

    // Handler para encerramento gracioso
    process.on('SIGINT', () => {
        console.log('[Worker] Recebido sinal de encerramento, desconectando...');
        mexcSpot.disconnect();
        process.exit(0);
    });

    console.log(`[Worker ${new Date().toISOString()}] Iniciando monitoramento...`);
    
    return { mexcSpot };
}

// Inicia o worker
startWorker().catch(error => {
    console.error('[Worker] Erro fatal:', error);
    process.exit(1);
}); 