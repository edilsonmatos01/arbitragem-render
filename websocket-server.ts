require('dotenv').config();

import WebSocket from 'ws';
import { createServer, IncomingMessage, Server } from 'http';
import { GateioConnector } from './src/gateio-connector';
import { MexcConnector } from './src/mexc-connector';
import { MarketPrices, ArbitrageOpportunity, PriceUpdate, CustomWebSocket } from './src/types';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PORT = parseInt(process.env.PORT || '8080', 10);
console.log(`[CONFIG] Iniciando servidor na porta ${PORT}`);

const MIN_PROFIT_PERCENTAGE = 0.05; // 0.05% para detectar mais oportunidades

let marketPrices: MarketPrices = {};
// Lista dinâmica será construída automaticamente a partir dos dados recebidos
let priorityPairs: string[] = [
    'BTC_USDT',
    'ETH_USDT',
    'SOL_USDT',
    'XRP_USDT',
    'BNB_USDT'
]; // Apenas para prioridade de logs, não limitação

let clients: CustomWebSocket[] = [];

function handlePriceUpdate(update: PriceUpdate) {
    const { identifier, symbol, marketType, bestAsk, bestBid } = update;

    // Log apenas para pares prioritários para reduzir verbosidade
    const priorityPairs = ['BTC_USDT', 'ETH_USDT', 'SOL_USDT', 'XRP_USDT', 'BNB_USDT'];
    if (priorityPairs.includes(symbol)) {
        console.log(`[PRICE UPDATE] ${identifier.toUpperCase()}: ${symbol} - Ask: ${bestAsk}, Bid: ${bestBid}`);
    }

    if (!marketPrices[identifier]) {
        marketPrices[identifier] = {};
        console.log(`[MARKET PRICES] Criada nova exchange: ${identifier}`);
    }
    marketPrices[identifier][symbol] = { bestAsk, bestBid, timestamp: Date.now() };
    
    // Log do estado atual dos dados apenas a cada 100 atualizações para reduzir verbosidade
    const totalSymbols = Object.keys(marketPrices[identifier]).length;
    if (totalSymbols % 100 === 0 || totalSymbols <= 10) {
        console.log(`[MARKET PRICES] ${identifier}: ${totalSymbols} símbolos ativos`);
    }
    
    broadcast({
        type: 'price-update',
        symbol,
        marketType,
        bestAsk,
        bestBid
    });
}

function startWebSocketServer(httpServer: Server) {
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
    
    const interval = setInterval(() => {
        wss.clients.forEach(client => {
            const ws = client as CustomWebSocket;

            if (ws.isAlive === false) {
                console.log('[WS Server] Conexão inativa terminada.');
                return ws.terminate();
            }

            ws.isAlive = false; 
            ws.ping(() => {});
        });
    }, 30000);

    wss.on('close', () => {
        clearInterval(interval);
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

function broadcastOpportunity(opportunity: ArbitrageOpportunity) {
    const timestamp = new Date(opportunity.timestamp).toLocaleTimeString('pt-BR');
    const profitColor = opportunity.profitPercentage > 0.5 ? '\x1b[32m' : '\x1b[33m';
    const resetColor = '\x1b[0m';

    console.log(`
${profitColor}╔══════════════════════════════════════════════════════════════════════════════
║ 🔍 OPORTUNIDADE DETECTADA - ${timestamp}
║ 💱 Par: ${opportunity.baseSymbol}
║ 📈 Spread: ${opportunity.profitPercentage.toFixed(4)}%
║ 🔄 Direção: ${opportunity.arbitrageType}
║ 
║ 📥 COMPRA: ${opportunity.buyAt.exchange.toUpperCase()}
║    Preço: ${opportunity.buyAt.price.toFixed(8)} USDT
║    Tipo: ${opportunity.buyAt.marketType}
║ 
║ 📤 VENDA: ${opportunity.sellAt.exchange.toUpperCase()}
║    Preço: ${opportunity.sellAt.price.toFixed(8)} USDT
║    Tipo: ${opportunity.sellAt.marketType}
╚══════════════════════════════════════════════════════════════════════════════${resetColor}`);

    if (!isFinite(opportunity.profitPercentage) || opportunity.profitPercentage > 100) {
        console.warn(`\x1b[31m[ALERTA] Spread >100% IGNORADO para ${opportunity.baseSymbol}: ${opportunity.profitPercentage.toFixed(2)}%\x1b[0m`);
        return;
    }
    
    broadcast({ ...opportunity, type: 'arbitrage' });
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
    // Estratégia: Comprar na Gate.io Spot e Vender na MEXC Futures
    
    if (Object.keys(marketPrices).length === 0) {
        console.log(`[ARBITRAGE] Aguardando dados de mercado...`);
        return;
    }
    
    const gateioSymbols = Object.keys(marketPrices['gateio'] || {});
    const mexcSymbols = Object.keys(marketPrices['mexc'] || {});
    
    console.log(`[ARBITRAGE] Status das exchanges:`);
    console.log(`  Gate.io: ${gateioSymbols.length} símbolos`);
    console.log(`  MEXC: ${mexcSymbols.length} símbolos`);
    
    // Verificar se ambas as exchanges estão funcionando
    if (gateioSymbols.length === 0 && mexcSymbols.length === 0) {
        console.log(`[ARBITRAGE] ⚠️ Nenhuma exchange com dados disponíveis`);
        return;
    }
    
    if (gateioSymbols.length === 0) {
        console.log(`[ARBITRAGE] ⚠️ Gate.io sem dados - usando apenas MEXC para demonstração`);
        // Mostrar spreads internos da MEXC como fallback
        for (const symbol of mexcSymbols.slice(0, 5)) {
            const mexcData = marketPrices['mexc'][symbol];
            if (!mexcData) continue;
            
            const internalSpread = ((mexcData.bestAsk - mexcData.bestBid) / mexcData.bestBid) * 100;
            
            if (internalSpread > 0.1) {
                const opportunity = {
                    type: 'arbitrage',
                    baseSymbol: symbol,
                    profitPercentage: internalSpread,
                    arbitrageType: 'mexc_internal_spread',
                    buyAt: {
                        exchange: 'mexc',
                        price: mexcData.bestBid,
                        marketType: 'futures'
                    },
                    sellAt: {
                        exchange: 'mexc',
                        price: mexcData.bestAsk,
                        marketType: 'futures'
                    },
                    timestamp: Date.now()
                };
                
                console.log(`🔍 SPREAD MEXC: ${symbol} - ${internalSpread.toFixed(4)}%`);
                broadcast({ ...opportunity, type: 'arbitrage' });
            }
        }
        return;
    }
    
    if (mexcSymbols.length === 0) {
        console.log(`[ARBITRAGE] ⚠️ MEXC sem dados - aguardando conexão`);
        return;
    }
    
    // ARBITRAGEM PRINCIPAL: Gate.io Spot -> MEXC Futures
    let opportunitiesFound = 0;
    
    // Criar lista dinâmica de símbolos comuns entre as duas exchanges
    const commonSymbols = gateioSymbols.filter(symbol => mexcSymbols.includes(symbol));
    console.log(`[ARBITRAGE] Analisando ${commonSymbols.length} símbolos comuns entre as exchanges`);
    
    // Priorizar símbolos principais para logs detalhados
    const prioritySymbols = commonSymbols.filter(symbol => priorityPairs.includes(symbol));
    const otherSymbols = commonSymbols.filter(symbol => !priorityPairs.includes(symbol));
    
    console.log(`[ARBITRAGE] Símbolos prioritários: ${prioritySymbols.length} | Outros: ${otherSymbols.length}`);
    
    // Analisar TODOS os símbolos comuns
    for (const symbol of commonSymbols) {
        const gateioData = marketPrices['gateio']?.[symbol];
        const mexcData = marketPrices['mexc']?.[symbol];

        if (!gateioData || !mexcData) {
            // Log detalhado apenas para símbolos prioritários
            if (priorityPairs.includes(symbol)) {
                console.log(`[DEBUG] ${symbol}: Gate.io=${gateioData ? 'OK' : 'AUSENTE'}, MEXC=${mexcData ? 'OK' : 'AUSENTE'}`);
            }
            continue;
        }

        if (!isFinite(gateioData.bestAsk) || !isFinite(gateioData.bestBid) ||
            !isFinite(mexcData.bestAsk) || !isFinite(mexcData.bestBid)) {
            if (priorityPairs.includes(symbol)) {
                console.log(`[DEBUG] ${symbol}: Preços inválidos`);
            }
            continue;
        }

        // Estratégia principal: Comprar Gate.io Spot -> Vender MEXC Futures
        const gateioToMexcProfit = ((mexcData.bestBid - gateioData.bestAsk) / gateioData.bestAsk) * 100;
        
        // Estratégia reversa: Comprar MEXC Futures -> Vender Gate.io Spot
        const mexcToGateioProfit = ((gateioData.bestBid - mexcData.bestAsk) / mexcData.bestAsk) * 100;

        // Oportunidade principal: Gate.io Spot -> MEXC Futures
        if (gateioToMexcProfit > MIN_PROFIT_PERCENTAGE) {
            const opportunity: ArbitrageOpportunity = {
                type: 'arbitrage',
                baseSymbol: symbol,
                profitPercentage: gateioToMexcProfit,
                arbitrageType: 'gateio_spot_to_mexc_futures',
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
            opportunitiesFound++;
        }

        // Oportunidade reversa: MEXC Futures -> Gate.io Spot
        if (mexcToGateioProfit > MIN_PROFIT_PERCENTAGE) {
            const opportunity: ArbitrageOpportunity = {
                type: 'arbitrage',
                baseSymbol: symbol,
                profitPercentage: mexcToGateioProfit,
                arbitrageType: 'mexc_futures_to_gateio_spot',
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
            opportunitiesFound++;
        }
    }
    
    if (opportunitiesFound === 0) {
        console.log(`[ARBITRAGE] Nenhuma oportunidade encontrada nos ${commonSymbols.length} pares analisados`);
    } else {
        console.log(`[ARBITRAGE] ✅ ${opportunitiesFound} oportunidades detectadas em ${commonSymbols.length} pares!`);
    }
}

async function startFeeds() {
    console.log('[Feeds] ===== INICIANDO SISTEMA DE ARBITRAGEM =====');
    console.log('[Feeds] Estratégia: Gate.io Spot <-> MEXC Futures');
    
    try {
        // Inicializar ambas as exchanges em paralelo
        console.log('[Feeds] ===== INICIANDO CONEXÕES PARALELAS =====');
        
        const mexc = new MexcConnector();
        const gateio = new GateioConnector();
        
        // Configurar callbacks
        mexc.onPriceUpdate((update) => {
            handlePriceUpdate(update);
        });
        
        gateio.onPriceUpdate((update) => {
            handlePriceUpdate(update);
        });
        
        console.log('[Feeds] Callbacks configurados para ambas as exchanges');
        
        // Conectar em paralelo
        console.log('[Feeds] ===== CONECTANDO EXCHANGES =====');
        
        const mexcPromise = mexc.connect().then(() => {
            console.log('[MEXC] ✅ Conectado com sucesso!');
        }).catch((error) => {
            console.error('[MEXC] ❌ Erro na conexão:', error);
        });
        
        const gateioPromise = gateio.connect().then(() => {
            console.log('[GATEIO] ✅ Conectado com sucesso!');
        }).catch((error) => {
            console.error('[GATEIO] ❌ Erro na conexão:', error);
        });
        
        // Aguardar ambas as conexões (não falhar se uma falhar)
        await Promise.allSettled([mexcPromise, gateioPromise]);
        
        console.log('[Feeds] ===== INICIANDO MONITORAMENTO =====');
        console.log('[Feeds] Iniciando detecção de arbitragem...');
        
        // Monitorar oportunidades a cada 3 segundos
        setInterval(findAndBroadcastArbitrage, 3000);
        
        // Status report a cada 30 segundos
        setInterval(() => {
            const gateioCount = Object.keys(marketPrices['gateio'] || {}).length;
            const mexcCount = Object.keys(marketPrices['mexc'] || {}).length;
            console.log(`[STATUS] Gate.io: ${gateioCount} símbolos | MEXC: ${mexcCount} símbolos`);
        }, 30000);

    } catch (error) {
        console.error('[Feeds] ===== ERRO CRÍTICO =====');
        console.error('[Feeds] Erro ao iniciar os feeds:', error);
        
        // Tentar novamente em 10 segundos
        console.log('[Feeds] Tentando novamente em 10 segundos...');
        setTimeout(startFeeds, 10000);
    }
}

export {
    startWebSocketServer,
    initializeStandaloneServer
};
