require('dotenv').config();

import WebSocket from 'ws';
import { createServer, IncomingMessage } from 'http';
import { GateIoConnector } from './src/gateio-connector';
import { MexcConnector } from './src/mexc-connector';
import { MarketPrices, ArbitrageOpportunity } from './src/types';
import { PrismaClient } from '@prisma/client';
import { calculateSpread } from './app/utils/spreadUtils';

const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;
const MIN_PROFIT_PERCENTAGE = 0.1;

let marketPrices: MarketPrices = {};
let targetPairs: string[] = [];

interface CustomWebSocket extends WebSocket {
    isAlive?: boolean;
}

let clients: CustomWebSocket[] = [];

// ✅ Nova função centralizadora para lidar com todas as atualizações de preço
function handlePriceUpdate(update: { type: string, symbol: string, marketType: string, bestAsk: number, bestBid: number, identifier: string }) {
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

export function startWebSocketServer(httpServer: ReturnType<typeof createServer>) {
    const wss = new WebSocket.Server({ 
        server: httpServer,
        perMessageDeflate: false,
        clientTracking: true,
        maxPayload: 1024 * 1024, // 1MB
        verifyClient: (info, cb) => {
            // Aceita conexões de qualquer origem em produção
            const isProduction = process.env.NODE_ENV === 'production';
            if (isProduction) {
                cb(true);
                return;
            }

            // Em desenvolvimento, aceita apenas localhost
            const origin = info.origin || '';
            const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
            cb(isLocalhost);
        }
    });

    wss.on('connection', (ws: CustomWebSocket, req: IncomingMessage) => {
        ws.isAlive = true;

        // Configura o ping-pong para manter a conexão ativa
        const pingInterval = setInterval(() => {
            if (ws.isAlive === false) {
                clearInterval(pingInterval);
                return ws.terminate();
            }
            ws.isAlive = false;
            try {
                ws.ping();
            } catch (error) {
                console.error('Erro ao enviar ping:', error);
                clearInterval(pingInterval);
                ws.terminate();
            }
        }, 30000);

        ws.on('pong', () => {
            ws.isAlive = true;
        });

        ws.on('error', (error) => {
            console.error('Erro na conexão WebSocket:', error);
            clearInterval(pingInterval);
            ws.terminate();
        });

        const clientIp = req.socket.remoteAddress || req.headers['x-forwarded-for'];
        clients.push(ws);
        console.log(`[WS Server] Cliente conectado: ${clientIp}. Total: ${clients.length}`);

        // Envia o estado inicial
        if (Object.keys(marketPrices).length > 0) {
            try {
                ws.send(JSON.stringify({ 
                    type: 'full_book', 
                    data: marketPrices,
                    timestamp: Date.now()
                }));
            } catch (error) {
                console.error('Erro ao enviar estado inicial:', error);
            }
        }

        ws.on('close', (code, reason) => {
            clients = clients.filter(c => c !== ws);
            clearInterval(pingInterval);
            console.log(`[WS Server] Cliente desconectado: ${clientIp}. Código: ${code}, Razão: ${reason}. Total: ${clients.length}`);
        });
    });

    wss.on('close', () => {
        console.log('Servidor WebSocket fechado');
    });

    console.log(`Servidor WebSocket iniciado e anexado ao servidor HTTP.`);
    startFeeds();
}

// --- Início: Adição para Servidor Standalone ---

// Esta função cria e inicia um servidor HTTP que usa a nossa lógica WebSocket.
function initializeStandaloneServer() {
    const httpServer = createServer((req, res) => {
        // Adiciona headers CORS para todas as respostas HTTP
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        // Responde imediatamente a requisições OPTIONS
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        // Health check endpoint
        if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                status: 'ok', 
                message: 'WebSocket server is running',
                clients: clients.length,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // Rota de status do WebSocket
        if (req.url === '/status') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                connectedClients: clients.length,
                exchanges: Object.keys(marketPrices),
                timestamp: new Date().toISOString()
            }));
            return;
        }

        res.writeHead(404);
        res.end();
    });

    // Anexa a lógica do WebSocket ao nosso servidor HTTP.
    startWebSocketServer(httpServer);

    const port = process.env.PORT || 3001;
    httpServer.listen(port, () => {
        console.log(`[Servidor Standalone] HTTP e WebSocket escutando na porta ${port}`);
        console.log(`Health check disponível em: http://localhost:${port}/health`);
        console.log(`Status disponível em: http://localhost:${port}/status`);
    });

    // Tratamento de erros do servidor
    httpServer.on('error', (error) => {
        console.error('Erro no servidor HTTP:', error);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('Recebido sinal SIGTERM, iniciando shutdown...');
        httpServer.close(() => {
            console.log('Servidor HTTP fechado.');
            process.exit(0);
        });
    });
}

// Inicia o servidor standalone.
if (require.main === module) {
    initializeStandaloneServer();
}

// --- Fim: Adição para Servidor Standalone ---

function broadcast(data: any) {
    const serializedData = JSON.stringify(data);
    const deadClients: CustomWebSocket[] = [];

    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(serializedData);
            } catch (error) {
                console.error('Erro ao enviar mensagem para cliente:', error);
                deadClients.push(client);
            }
        } else {
            deadClients.push(client);
        }
    });

    // Remove clientes mortos
    if (deadClients.length > 0) {
        clients = clients.filter(c => !deadClients.includes(c));
        console.log(`Removidos ${deadClients.length} clientes mortos. Total restante: ${clients.length}`);
    }
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
                timestamp: new Date()
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

    const spotId = exchangeIdentifiers.find(id => id === 'GATEIO_SPOT');
    const futuresId = exchangeIdentifiers.find(id => id === 'MEXC_FUTURES');

    if (!spotId || !futuresId) return;

    const spotPrices = marketPrices[spotId];
    const futuresPrices = marketPrices[futuresId];

    for (const symbol in spotPrices) {
        if (futuresPrices[symbol]) {
            const spotAsk = spotPrices[symbol].bestAsk;
            const futuresBid = futuresPrices[symbol].bestBid;

            if (spotAsk > 0 && futuresBid > 0) {
                const profitPercentage = ((futuresBid - spotAsk) / spotAsk) * 100;

                if (profitPercentage >= MIN_PROFIT_PERCENTAGE) {
                    const opportunity: ArbitrageOpportunity = {
                        type: 'arbitrage',
                        baseSymbol: symbol,
                        profitPercentage,
                        buyAt: {
                            exchange: spotId,
                            price: spotAsk,
                            marketType: 'spot'
                        },
                        sellAt: {
                            exchange: futuresId,
                            price: futuresBid,
                            marketType: 'futures'
                        },
                        arbitrageType: 'spot_futures_inter_exchange',
                        timestamp: Date.now()
                    };

                    broadcastOpportunity(opportunity);
                }
            }
        }
    }
}

async function startFeeds() {
    try {
        console.log("Iniciando feeds de dados...");

        const gateioConnector = new GateIoConnector('GATEIO_SPOT', handlePriceUpdate, () => {
            console.log('GateIO WebSocket conectado');
        });

        const mexcConnector = new MexcConnector('MEXC_FUTURES', handlePriceUpdate, () => {
            console.log('MEXC WebSocket conectado');
        });

        // Primeiro, conecta os WebSockets
        await Promise.all([
            gateioConnector.connect(),
            mexcConnector.connect()
        ]);

        // Depois, busca os pares negociáveis
        const spotPairs = await gateioConnector.getTradablePairs();
        console.log(`[GATEIO_SPOT] Pares disponíveis: ${spotPairs.length}`);

        // Inscreve-se nos pares
        gateioConnector.subscribe(spotPairs);
        mexcConnector.subscribe(spotPairs.map(p => p.replace('/', '_')));

        // Inicia o monitoramento de arbitragem
        setInterval(findAndBroadcastArbitrage, 5000);

        console.log('Feeds iniciados com sucesso');
    } catch (error) {
        console.error('Erro ao iniciar os feeds:', error);
    }
}
