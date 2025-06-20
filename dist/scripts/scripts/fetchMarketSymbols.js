"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = __importDefault(require("fs/promises"));
const axios_1 = __importDefault(require("axios"));
const endpoints = {
    gateio: {
        spot: 'https://api.gateio.ws/api/v4/spot/currency_pairs',
        futures: 'https://api.gateio.ws/api/v4/futures/usdt/contracts',
    },
    mexc: {
        spot: 'https://api.mexc.com/api/v3/exchangeInfo',
        futures: 'https://contract.mexc.com/api/v1/contract/detail', // API de contratos futuros
    },
};
// Configuração específica para requisições da Gate.io
const gateioAxiosConfig = {
    timeout: 30000, // Aumentado timeout para 30s
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
};
// Função para normalizar e extrair símbolos
// O objetivo é retornar uma lista de strings no formato "BASE/QUOTE", ex: "BTC/USDT"
function extractAndNormalizeSymbols(exchangeName, marketType, rawData) {
    var _a;
    const symbols = [];
    const quoteAsset = 'USDT'; // Focamos em pares USDT
    // HABILITAR LOGS PARA DEBUG ABAIXO SE NECESSÁRIO
    if (exchangeName === 'mexc' || exchangeName === 'gateio') {
        console.log(`--- DEBUG: ${exchangeName.toUpperCase()} ${marketType.toUpperCase()} ---`);
        console.log('Raw data received (primeiros 1000 chars):', (_a = JSON.stringify(rawData)) === null || _a === void 0 ? void 0 : _a.substring(0, 1000));
    }
    try {
        if (exchangeName === 'gateio') {
            if (Array.isArray(rawData)) {
                if (rawData.length > 0) {
                    console.log(`GATEIO ${marketType.toUpperCase()} - Primeiro item da lista:`, JSON.stringify(rawData[0], null, 2));
                }
                rawData.forEach((s) => {
                    if (marketType === 'spot' && s.quote === quoteAsset && s.trade_status === 'tradable') {
                        symbols.push(`${s.base}/${s.quote}`);
                    }
                    else if (marketType === 'futures') {
                        // Gate.io futures: name é o campo principal (ex: "BTC_USDT")
                        // Verificar se é um contrato perpétuo USDT (não em delisting)
                        if (s.name && s.name.endsWith('_USDT') && !s.in_delisting && s.trade_status !== 'delisting') {
                            const [base] = s.name.split('_');
                            if (base) {
                                symbols.push(`${base}/${quoteAsset}`);
                            }
                        }
                    }
                });
            }
            else if (rawData.message) {
                console.warn(`GATEIO ${marketType.toUpperCase()} API retornou mensagem:`, rawData.message);
            }
        }
        else if (exchangeName === 'mexc') {
            if (marketType === 'spot' && rawData && rawData.symbols && Array.isArray(rawData.symbols)) {
                if (rawData.symbols.length > 0) {
                    console.log(`MEXC SPOT - Primeiro item da lista:`, JSON.stringify(rawData.symbols[0], null, 2));
                }
                rawData.symbols.forEach((s) => {
                    // MEXC API v3 spot: status "1" = ativo, quoteAsset "USDT", permissions includes "SPOT"
                    if (s.status === '1' && s.quoteAsset === quoteAsset &&
                        s.permissions && Array.isArray(s.permissions) && s.permissions.includes('SPOT') &&
                        s.isSpotTradingAllowed === true) {
                        symbols.push(`${s.baseAsset}/${s.quoteAsset}`);
                    }
                });
            }
            else if (marketType === 'futures' && rawData && rawData.data && Array.isArray(rawData.data)) {
                if (rawData.data.length > 0) {
                    console.log(`MEXC FUTURES - Primeiro item da lista:`, JSON.stringify(rawData.data[0], null, 2));
                }
                rawData.data.forEach((s) => {
                    // MEXC API v1 contract/detail: state 0 = ativo, quoteCoin "USDT", settleCoin "USDT", futureType 1 = Perpetual
                    if (s.state === 0 && s.quoteCoin === quoteAsset && s.settleCoin === quoteAsset &&
                        s.futureType === 1 && !s.isHidden && s.symbol) {
                        const [base] = s.symbol.split('_');
                        if (base) {
                            symbols.push(`${base}/${quoteAsset}`);
                        }
                    }
                });
            }
            else if (marketType === 'futures' && rawData && rawData.code !== undefined) {
                if (rawData.code !== 0) { // MEXC usa code 0 para sucesso
                    console.warn(`MEXC FUTURES API retornou código de erro: ${rawData.code} - ${rawData.msg || 'Sem mensagem'}`);
                }
            }
        }
    }
    catch (error) {
        console.error(`Erro ao extrair/normalizar para ${exchangeName} ${marketType}:`, error);
        return []; // Retorna array vazio em caso de erro na extração
    }
    // console.log(`--- FIM DEBUG: ${exchangeName.toUpperCase()} ${marketType.toUpperCase()} - Símbolos encontrados: ${symbols.length} ---`);
    return [...new Set(symbols)]; // Remove duplicados se houver
}
function fetchAllMarketSymbols() {
    return __awaiter(this, void 0, void 0, function* () {
        const allSymbolsData = {};
        console.log('Iniciando busca de símbolos de mercado...');
        for (const [exchangeName, marketEndpoints] of Object.entries(endpoints)) {
            allSymbolsData[exchangeName] = {};
            console.log(`--- Buscando para ${exchangeName.toUpperCase()} ---`);
            for (const [marketType, url] of Object.entries(marketEndpoints)) {
                try {
                    console.log(`Buscando ${marketType.toUpperCase()} de ${url}...`);
                    // Usar configuração específica para Gate.io
                    const config = exchangeName === 'gateio' ? gateioAxiosConfig : { timeout: 20000 };
                    const response = yield axios_1.default.get(url, config);
                    const normalizedSymbols = extractAndNormalizeSymbols(exchangeName, marketType, response.data);
                    allSymbolsData[exchangeName][marketType] = normalizedSymbols;
                    console.log(`✅ ${exchangeName.toUpperCase()} ${marketType.toUpperCase()}: ${normalizedSymbols.length} pares normalizados encontrados (ex: ${normalizedSymbols.slice(0, 3).join(', ')}).`);
                }
                catch (error) {
                    const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
                    console.error(`❌ Erro ao buscar ${marketType.toUpperCase()} de ${exchangeName.toUpperCase()} (${url}): ${errorMessage}`);
                    // Se for Gate.io e ainda tivermos erro de SSL, tentar endpoint alternativo
                    if (exchangeName === 'gateio' && errorMessage.includes('certificate')) {
                        console.log(`Tentando endpoint alternativo para ${exchangeName.toUpperCase()} ${marketType.toUpperCase()}...`);
                        try {
                            const altUrl = url.replace('api.gateio.ws', 'www.gate.io');
                            const response = yield axios_1.default.get(altUrl, gateioAxiosConfig);
                            const normalizedSymbols = extractAndNormalizeSymbols(exchangeName, marketType, response.data);
                            allSymbolsData[exchangeName][marketType] = normalizedSymbols;
                            console.log(`✅ ${exchangeName.toUpperCase()} ${marketType.toUpperCase()}: ${normalizedSymbols.length} pares normalizados encontrados (ex: ${normalizedSymbols.slice(0, 3).join(', ')}).`);
                        }
                        catch (altError) {
                            console.error(`❌ Também falhou com endpoint alternativo: ${altError.message}`);
                            allSymbolsData[exchangeName][marketType] = [];
                        }
                    }
                    else {
                        allSymbolsData[exchangeName][marketType] = [];
                    }
                }
            }
        }
        try {
            yield promises_1.default.writeFile('./public/tradableSymbols.json', JSON.stringify(allSymbolsData, null, 2));
            console.log('📁 Arquivo tradableSymbols.json salvo com sucesso em ./public/tradableSymbols.json.');
        }
        catch (error) {
            console.error('❌ Erro ao salvar o arquivo tradableSymbols.json:', error);
        }
    });
}
// Executa a função principal
fetchAllMarketSymbols().catch(error => {
    console.error("Erro inesperado durante a execução de fetchAllMarketSymbols:", error);
});
// Para executar este script:
// 1. Certifique-se de ter o Node.js instalado.
// 2. Instale as dependências: npm install axios typescript ts-node (ou yarn add ...)
// 3. Execute com: npx ts-node ./scripts/fetchMarketSymbols.ts
// Ou compile para JS primeiro: npx tsc ./scripts/fetchMarketSymbols.ts && node ./scripts/fetchMarketSymbols.js 
