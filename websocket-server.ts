require('dotenv').config();

import WebSocket from 'ws';
import { createServer, IncomingMessage, Server } from 'http';
import { GateIoConnector } from './src/gateio-connector';
import { MexcConnector } from './src/mexc-connector';
import { MarketPrices, ArbitrageOpportunity } from './src/types';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PORT = process.env.PORT || 10000;
const MIN_PROFIT_PERCENTAGE = 0.1;

let marketPrices: MarketPrices = {};
let targetPairs: string[] = [];

// Estendemos a interface do WebSocket para adicionar nossa propriedade de controle
interface CustomWebSocket extends WebSocket {
  isAlive?: boolean;
}

let clients: CustomWebSocket[] = []; // Usamos o tipo estendido

// ✅ Nova função centralizadora para lidar com todas as atualizações de preço
function handlePriceUpdate(update: { type: string, symbol: string, marketType: string, bestAsk: number, bestBid: number, identifier: string }) {
    const { identifier, symbol, priceData, marketType, bestAsk, bestBid } = update as any;

    // 1. Atualiza o estado central de preços
    if (!marketPrices[identifier]) {
        marketPrices[identifier] = {};
    }
    marketPrices[identifier][symbol] = { bestAsk, bestBid, timestamp: Date.now() };
    
    // 2. Transmite a atualização para todos os clientes
    broadcast({
        type: 'price-update',
        symbol,
        marketType,
        bestAsk,
        bestBid
    });
}

export function startWebSocketServer(httpServer: Server) {
    const wss = new WebSocket.Server({ server: httpServer });

    wss.on('connection', (ws: CustomWebSocket, req: IncomingMessage) => {
        ws.isAlive = true; // A conexão está viva ao ser estabelecida

        ws.on('pong', () => {
          ws.isAlive = true; // O cliente respondeu ao nosso ping, então está vivo
        });
        
        const clientIp = req.socket.remoteAddress || req.headers['x-forwarded-for'];
        clients.push(ws);
        console.log(`[WS Server] Cliente conectado: ${clientIp}. Total: ${clients.length}`);

        if (Object.keys(marketPrices).length > 0) {
            ws.send(JSON.stringify({ type: 'full_book', data: marketPrices }));
        }

        ws.on('close', () => {
            clients = clients.filter(c => c !== ws);
            console.log(`[WS Server] Cliente desconectado: ${clientIp}. Total: ${clients.length}`);
        });
    });
    
    // Intervalo para verificar conexões e mantê-las vivas
    const interval = setInterval(() => {
        wss.clients.forEach(client => {
            const ws = client as CustomWebSocket;

            // Se o cliente não respondeu ao PING do ciclo anterior, encerre.
            if (ws.isAlive === false) {
                console.log('[WS Server] Conexão inativa terminada.');
                return ws.terminate();
            }

            // Marque como inativo e envie um PING. A resposta 'pong' marcará como vivo novamente.
            ws.isAlive = false; 
            ws.ping(() => {}); // A função de callback vazia é necessária.
        });
    }, 30000); // A cada 30 segundos

    wss.on('close', () => {
        clearInterval(interval); // Limpa o intervalo quando o servidor é fechado
    });

    console.log(`Servidor WebSocket iniciado e anexado ao servidor HTTP.`);
    startFeeds();
}

// --- Início: Adição para Servidor Standalone ---

// Esta função cria e inicia um servidor HTTP que usa a nossa lógica WebSocket.
function initializeStandaloneServer() {
    const httpServer = createServer((req, res) => {
        // O servidor HTTP básico não fará nada além de fornecer uma base para o WebSocket.
        // Podemos adicionar um endpoint de health check simples.
        if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', message: 'WebSocket server is running' }));
        } else {
            res.writeHead(404);
            res.end();
        }
    });

    // Anexa a lógica do WebSocket ao nosso servidor HTTP.
    startWebSocketServer(httpServer);

    httpServer.listen(PORT, () => {
        console.log(`[Servidor Standalone] Servidor HTTP e WebSocket escutando na porta ${PORT}`);
    });
}

// Inicia o servidor standalone.
// O `require.main === module` garante que este código só rode quando
// o arquivo é executado diretamente (ex: `node dist/websocket-server.js`),
// mas não quando é importado por outro arquivo (como o `server.js` em dev).
if (require.main === module) {
    initializeStandaloneServer();
}

// --- Fim: Adição para Servidor Standalone ---

function broadcast(data: any) {
    const serializedData = JSON.stringify(data);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(serializedData);
        }
    });
}

// Versão corrigida da função com logs de depuração
function broadcastOpportunity(opportunity: ArbitrageOpportunity) {
    console.log(`[DEBUG] Verificando ${opportunity.baseSymbol} | Spread: ${opportunity.profitPercentage.toFixed(2)}%`);

    if (!isFinite(opportunity.profitPercentage) || opportunity.profitPercentage > 100) {
        console.warn(`[FILTRO] Spread >100% IGNORADO para ${opportunity.baseSymbol}: ${opportunity.profitPercentage.toFixed(2)}%`);
        return;
    }
    
    broadcast({ ...opportunity, type: 'arbitrage' });
    console.log(`[Broadcast] Oportunidade VÁLIDA enviada: ${opportunity.baseSymbol} ${opportunity.profitPercentage.toFixed(2)}%`);
}

async function recordSpread(opportunity: ArbitrageOpportunity) {
    if (typeof opportunity.profitPercentage !== 'number' || !isFinite(opportunity.profitPercentage)) {
        console.warn(`[Prisma] Spread inválido para ${opportunity.baseSymbol}, gravação ignorada.`);
        return;
    }

    try {
        await prisma.spreadHistory.create({
            data: {
                symbol: opportunity.baseSymbol,
                exchangeBuy: opportunity.buyAt.exchange,
                exchangeSell: opportunity.sellAt.exchange,
                direction: opportunity.arbitrageType,
                spread: opportunity.profitPercentage,
            },
        });
    } catch (error) {
        console.error(`[Prisma] Erro ao gravar spread para ${opportunity.baseSymbol}:`, error);
    }
}

async function getSpreadStats(opportunity: ArbitrageOpportunity): Promise<{ spMax: number | null; spMin: number | null; crosses: number }> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    try {
        const stats = await prisma.spreadHistory.aggregate({
            _max: { spread: true },
            _min: { spread: true },
            _count: { id: true },
            where: {
                symbol: opportunity.baseSymbol,
                exchangeBuy: opportunity.buyAt.exchange,
                exchangeSell: opportunity.sellAt.exchange,
                direction: opportunity.arbitrageType,
                timestamp: {
                    gte: twentyFourHoursAgo,
                },
            },
        });

        return {
            spMax: stats._max.spread,
            spMin: stats._min.spread,
            crosses: stats._count.id,
        };
    } catch (error) {
        console.error(`[Prisma] Erro ao buscar estatísticas de spread para ${opportunity.baseSymbol}:`, error);
        return { spMax: null, spMin: null, crosses: 0 };
    }
}

function getNormalizedData(symbol: string): { baseSymbol: string, factor: number } {
    const match = symbol.match(/^(\d+)(.+)$/);
    if (match) {
        const factor = parseInt(match[1], 10);
        const baseSymbol = match[2];
        return { baseSymbol, factor };
    }
    return { baseSymbol: symbol, factor: 1 };
}

async function findAndBroadcastArbitrage() {
    const exchangeIdentifiers = Object.keys(marketPrices);
    if (exchangeIdentifiers.length < 2) return;

    for (const spotId of exchangeIdentifiers.filter(id => !id.toUpperCase().includes('FUTURES'))) {
        const futuresId = exchangeIdentifiers.find(id => id.toUpperCase().includes('FUTURES'));
        if (!futuresId) continue;

        const spotPrices = marketPrices[spotId];
        const futuresPrices = marketPrices[futuresId];

        for (const spotSymbol in spotPrices) {
            const spotData = getNormalizedData(spotSymbol);
            
            const futuresSymbol = Object.keys(futuresPrices).find(fs => {
                const futuresData = getNormalizedData(fs);
                return futuresData.baseSymbol === spotData.baseSymbol;
            });

            if (!futuresSymbol) continue;

            const futuresData = getNormalizedData(futuresSymbol);
            
            // Normalizar preços para comparação
            const normalizedSpotAsk = spotPrices[spotSymbol].bestAsk * (futuresData.factor / spotData.factor);
            const normalizedFuturesBid = futuresPrices[futuresSymbol].bestBid * (futuresData.factor / spotData.factor);

            if (normalizedSpotAsk <= 0 || normalizedFuturesBid <= 0) continue;

            // Cálculo do spread apenas para arbitragem spot-to-futures
            const spread = ((normalizedFuturesBid - normalizedSpotAsk) / normalizedSpotAsk) * 100;
            
            // Só processa se houver oportunidade (spread positivo)
            if (spread >= MIN_PROFIT_PERCENTAGE) {
                const opportunity: ArbitrageOpportunity = {
                    type: 'arbitrage',
                    baseSymbol: spotData.baseSymbol,
                    profitPercentage: spread, // Mantém o sinal original
                    buyAt: { 
                        exchange: spotId, 
                        price: spotPrices[spotSymbol].bestAsk, 
                        marketType: 'spot', 
                        originalSymbol: spotSymbol 
                    },
                    sellAt: { 
                        exchange: futuresId, 
                        price: futuresPrices[futuresSymbol].bestBid, 
                        marketType: 'futures', 
                        originalSymbol: futuresSymbol 
                    },
                    arbitrageType: 'spot_to_futures_inter',
                    timestamp: Date.now()
                };
                await recordSpread(opportunity);
                const stats = await getSpreadStats(opportunity);
                const opportunityWithStats = {
                    ...opportunity,
                    spMax: stats.spMax ?? undefined,
                    spMin: stats.spMin ?? undefined,
                    crosses: stats.crosses,
                };
                broadcastOpportunity(opportunityWithStats);
            }
        }
    }
}

async function startFeeds() {
    console.log("Iniciando feeds de dados...");
    
    // Passa a função 'handlePriceUpdate' para os conectores
    const gateIoSpotConnector = new GateIoConnector('GATEIO_SPOT', handlePriceUpdate);
    const gateIoFuturesConnector = new GateIoConnector('GATEIO_FUTURES', handlePriceUpdate);
    
    const mexcConnector = new MexcConnector('MEXC_FUTURES', handlePriceUpdate, () => {
        const mexcPairs = targetPairs.map(p => p.replace('/', '_'));
        mexcConnector.subscribe(mexcPairs);
    });

    try {
        const spotPairs = await gateIoSpotConnector.getTradablePairs();
        const futuresPairs = await gateIoFuturesConnector.getTradablePairs();
        
        targetPairs = spotPairs.filter(p => futuresPairs.includes(p));
        
        console.log(`Encontrados ${targetPairs.length} pares em comum.`);
        
        gateIoSpotConnector.connect(targetPairs);
        gateIoFuturesConnector.connect(targetPairs);
        mexcConnector.connect();

        console.log(`Monitorando ${targetPairs.length} pares.`);
        setInterval(findAndBroadcastArbitrage, 5000);
    } catch (error) {
        console.error("Erro fatal ao iniciar os feeds:", error);
    }
}
