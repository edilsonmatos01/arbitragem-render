"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSpread = calculateSpread;
exports.formatSpread = formatSpread;
exports.isValidSpread = isValidSpread;
exports.normalizeSymbol = normalizeSymbol;
exports.denormalizeSymbol = denormalizeSymbol;
/**
 * Calcula o spread percentual entre preço de venda e compra
 * @param sellPrice Preço de venda
 * @param buyPrice Preço de compra
 * @returns Spread percentual com 4 casas decimais ou null se inválido
 */
function calculateSpread(buyPrice, sellPrice) {
    if (!buyPrice || !sellPrice || buyPrice <= 0 || sellPrice <= 0) {
        return 0;
    }
    return ((sellPrice - buyPrice) / buyPrice) * 100;
}
function formatSpread(spread) {
    return spread.toFixed(2) + '%';
}
function isValidSpread(spread) {
    return !isNaN(spread) && isFinite(spread) && spread > -100 && spread < 100;
}
function normalizeSymbol(symbol) {
    return symbol.replace('_', '/').toUpperCase();
}
function denormalizeSymbol(symbol) {
    return symbol.replace('/', '_').toLowerCase();
}
//# sourceMappingURL=utils.js.map