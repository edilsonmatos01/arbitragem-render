require('dotenv').config();

import WebSocket from 'ws';
import { createServer, IncomingMessage, Server } from 'http';
import { GateioConnector } from './gateio-connector';
import { MexcConnector } from './mexc-connector';
import { MarketPrices, ArbitrageOpportunity, PriceUpdate } from './types';
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
function handlePriceUpdate(update: PriceUpdate) {
    const { identifier, symbol, marketType, bestAsk, bestBid } = update;

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
        return {
            baseSymbol: match[2],
            factor: parseInt(match[1], 10)
        };
    }
    return {
        baseSymbol: symbol,
        factor: 1
    };
}

async function findAndBroadcastArbitrage() {
    for (const symbol of targetPairs) {
        const gateioData = marketPrices['gateio']?.[symbol];
        const mexcData = marketPrices['mexc']?.[symbol];

        if (!gateioData || !mexcData) continue;

        // Verifica se os preços são válidos
        if (!isFinite(gateioData.bestAsk) || !isFinite(gateioData.bestBid) ||
            !isFinite(mexcData.bestAsk) || !isFinite(mexcData.bestBid)) {
            continue;
        }

        // Calcula oportunidades de arbitragem
        const gateioToMexc = ((mexcData.bestBid - gateioData.bestAsk) / gateioData.bestAsk) * 100;
        const mexcToGateio = ((gateioData.bestBid - mexcData.bestAsk) / mexcData.bestAsk) * 100;

        // Processa oportunidade Gate.io -> MEXC
        if (gateioToMexc > MIN_PROFIT_PERCENTAGE) {
            const opportunity: ArbitrageOpportunity = {
                type: 'arbitrage',
                baseSymbol: symbol,
                profitPercentage: gateioToMexc,
                arbitrageType: 'gateio_to_mexc',
                buyAt: {
                    exchange: 'gateio',
                    price: gateioData.bestAsk,
                    marketType: 'spot'
                },
                sellAt: {
                    exchange: 'mexc',
                    price: mexcData.bestBid,
                    marketType: 'futures'
                },
                timestamp: Date.now()
            };
            
            broadcastOpportunity(opportunity);
            await recordSpread(opportunity);
        }

        // Processa oportunidade MEXC -> Gate.io
        if (mexcToGateio > MIN_PROFIT_PERCENTAGE) {
            const opportunity: ArbitrageOpportunity = {
                type: 'arbitrage',
                baseSymbol: symbol,
                profitPercentage: mexcToGateio,
                arbitrageType: 'mexc_to_gateio',
                buyAt: {
                    exchange: 'mexc',
                    price: mexcData.bestAsk,
                    marketType: 'futures'
                },
                sellAt: {
                    exchange: 'gateio',
                    price: gateioData.bestBid,
                    marketType: 'spot'
                },
                timestamp: Date.now()
            };
            
            broadcastOpportunity(opportunity);
            await recordSpread(opportunity);
        }
    }
}

async function startFeeds() {
    const gateio = new GateioConnector();
    const mexc = new MexcConnector();

    gateio.onPriceUpdate(handlePriceUpdate);
    mexc.onPriceUpdate(handlePriceUpdate);

    try {
        await gateio.connect();
        await mexc.connect();

        // Inicia o monitoramento de oportunidades de arbitragem
        setInterval(findAndBroadcastArbitrage, 1000);

    } catch (error) {
        console.error('Erro ao iniciar os feeds:', error);
        process.exit(1);
    }
} 