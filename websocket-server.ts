require('dotenv').config();

import WebSocket from 'ws';
import { createServer, IncomingMessage, Server } from 'http';
import { GateIoConnector } from './src/gateio-connector';
import { MexcConnector } from './src/mexc-connector';
import { MarketPrices, ArbitrageOpportunity, CustomWebSocket, PriceUpdate } from './src/types';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PORT = process.env.PORT || 10000;
const MIN_PROFIT_PERCENTAGE = 0.1;

let marketPrices: MarketPrices = {};
let clients: CustomWebSocket[] = [];
let exchangeConnectors: Map<string, GateIoConnector | MexcConnector> = new Map();

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
        bestBid,
        identifier
    });
}

export function startWebSocketServer(httpServer: Server) {
    const wss = new WebSocket.Server({ server: httpServer });

    wss.on('connection', (ws: CustomWebSocket, req: IncomingMessage) => {
        ws.isAlive = true;

        ws.on('pong', () => {
            ws.isAlive = true;
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

            if (ws.isAlive === false) {
                console.log('[WS Server] Conexão inativa terminada.');
                return ws.terminate();
            }

            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    wss.on('close', () => {
        clearInterval(interval);
        // Limpa todas as conexões de exchange
        exchangeConnectors.forEach(connector => {
            connector.disconnect?.();
        });
        exchangeConnectors.clear();
    });

    console.log(`Servidor WebSocket iniciado e anexado ao servidor HTTP.`);
    startFeeds();
}

function initializeStandaloneServer() {
    const httpServer = createServer((req, res) => {
        if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', message: 'WebSocket server is running' }));
        } else {
            res.writeHead(404);
            res.end();
        }
    });

    startWebSocketServer(httpServer);

    httpServer.listen(PORT, () => {
        console.log(`[Servidor Standalone] Servidor HTTP e WebSocket escutando na porta ${PORT}`);
    });
}

if (require.main === module) {
    initializeStandaloneServer();
}

function broadcast(data: any) {
    const serializedData = JSON.stringify(data);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(serializedData);
        }
    });
}

async function broadcastOpportunity(opportunity: ArbitrageOpportunity) {
    console.log(`[DEBUG] Verificando ${opportunity.baseSymbol} | Spread: ${opportunity.profitPercentage.toFixed(2)}%`);

    if (!isFinite(opportunity.profitPercentage) || opportunity.profitPercentage > 100) {
        console.warn(`[FILTRO] Spread >100% IGNORADO para ${opportunity.baseSymbol}: ${opportunity.profitPercentage.toFixed(2)}%`);
        return;
    }
    
    broadcast({ ...opportunity, type: 'arbitrage' });
    console.log(`[Broadcast] Oportunidade VÁLIDA enviada: ${opportunity.baseSymbol} ${opportunity.profitPercentage.toFixed(2)}%`);

    await recordSpread(opportunity);
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

async function startFeeds() {
    try {
        // Inicializa os conectores
        const mexcConnector = new MexcConnector(
            'MEXC_FUTURES',
            handlePriceUpdate,
            () => console.log('[MEXC] Conexão estabelecida')
        );
        
        const gateioSpotConnector = new GateIoConnector(
            'GATEIO_SPOT',
            handlePriceUpdate,
            () => console.log('[GateIO Spot] Conexão estabelecida')
        );

        const gateioFuturesConnector = new GateIoConnector(
            'GATEIO_FUTURES',
            handlePriceUpdate,
            () => console.log('[GateIO Futures] Conexão estabelecida')
        );

        // Armazena os conectores
        exchangeConnectors.set('MEXC_FUTURES', mexcConnector);
        exchangeConnectors.set('GATEIO_SPOT', gateioSpotConnector);
        exchangeConnectors.set('GATEIO_FUTURES', gateioFuturesConnector);

        // Busca os pares negociáveis de cada exchange
        const [mexcPairs, gateioSpotPairs, gateioFuturesPairs] = await Promise.all([
            mexcConnector.getTradablePairs(),
            gateioSpotConnector.getTradablePairs(),
            gateioFuturesConnector.getTradablePairs()
        ]);

        // Encontra pares comuns entre os exchanges
        const commonPairs = findCommonPairs(mexcPairs, gateioSpotPairs, gateioFuturesPairs);
        console.log(`[Pares] ${commonPairs.length} pares comuns encontrados`);

        // Inicia as conexões
        mexcConnector.connect();
        gateioSpotConnector.connect();
        gateioFuturesConnector.connect();

        // Inscreve nos pares comuns
        mexcConnector.subscribe(commonPairs);
        gateioSpotConnector.subscribe(commonPairs);
        gateioFuturesConnector.subscribe(commonPairs);

    } catch (error) {
        console.error('[Feeds] Erro ao iniciar feeds:', error);
    }
}

function findCommonPairs(mexcPairs: string[], gateioSpotPairs: string[], gateioFuturesPairs: string[]): string[] {
    const pairSet = new Set<string>();
    
    // Converte todos os pares para o mesmo formato (maiúsculo)
    const normalizedMexc = new Set(mexcPairs.map(p => p.toUpperCase()));
    const normalizedGateioSpot = new Set(gateioSpotPairs.map(p => p.toUpperCase()));
    const normalizedGateioFutures = new Set(gateioFuturesPairs.map(p => p.toUpperCase()));

    // Encontra pares que existem em todos os exchanges
    for (const pair of normalizedMexc) {
        if (normalizedGateioSpot.has(pair) && normalizedGateioFutures.has(pair)) {
            pairSet.add(pair);
        }
    }

    return Array.from(pairSet);
}
