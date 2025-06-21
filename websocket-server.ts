require('dotenv').config();

import * as http from 'http';
const WebSocket = require('ws');
const { Server: WebSocketServer } = require('ws');
import { PrismaClient } from '@prisma/client';
import { IncomingMessage } from 'http';
import { GateIoConnector } from './src/gateio-connector';
import { MexcConnector } from './src/mexc-connector';
import { MarketPrices, ArbitrageOpportunity } from './src/types';
import { calculateSpread } from './app/utils/spreadUtils';
import { GateIoFuturesConnector } from './src/gateio-futures-connector';
import { MexcFuturesConnector } from './src/mexc-futures-connector';

interface CustomWebSocket extends WebSocket {
    isAlive: boolean;
    lastPing: number;
}

interface VerifyClientInfo {
    origin: string;
    secure: boolean;
    req: IncomingMessage;
}

interface PriceUpdate {
    type: string;
    symbol: string;
    marketType: 'spot' | 'futures';
    bestAsk: number;
    bestBid: number;
    identifier: string;
}

interface SpreadData {
    symbol: string;
    spotExchange: string;
    futuresExchange: string;
    spotAsk: number;
    spotBid: number;
    futuresAsk: number;
    futuresBid: number;
    spread: number;
    timestamp: number;
}

interface ExchangeConfig {
    spot: string;
    futures: string;
}

const prisma = new PrismaClient();
const PORT = process.env.PORT || 10000;
const MIN_PROFIT_PERCENTAGE = 0.1;

let clients: WebSocket[] = [];
let marketPrices: MarketPrices = {};
let targetPairs: string[] = [];

// ✅ Nova função centralizadora para lidar com todas as atualizações de preço
function handlePriceUpdate(update: { type: string, symbol: string, marketType: string, bestAsk: number, bestBid: number, identifier: string }) {
    const { identifier, symbol, marketType, bestAsk, bestBid } = update;

    // Log da atualização de preço
    console.log(`\n[Preço Atualizado] ${identifier} - ${symbol}`);
    console.log(`Ask: ${bestAsk}, Bid: ${bestBid}`);
    console.log(`Spread interno: ${((bestAsk - bestBid) / bestBid * 100).toFixed(4)}%`);

    // 1. Atualiza o estado central de preços
    if (!marketPrices[identifier]) {
        console.log(`[Novo Market] Criando entrada para ${identifier}`);
        marketPrices[identifier] = {};
    }
    
    const oldPrice = marketPrices[identifier][symbol];
    marketPrices[identifier][symbol] = { bestAsk, bestBid, timestamp: Date.now() };

    if (oldPrice) {
        const askChange = ((bestAsk - oldPrice.bestAsk) / oldPrice.bestAsk * 100).toFixed(4);
        const bidChange = ((bestBid - oldPrice.bestBid) / oldPrice.bestBid * 100).toFixed(4);
        console.log(`Variação: Ask ${askChange}%, Bid ${bidChange}%`);
    }
    
    // 2. Transmite a atualização para todos os clientes
    try {
        broadcast({
            type: 'price-update',
            symbol,
            marketType,
            bestAsk,
            bestBid
        });
        console.log(`[Broadcast] Preço enviado para ${clients.length} clientes`);
    } catch (error) {
        console.error('[Erro Broadcast]', error);
    }
}

export function startWebSocketServer(httpServer: http.Server) {
    const wss = new WebSocketServer({ 
        server: httpServer,
        perMessageDeflate: false,
        maxPayload: 1024 * 1024,
        verifyClient: (info: VerifyClientInfo, cb: (verified: boolean) => void) => {
            cb(true);
        }
    });

    wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
        const customWs = ws as CustomWebSocket;
        customWs.isAlive = true;
        customWs.lastPing = Date.now();
        clients.push(ws);

        console.log(`[Conexão] Novo cliente conectado. Total: ${clients.length}`);

        ws.on('pong', () => {
            heartbeat(ws);
        });

        ws.on('error', (error: Error) => {
            console.error('[WebSocket] Erro na conexão:', error);
            ws.terminate();
        });

        ws.on('message', (message: WebSocket.Data) => {
            try {
                const data = JSON.parse(message.toString());
                console.log('[Mensagem] Recebida:', data);
            } catch (error) {
                console.error('[Mensagem] Erro ao processar:', error);
            }
        });

        ws.on('close', (code: number, reason: string) => {
            console.log(`[Conexão] Cliente desconectado. Código: ${code}, Razão: ${reason}`);
            clients = clients.filter(client => client !== ws);
            console.log(`[Conexão] Total de clientes restantes: ${clients.length}`);
        });
    });

    // Inicia o monitoramento de conexões
    setInterval(checkConnections, 30000);

    return wss;
}

// --- Início: Adição para Servidor Standalone ---

// Esta função cria e inicia um servidor HTTP que usa a nossa lógica WebSocket.
function initializeStandaloneServer() {
    const httpServer = http.createServer((req, res) => {
        // Adiciona headers CORS para todas as respostas HTTP
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'healthy', clients: clients.length }));
            return;
        }

        if (req.url === '/status') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                exchanges: Object.keys(marketPrices),
                pairs: Object.keys(marketPrices['GATEIO_SPOT'] || {}),
                clients: clients.length,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        res.writeHead(404);
        res.end();
    });

    startWebSocketServer(httpServer);

    httpServer.listen(PORT, () => {
        console.log(`\n[Servidor] WebSocket iniciado na porta ${PORT}`);
        console.log(`Health check disponível em: http://localhost:${PORT}/health`);
        console.log(`Status disponível em: http://localhost:${PORT}/status`);
        
        // Inicia as conexões com as exchanges
        startFeeds().catch(error => {
            console.error('[ERRO] Falha ao iniciar os feeds:', error);
        });
    });
}

// Inicia o servidor standalone
initializeStandaloneServer();

// --- Fim: Adição para Servidor Standalone ---

function heartbeat(ws: WebSocket) {
    (ws as CustomWebSocket).isAlive = true;
    (ws as CustomWebSocket).lastPing = Date.now();
}

function checkConnections() {
    const now = Date.now();
    clients.forEach((ws) => {
        const customWs = ws as CustomWebSocket;
        if (!customWs.isAlive && (now - customWs.lastPing) > 30000) {
            console.log('[Conexão] Cliente inativo removido');
            ws.terminate();
            return;
        }

        customWs.isAlive = false;
        try {
            ws.ping();
        } catch (error) {
            console.error('[Ping] Erro ao enviar ping:', error);
            ws.terminate();
        }
    });
}

function broadcast(data: any) {
    const serializedData = JSON.stringify(data);
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(serializedData);
            } catch (error) {
                console.error('[Broadcast] Erro ao enviar mensagem:', error);
                client.terminate();
            }
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
    console.log('\n[Arbitragem] Exchanges disponíveis:', exchangeIdentifiers);
    
    if (exchangeIdentifiers.length < 2) {
        console.log('[Arbitragem] Aguardando dados de pelo menos 2 exchanges...');
        return;
    }

    const spotId = exchangeIdentifiers.find(id => id === 'GATEIO_SPOT');
    const futuresId = exchangeIdentifiers.find(id => id === 'MEXC_SPOT');

    if (!spotId || !futuresId) {
        console.log('[Arbitragem] Aguardando dados do Gate.io Spot e MEXC Futures...');
        console.log('Spot:', spotId ? 'OK' : 'Aguardando');
        console.log('Futures:', futuresId ? 'OK' : 'Aguardando');
        return;
    }

    const spotPrices = marketPrices[spotId];
    const futuresPrices = marketPrices[futuresId];

    console.log('\n[Preços] Gate.io Spot:');
    Object.entries(spotPrices).slice(0, 5).forEach(([symbol, data]) => {
        console.log(`${symbol}: Ask ${data.bestAsk}, Bid ${data.bestBid}`);
    });

    console.log('\n[Preços] MEXC Futures:');
    Object.entries(futuresPrices).slice(0, 5).forEach(([symbol, data]) => {
        console.log(`${symbol}: Ask ${data.bestAsk}, Bid ${data.bestBid}`);
    });

    let opportunitiesFound = 0;
    for (const symbol in spotPrices) {
        if (futuresPrices[symbol]) {
            const spotAsk = spotPrices[symbol].bestAsk;
            const futuresBid = futuresPrices[symbol].bestBid;

            if (spotAsk > 0 && futuresBid > 0) {
                const profitPercentage = ((futuresBid - spotAsk) / spotAsk) * 100;

                if (profitPercentage >= MIN_PROFIT_PERCENTAGE) {
                    opportunitiesFound++;
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

                    console.log('\n[OPORTUNIDADE ENCONTRADA]');
                    console.log(`Par: ${symbol}`);
                    console.log(`Compra: ${spotAsk} (${spotId})`);
                    console.log(`Venda: ${futuresBid} (${futuresId})`);
                    console.log(`Lucro: ${profitPercentage.toFixed(2)}%`);

                    broadcastOpportunity(opportunity);
                }
            }
        }
    }

    if (opportunitiesFound === 0) {
        console.log('\n[Arbitragem] Nenhuma oportunidade encontrada neste ciclo');
    } else {
        console.log(`\n[Arbitragem] Total de oportunidades encontradas: ${opportunitiesFound}`);
    }
}

async function startFeeds() {
    console.log('\n[Servidor] Iniciando feeds das exchanges...');

    try {
        // Inicializa Gate.io
        const gateio = new GateIoConnector('GATEIO_SPOT', handlePriceUpdate, () => {
            console.log('[Servidor] Gate.io conectada, buscando pares...');
            gateio.getTradablePairs().then(pairs => {
                console.log(`[Gate.io] Inscrevendo em ${pairs.length} pares`);
                gateio.subscribe(pairs);
            });
        });

        // Inicializa MEXC
        const mexc = new MexcConnector('MEXC_SPOT', handlePriceUpdate, () => {
            console.log('[Servidor] MEXC conectada, buscando pares...');
            mexc.getTradablePairs().then(pairs => {
                console.log(`[MEXC] Inscrevendo em ${pairs.length} pares`);
                mexc.subscribe(pairs);
            });
        });

        // Inicializa Gate.io Futures
        const gateioFutures = new GateIoFuturesConnector('GATE_FUTURES', handlePriceUpdate, () => {
            console.log('[Servidor] Gate.io Futures conectada, buscando pares...');
            gateioFutures.getTradablePairs().then(pairs => {
                console.log(`[Gate.io Futures] Inscrevendo em ${pairs.length} pares`);
                gateioFutures.subscribe(pairs);
            });
        });

        // Inicializa MEXC Futures
        const mexcFutures = new MexcFuturesConnector('MEXC_FUTURES', handlePriceUpdate, () => {
            console.log('[Servidor] MEXC Futures conectada, buscando pares...');
            mexcFutures.getTradablePairs().then(pairs => {
                console.log(`[MEXC Futures] Inscrevendo em ${pairs.length} pares`);
                mexcFutures.subscribe(pairs);
            });
        });

        // Inicia as conexões
        await Promise.all([
            gateio.connect().catch(error => {
                console.error('[ERRO] Falha ao conectar Gate.io:', error);
            }),
            mexc.connect().catch(error => {
                console.error('[ERRO] Falha ao conectar MEXC:', error);
            }),
            gateioFutures.connect().catch(error => {
                console.error('[ERRO] Falha ao conectar Gate.io Futures:', error);
            }),
            mexcFutures.connect().catch(error => {
                console.error('[ERRO] Falha ao conectar MEXC Futures:', error);
            })
        ]);

        console.log('[Servidor] Feeds iniciados com sucesso');
    } catch (error) {
        console.error('[ERRO] Falha ao iniciar feeds:', error);
        throw error;
    }
}
