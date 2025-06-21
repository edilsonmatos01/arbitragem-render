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
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var http_1 = __importDefault(require("http"));
var ws_1 = __importDefault(require("ws"));
var gateio_connector_1 = require("./gateio-connector");
var mexc_connector_1 = require("./mexc-connector");
var PORT = process.env.PORT || 10000;
var clients = [];
var marketPrices = {};
function handlePriceUpdate(data) {
    var symbol = data.symbol, marketType = data.marketType, bestAsk = data.bestAsk, bestBid = data.bestBid, identifier = data.identifier;
    var key = "".concat(identifier, "_").concat(symbol);
    // Calcula spread interno e variação
    var oldPrice = marketPrices[key];
    var spreadInterno = ((bestAsk - bestBid) / bestBid) * 100;
    var askVariacao = 0;
    var bidVariacao = 0;
    if (oldPrice) {
        askVariacao = ((bestAsk - oldPrice.bestAsk) / oldPrice.bestAsk) * 100;
        bidVariacao = ((bestBid - oldPrice.bestBid) / oldPrice.bestBid) * 100;
    }
    // Atualiza preços no cache
    marketPrices[key] = { bestAsk: bestAsk, bestBid: bestBid, marketType: marketType, lastUpdate: Date.now() };
    console.log("\n[Pre\u00E7o Atualizado] ".concat(identifier, " - ").concat(symbol));
    console.log("Ask: ".concat(bestAsk, ", Bid: ").concat(bestBid));
    console.log("Spread interno: ".concat(spreadInterno.toFixed(4), "%"));
    console.log("Varia\u00E7\u00E3o: Ask ".concat(askVariacao.toFixed(4), "%, Bid ").concat(bidVariacao.toFixed(4), "%"));
    // Envia atualização para todos os clientes
    var message = JSON.stringify({
        type: 'price-update',
        data: {
            symbol: symbol,
            marketType: marketType,
            bestAsk: bestAsk,
            bestBid: bestBid,
            spreadInterno: spreadInterno,
            askVariacao: askVariacao,
            bidVariacao: bidVariacao,
            identifier: identifier,
            timestamp: Date.now()
        }
    });
    var activeClients = clients.filter(function (client) { return client.readyState === ws_1.default.OPEN; });
    activeClients.forEach(function (client) { return client.send(message); });
    console.log("[Broadcast] Pre\u00E7o enviado para ".concat(activeClients.length, " clientes"));
}
function startFeeds() {
    return __awaiter(this, void 0, void 0, function () {
        var gateio_1, mexc_1, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('\n[Servidor] Iniciando feeds das exchanges...');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    gateio_1 = new gateio_connector_1.GateIoConnector('GATEIO_SPOT', handlePriceUpdate, function () {
                        console.log('[Servidor] Gate.io conectada, buscando pares...');
                        gateio_1.getTradablePairs().then(function (pairs) {
                            console.log("[Gate.io] Inscrevendo em ".concat(pairs.length, " pares"));
                            gateio_1.subscribe(pairs);
                        });
                    });
                    mexc_1 = new mexc_connector_1.MexcConnector('MEXC_SPOT', handlePriceUpdate, function () {
                        console.log('[Servidor] MEXC conectada, buscando pares...');
                        mexc_1.getTradablePairs().then(function (pairs) {
                            console.log("[MEXC] Inscrevendo em ".concat(pairs.length, " pares"));
                            mexc_1.subscribe(pairs);
                        });
                    });
                    // Inicia as conexões
                    console.log('\n[Servidor] Iniciando conexões...');
                    return [4 /*yield*/, Promise.all([
                            gateio_1.connect(),
                            mexc_1.connect()
                        ])];
                case 2:
                    _a.sent();
                    console.log('\n[Servidor] Feeds iniciados com sucesso!');
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    console.error('\n[Servidor] Erro ao iniciar feeds:', error_1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function initializeStandaloneServer() {
    var httpServer = http_1.default.createServer(function (req, res) {
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
                lastUpdate: Math.max.apply(Math, __spreadArray([], __read(Object.values(marketPrices).map(function (p) { return p.lastUpdate; })), false)),
                clientCount: clients.length
            }));
            return;
        }
        res.writeHead(404);
        res.end();
    });
    var wss = new ws_1.default.Server({ server: httpServer });
    wss.on('connection', function (ws) {
        console.log('\n[Servidor] Novo cliente conectado');
        clients.push(ws);
        ws.on('close', function () {
            var index = clients.indexOf(ws);
            if (index > -1) {
                clients.splice(index, 1);
                console.log('\n[Servidor] Cliente desconectado');
            }
        });
    });
    httpServer.listen(PORT, function () {
        console.log("\n[Servidor] WebSocket server iniciado na porta ".concat(PORT));
        startFeeds();
    });
}
initializeStandaloneServer();
