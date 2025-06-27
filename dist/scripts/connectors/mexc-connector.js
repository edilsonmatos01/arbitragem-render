"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MexcConnector = void 0;
var WebSocket = require('ws');
var events_1 = require("events");
var MEXC_SPOT_WS_URL = 'wss://wbs.mexc.com/ws';
var MexcConnector = /** @class */ (function (_super) {
    __extends(MexcConnector, _super);
    function MexcConnector(identifier, onPriceUpdate, onConnect) {
        var _this = _super.call(this) || this;
        _this.ws = null;
        _this.isConnected = false;
        _this.isConnecting = false;
        _this.reconnectAttempts = 0;
        _this.maxReconnectAttempts = 5;
        _this.reconnectDelay = 5000;
        _this.subscriptions = new Set();
        _this.pingInterval = null;
        _this.marketIdentifier = identifier;
        _this.onPriceUpdate = onPriceUpdate;
        _this.onConnectedCallback = onConnect;
        console.log("[".concat(_this.marketIdentifier, "] Conector instanciado."));
        return _this;
    }
    MexcConnector.prototype.connect = function () {
        var _this = this;
        if (this.isConnecting) {
            console.log("[".concat(this.marketIdentifier, "] Conex\u00E3o j\u00E1 em andamento."));
            return;
        }
        if (this.ws) {
            console.log("[".concat(this.marketIdentifier, "] Fechando conex\u00E3o existente..."));
            this.ws.close();
        }
        this.isConnecting = true;
        console.log("[".concat(this.marketIdentifier, "] Conectando a ").concat(MEXC_SPOT_WS_URL));
        try {
            this.ws = new WebSocket(MEXC_SPOT_WS_URL);
            if (!this.ws) {
                throw new Error('Falha ao criar WebSocket');
            }
            this.ws.on('open', function () {
                console.log("[".concat(_this.marketIdentifier, "] Conex\u00E3o WebSocket estabelecida."));
                _this.isConnected = true;
                _this.isConnecting = false;
                _this.reconnectAttempts = 0;
                _this.startHeartbeat();
                if (_this.subscriptions.size > 0) {
                    _this.sendSubscriptionRequests(Array.from(_this.subscriptions));
                }
                if (_this.onConnectedCallback) {
                    _this.onConnectedCallback();
                }
            });
            this.ws.on('message', function (data) {
                try {
                    var message = JSON.parse(data.toString());
                    if (message.c === 'spot.ticker') {
                        var ticker = message.d;
                        var pair = ticker.s.replace('_', '/').toUpperCase();
                        var priceData = {
                            bestAsk: parseFloat(ticker.a),
                            bestBid: parseFloat(ticker.b),
                        };
                        if (!priceData.bestAsk || !priceData.bestBid) {
                            console.log("[".concat(_this.marketIdentifier, "] Pre\u00E7os inv\u00E1lidos recebidos:"), ticker);
                            return;
                        }
                        console.log("[".concat(_this.marketIdentifier, "] Atualiza\u00E7\u00E3o de pre\u00E7o para ").concat(pair, ":"), priceData);
                        _this.onPriceUpdate({
                            type: 'price-update',
                            symbol: pair,
                            marketType: 'spot',
                            bestAsk: priceData.bestAsk,
                            bestBid: priceData.bestBid,
                            identifier: _this.marketIdentifier
                        });
                    }
                }
                catch (error) {
                    console.error("[".concat(_this.marketIdentifier, "] Erro ao processar mensagem:"), error);
                }
            });
            this.ws.on('close', function () {
                console.log("[".concat(_this.marketIdentifier, "] Conex\u00E3o fechada"));
                _this.handleDisconnect();
            });
            this.ws.on('error', function (error) {
                console.error("[".concat(_this.marketIdentifier, "] Erro na conex\u00E3o:"), error);
                _this.handleDisconnect();
            });
        }
        catch (error) {
            console.error("[".concat(this.marketIdentifier, "] Erro ao criar WebSocket:"), error);
            this.handleDisconnect();
        }
    };
    MexcConnector.prototype.startHeartbeat = function () {
        var _this = this;
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }
        this.pingInterval = setInterval(function () {
            var _a;
            if (_this.isConnected && ((_a = _this.ws) === null || _a === void 0 ? void 0 : _a.readyState) === WebSocket.OPEN) {
                var pingMsg = { method: "ping" };
                _this.ws.send(JSON.stringify(pingMsg));
            }
        }, 20000);
    };
    MexcConnector.prototype.handleDisconnect = function () {
        var _this = this;
        this.isConnected = false;
        this.isConnecting = false;
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            var delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            console.log("[".concat(this.marketIdentifier, "] Tentando reconectar em ").concat(delay, "ms..."));
            setTimeout(function () { return _this.connect(); }, delay);
        }
        else {
            console.error("[".concat(this.marketIdentifier, "] M\u00E1ximo de tentativas de reconex\u00E3o atingido"));
        }
    };
    MexcConnector.prototype.subscribe = function (symbols) {
        var _this = this;
        var _a;
        console.log("[".concat(this.marketIdentifier, "] Inscrevendo nos s\u00EDmbolos:"), symbols);
        symbols.forEach(function (symbol) { return _this.subscriptions.add(symbol); });
        if (this.isConnected && ((_a = this.ws) === null || _a === void 0 ? void 0 : _a.readyState) === WebSocket.OPEN) {
            this.sendSubscriptionRequests(Array.from(this.subscriptions));
        }
    };
    MexcConnector.prototype.sendSubscriptionRequests = function (symbols) {
        var _this = this;
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log("[".concat(this.marketIdentifier, "] WebSocket n\u00E3o est\u00E1 pronto para subscri\u00E7\u00E3o"));
            return;
        }
        var ws = this.ws; // Capture reference to avoid null check issues
        symbols.forEach(function (symbol) {
            var formattedSymbol = symbol.replace('/', '').toLowerCase();
            var msg = { method: 'sub.ticker', param: { symbol: formattedSymbol } };
            console.log("[".concat(_this.marketIdentifier, "] Enviando subscri\u00E7\u00E3o:"), JSON.stringify(msg));
            ws.send(JSON.stringify(msg));
        });
    };
    MexcConnector.prototype.disconnect = function () {
        console.log("[".concat(this.marketIdentifier, "] Desconectando..."));
        this.isConnected = false;
        this.isConnecting = false;
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    };
    MexcConnector.prototype.getTradablePairs = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // Implementação simplificada para teste
                return [2 /*return*/, [
                        'BTC/USDT',
                        'ETH/USDT',
                        'SOL/USDT',
                        'XRP/USDT',
                        'BNB/USDT'
                    ]];
            });
        });
    };
    return MexcConnector;
}(events_1.EventEmitter));
exports.MexcConnector = MexcConnector;
