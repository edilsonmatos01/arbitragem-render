import { GateIoConnector } from './connectors/gateio-connector';
import { MexcConnector } from './connectors/mexc-connector';
import { GateIoFuturesConnector } from './connectors/gateio-futures-connector';
import { MexcFuturesConnector } from './connectors/mexc-futures-connector';

interface MarketPrice {
  symbol: string;
  bestAsk: number;
  bestBid: number;
}

// Função para processar atualizações de preço
const handlePriceUpdate = (data: MarketPrice) => {
  console.log(`[${new Date().toISOString()}] Atualização de preço:`, data);
};

// Função de callback para conexão
const handleConnected = (exchange: string) => {
  console.log(`[${new Date().toISOString()}] ✅ ${exchange}: Conexão estabelecida com sucesso`);
};

// Inicializa os conectores
console.log('[TESTE] Iniciando teste de conexões WebSocket...\n');

const gateioSpot = new GateIoConnector('GATEIO_SPOT', handlePriceUpdate);

const mexcSpot = new MexcConnector(
  'MEXC_SPOT',
  handlePriceUpdate,
  () => handleConnected('MEXC Spot')
);

const gateioFutures = new GateIoFuturesConnector(
  'GATEIO_FUTURES',
  handlePriceUpdate,
  () => handleConnected('Gate.io Futures')
);

const mexcFutures = new MexcFuturesConnector(
  'MEXC_FUTURES',
  handlePriceUpdate,
  () => handleConnected('MEXC Futures')
);

// Função para testar a obtenção de pares negociáveis
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

  } catch (error) {
    console.error('\n[ERRO] Falha ao obter pares negociáveis:', error);
  }
}

// Executa o teste
console.log('Aguardando conexões (30 segundos)...\n');

// Aguarda 30 segundos para verificar as conexões e então testa os pares negociáveis
setTimeout(async () => {
  await testTradablePairs();
  
  // Aguarda mais 30 segundos para receber algumas atualizações de preço
  console.log('\nAguardando atualizações de preço (30 segundos)...');
  
  setTimeout(() => {
    console.log('\n[TESTE] Teste concluído. Encerrando...');
    process.exit(0);
  }, 30000);
}, 30000); 