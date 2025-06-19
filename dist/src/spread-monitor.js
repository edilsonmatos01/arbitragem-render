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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var prisma_client_1 = require("./prisma-client");
var node_cron_1 = __importDefault(require("node-cron"));
var gateio_connector_1 = require("./gateio-connector");
var mexc_connector_1 = require("./mexc-connector");
var decimal_js_1 = __importDefault(require("decimal.js"));
var isCronRunning = false;
var TRADING_PAIRS = [
    'BTC/USDT',
    'ETH/USDT',
    'SOL/USDT',
    'BNB/USDT',
    'XRP/USDT',
    'DOGE/USDT',
    'ADA/USDT',
    'AVAX/USDT',
    'MATIC/USDT',
    'DOT/USDT'
];
var SpreadMonitor = (function () {
    function SpreadMonitor() {
        this.priceData = new Map();
        this.spotPricesReceived = new Set();
        this.futuresPricesReceived = new Set();
        this.lastSaveTime = null;
        this.gateioConnector = new gateio_connector_1.GateIoConnector('GATEIO_SPOT', this.handlePriceUpdate.bind(this));
        this.mexcConnector = new mexc_connector_1.MexcConnector('MEXC_FUTURES', this.handlePriceUpdate.bind(this), function () { });
    }
    SpreadMonitor.prototype.handlePriceUpdate = function (data) {
        var symbol = data.symbol, marketType = data.marketType, bestBid = data.bestBid, bestAsk = data.bestAsk;
        if (!bestBid || !bestAsk || isNaN(bestBid) || isNaN(bestAsk)) {
            return;
        }
        var averagePrice = (Number(bestBid) + Number(bestAsk)) / 2;
        if (marketType === 'spot') {
            this.spotPricesReceived.add(symbol);
            var existingData = this.priceData.get(symbol);
            if (existingData) {
                existingData.spotPrice = averagePrice;
            }
            else {
                this.priceData.set(symbol, { symbol: symbol, spotPrice: averagePrice, futuresPrice: 0 });
            }
        }
        else if (marketType === 'futures') {
            this.futuresPricesReceived.add(symbol);
            var existingData = this.priceData.get(symbol);
            if (existingData) {
                existingData.futuresPrice = averagePrice;
            }
            else {
                this.priceData.set(symbol, { symbol: symbol, spotPrice: 0, futuresPrice: averagePrice });
            }
        }
    };
    SpreadMonitor.prototype.calculateSpread = function (spotPrice, futuresPrice) {
        return ((futuresPrice - spotPrice) / spotPrice) * 100;
    };
    SpreadMonitor.prototype.saveSpreadsToDatabase = function () {
        return __awaiter(this, void 0, void 0, function () {
            var timestamp, spreads, error_1;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        timestamp = new Date();
                        spreads = [];
                        Array.from(this.priceData.entries()).forEach(function (_a) {
                            var _b = __read(_a, 2), symbol = _b[0], data = _b[1];
                            if (data.spotPrice > 0 && data.futuresPrice > 0) {
                                var spread = _this.calculateSpread(data.spotPrice, data.futuresPrice);
                                spreads.push({
                                    symbol: symbol,
                                    exchangeBuy: 'GATEIO',
                                    exchangeSell: 'MEXC',
                                    direction: 'SPOT_TO_FUTURES',
                                    spread: spread,
                                    spotPrice: Number(data.spotPrice.toFixed(8)),
                                    futuresPrice: Number(data.futuresPrice.toFixed(8)),
                                    timestamp: timestamp
                                });
                            }
                        });
                        if (!(spreads.length > 0)) return [3, 4];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4, (0, prisma_client_1.createSpreads)(spreads)];
                    case 2:
                        _a.sent();
                        this.lastSaveTime = timestamp;
                        return [3, 4];
                    case 3:
                        error_1 = _a.sent();
                        console.error('Erro ao salvar spreads:', error_1);
                        return [3, 4];
                    case 4: return [2];
                }
            });
        });
    };
    SpreadMonitor.prototype.monitorSpreads = function () {
        return __awaiter(this, void 0, void 0, function () {
            var error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (isCronRunning) {
                            return [2];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, 5, 6]);
                        isCronRunning = true;
                        this.priceData.clear();
                        this.spotPricesReceived.clear();
                        this.futuresPricesReceived.clear();
                        this.gateioConnector.connect(TRADING_PAIRS);
                        this.mexcConnector.connect();
                        this.mexcConnector.subscribe(TRADING_PAIRS);
                        return [4, new Promise(function (resolve) { return setTimeout(resolve, 10000); })];
                    case 2:
                        _a.sent();
                        return [4, this.saveSpreadsToDatabase()];
                    case 3:
                        _a.sent();
                        return [3, 6];
                    case 4:
                        error_2 = _a.sent();
                        console.error('Erro durante o monitoramento:', error_2);
                        return [3, 6];
                    case 5:
                        isCronRunning = false;
                        return [7];
                    case 6: return [2];
                }
            });
        });
    };
    SpreadMonitor.prototype.getLastSaveTime = function () {
        return this.lastSaveTime;
    };
    return SpreadMonitor;
}());
var spreadMonitor = new SpreadMonitor();
node_cron_1.default.schedule('*/5 * * * *', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4, spreadMonitor.monitorSpreads()];
            case 1:
                _a.sent();
                return [2];
        }
    });
}); });
spreadMonitor.monitorSpreads().catch(console.error);
process.on('SIGTERM', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4, (0, prisma_client_1.disconnectPrisma)()];
            case 1:
                _a.sent();
                process.exit(0);
                return [2];
        }
    });
}); });
process.on('SIGINT', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4, (0, prisma_client_1.disconnectPrisma)()];
            case 1:
                _a.sent();
                process.exit(0);
                return [2];
        }
    });
}); });
function savePrices(symbol, spotPrice, futuresPrice) {
    return __awaiter(this, void 0, void 0, function () {
        var spot, futures, spread, direction, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    spot = new decimal_js_1.default(spotPrice);
                    futures = new decimal_js_1.default(futuresPrice);
                    spread = futures.minus(spot).dividedBy(spot).times(100);
                    direction = spread.greaterThanOrEqualTo(0) ? 'SPOT_TO_FUTURES' : 'FUTURES_TO_SPOT';
                    return [4, (0, prisma_client_1.createSpreads)([{
                                symbol: symbol,
                                exchangeBuy: 'gateio',
                                exchangeSell: 'mexc',
                                direction: direction,
                                spread: parseFloat(spread.abs().toFixed(8)),
                                spotPrice: spotPrice,
                                futuresPrice: futuresPrice,
                                timestamp: new Date()
                            }])];
                case 1:
                    _a.sent();
                    console.log("[".concat(new Date().toISOString(), "] Pre\u00E7os salvos para ").concat(symbol, ": Spot=").concat(spotPrice, ", Futures=").concat(futuresPrice, ", Spread=").concat(spread.abs().toFixed(8), "%"));
                    return [3, 3];
                case 2:
                    error_3 = _a.sent();
                    console.error("[".concat(new Date().toISOString(), "] Erro ao salvar pre\u00E7os para ").concat(symbol, ":"), error_3);
                    return [3, 3];
                case 3: return [2];
            }
        });
    });
}
