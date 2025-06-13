"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const http_1 = require("http");
const gateio_connector_js_1 = require("./src/gateio-connector.js");
const mexc_connector_js_1 = require("./src/mexc-connector.js");
const PORT = process.env.PORT || 3001;
// Restaurado para o valor de produção: apenas oportunidades com lucro > 0.1% serão enviadas.
const MIN_PROFIT_PERCENTAGE = 0.1;
// Estrutura de dados central para armazenar os preços de todos os mercados.
let marketPrices = {};
// Lista de pares a serem monitorados. Será preenchida dinamicamente.
let targetPairs = [];
const server = (0, http_1.createServer)();
const wss = new ws_1.WebSocketServer({ server });
let clients = [];
wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress || req.headers['x-forwarded-for'];
    clients.push(ws);
    console.log(`[WS Server] Cliente conectado: ${clientIp}. Total: ${clients.length}`);
    // Envia o estado atual de preços para o novo cliente, se houver
    if (Object.keys(marketPrices).length > 0) {
        ws.send(JSON.stringify({ type: 'full_book', data: marketPrices }));
    }
    ws.on('close', () => {
        clients = clients.filter(c => c !== ws);
        console.log(`[WS Server] Cliente desconectado: ${clientIp}. Total: ${clients.length}`);
    });
});
function broadcast(data) {
    const serializedData = JSON.stringify(data);
    clients.forEach(client => {
        if (client.readyState === ws_1.WebSocket.OPEN) {
            client.send(serializedData);
        }
    });
}
/**
 * Envia uma única oportunidade de arbitragem para todos os clientes.
 * @param opportunity - O objeto da oportunidade de arbitragem.
 */
function broadcastOpportunity(opportunity) {
    // O frontend espera o tipo 'arbitrage', então garantimos que ele seja enviado assim.
    const message = { ...opportunity, type: 'arbitrage' };
    broadcast(message);
    console.log(`[Broadcast] Oportunidade enviada: ${opportunity.baseSymbol} ${opportunity.profitPercentage.toFixed(2)}%`);
}
/**
 * A função principal que varre os preços em busca de oportunidades de arbitragem.
 * Agora é chamada em um intervalo fixo.
 */
function findAndBroadcastArbitrage() {
    const opportunities = [];
    // Identificadores exatos que estamos usando
    const gateioSpotIdentifier = 'GATEIO_SPOT';
    const mexcFuturesIdentifier = 'MEXC_FUTURES';
    const gateioPrices = marketPrices[gateioSpotIdentifier];
    const mexcPrices = marketPrices[mexcFuturesIdentifier];
    // Se um dos feeds de preço não estiver pronto, não há o que fazer.
    if (!gateioPrices || !mexcPrices)
        return;
    // Itera sobre todos os pares que temos em comum (ou todos da Gate.io como base)
    for (const symbol of targetPairs) {
        const spotPriceData = gateioPrices[symbol];
        const futuresPriceData = mexcPrices[symbol];
        // Precisa ter preço para o mesmo símbolo em ambas as exchanges
        if (spotPriceData && futuresPriceData) {
            // A estratégia é: Comprar Spot (Gate.io), Vender Futuros (MEXC)
            const buyPrice = spotPriceData.bestAsk; // O preço que pagamos para comprar na Gate.io
            const sellPrice = futuresPriceData.bestBid; // O preço que recebemos para vender na MEXC
            if (buyPrice > 0 && sellPrice > 0) {
                const profitPercentage = ((sellPrice - buyPrice) / buyPrice) * 100;
                if (profitPercentage >= MIN_PROFIT_PERCENTAGE) {
                    const opportunity = {
                        type: 'arbitrage',
                        baseSymbol: symbol,
                        profitPercentage: profitPercentage,
                        buyAt: {
                            exchange: gateioSpotIdentifier,
                            price: buyPrice,
                            marketType: 'spot'
                        },
                        sellAt: {
                            exchange: mexcFuturesIdentifier,
                            price: sellPrice,
                            marketType: 'futures'
                        },
                        arbitrageType: `spot_futures_inter_exchange`,
                        timestamp: Date.now()
                    };
                    opportunities.push(opportunity);
                }
            }
        }
    }
    if (opportunities.length > 0) {
        // Ordena por lucratividade e envia
        opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
        console.log(`Encontradas ${opportunities.length} oportunidades (Spot->Futures). Transmitindo...`);
        // Envia cada oportunidade individualmente
        opportunities.forEach(op => {
            broadcastOpportunity(op);
        });
    }
}
async function startFeeds() {
    console.log("Iniciando feeds de dados...");
    const gateIoSpotConnector = new gateio_connector_js_1.GateIoConnector('GATEIO_SPOT', marketPrices);
    // O conector da MEXC agora também precisa da referência a marketPrices.
    // O segundo argumento é um callback que é chamado quando a conexão é estabelecida,
    // que usaremos para fazer a inscrição nos pares.
    const mexcConnector = new mexc_connector_js_1.MexcConnector(marketPrices, () => {
        console.log("Conexão com MEXC estabelecida. Inscrevendo-se nos pares...");
        mexcConnector.subscribe(targetPairs);
    });
    try {
        const spotPairs = await gateIoSpotConnector.getTradablePairs();
        console.log(`Gate.io: Encontrados ${spotPairs.length} pares SPOT negociáveis.`);
        // Usamos os pares da Gate.io como nossa lista principal de alvos.
        targetPairs = spotPairs;
        // Inicia as conexões
        gateIoSpotConnector.connect(targetPairs);
        mexcConnector.connect(); // A inscrição será feita no callback onConnected
        console.log(`Monitorando ${targetPairs.length} pares em Gate.io (Spot) e MEXC (Futures).`);
        // Inicia o loop de busca por arbitragem
        setInterval(findAndBroadcastArbitrage, 5000); // Executa a cada 5 segundos para não sobrecarregar
        // A transmissão do livro completo pode ser útil para depuração no frontend
        // setInterval(() => {
        //     broadcast({ type: 'full_book', data: marketPrices });
        // }, 10000); // A cada 10 segundos
    }
    catch (error) {
        console.error("Erro fatal ao iniciar os feeds:", error);
    }
}
server.listen(PORT, () => {
    console.log(`Servidor WebSocket rodando na porta ${PORT}`);
    startFeeds();
});
process.on('SIGINT', () => {
    console.log("Desligando o servidor...");
    wss.close();
    server.close();
    process.exit();
});
