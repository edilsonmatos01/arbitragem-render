"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = __importDefault(require("fs/promises"));
const axios_1 = __importDefault(require("axios"));
const gateio_connector_1 = require("./connectors/gateio-connector");
const mexc_connector_1 = require("./connectors/mexc-connector");
const endpoints = {
    gateio: {
        spot: 'https://api.gateio.ws/api/v4/spot/currency_pairs',
        futures: 'https://api.gateio.ws/api/v4/futures/usdt/contracts',
    },
    mexc: {
        spot: 'https://api.mexc.com/api/v3/exchangeInfo',
        futures: 'https://contract.mexc.com/api/v1/contract/detail',
    },
};
const gateioAxiosConfig = {
    timeout: 30000,
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
};
function extractAndNormalizeSymbols(exchangeName, marketType, rawData) {
    var _a;
    const symbols = [];
    const quoteAsset = 'USDT';
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
                if (rawData.code !== 0) {
                    console.warn(`MEXC FUTURES API retornou código de erro: ${rawData.code} - ${rawData.msg || 'Sem mensagem'}`);
                }
            }
        }
    }
    catch (error) {
        console.error(`Erro ao extrair/normalizar para ${exchangeName} ${marketType}:`, error);
        return [];
    }
    return [...new Set(symbols)];
}
async function fetchAllMarketSymbols() {
    const allSymbolsData = {};
    console.log('Iniciando busca de símbolos de mercado...');
    for (const [exchangeName, marketEndpoints] of Object.entries(endpoints)) {
        allSymbolsData[exchangeName] = {};
        console.log(`--- Buscando para ${exchangeName.toUpperCase()} ---`);
        for (const [marketType, url] of Object.entries(marketEndpoints)) {
            try {
                console.log(`Buscando ${marketType.toUpperCase()} de ${url}...`);
                const config = exchangeName === 'gateio' ? gateioAxiosConfig : { timeout: 20000 };
                const response = await axios_1.default.get(url, config);
                const normalizedSymbols = extractAndNormalizeSymbols(exchangeName, marketType, response.data);
                allSymbolsData[exchangeName][marketType] = normalizedSymbols;
                console.log(`✅ ${exchangeName.toUpperCase()} ${marketType.toUpperCase()}: ${normalizedSymbols.length} pares normalizados encontrados (ex: ${normalizedSymbols.slice(0, 3).join(', ')}).`);
            }
            catch (error) {
                const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
                console.error(`❌ Erro ao buscar ${marketType.toUpperCase()} de ${exchangeName.toUpperCase()} (${url}): ${errorMessage}`);
                if (exchangeName === 'gateio' && errorMessage.includes('certificate')) {
                    console.log(`Tentando endpoint alternativo para ${exchangeName.toUpperCase()} ${marketType.toUpperCase()}...`);
                    try {
                        const altUrl = url.replace('api.gateio.ws', 'www.gate.io');
                        const response = await axios_1.default.get(altUrl, gateioAxiosConfig);
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
        await promises_1.default.writeFile('./public/tradableSymbols.json', JSON.stringify(allSymbolsData, null, 2));
        console.log('📁 Arquivo tradableSymbols.json salvo com sucesso em ./public/tradableSymbols.json.');
    }
    catch (error) {
        console.error('❌ Erro ao salvar o arquivo tradableSymbols.json:', error);
    }
}
fetchAllMarketSymbols().catch(error => {
    console.error("Erro inesperado durante a execução de fetchAllMarketSymbols:", error);
});
async function fetchMarketSymbols() {
    try {
        const gateio = new gateio_connector_1.GateIoConnector('GATEIO_SPOT', () => { });
        const mexc = new mexc_connector_1.MexcConnector('MEXC_FUTURES', () => { }, () => { });
        const [gateioSymbols, mexcSymbols] = await Promise.all([
            gateio.getTradablePairs(),
            mexc.getTradablePairs()
        ]);
        const commonSymbols = gateioSymbols.filter(symbol => mexcSymbols.includes(symbol));
        console.log('Símbolos comuns:', commonSymbols);
        return commonSymbols;
    }
    catch (error) {
        console.error('Erro ao buscar símbolos:', error);
        return [];
    }
}
fetchMarketSymbols();
//# sourceMappingURL=fetchMarketSymbols.js.map