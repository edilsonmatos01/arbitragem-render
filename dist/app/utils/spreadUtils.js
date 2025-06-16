"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSpread = calculateSpread;
exports.normalizeSpread = normalizeSpread;
exports.formatValue = formatValue;
exports.compareSpread = compareSpread;
exports.isValidSpread = isValidSpread;
const decimal_js_1 = __importDefault(require("decimal.js"));
/**
 * Calcula o spread percentual entre preço de venda e compra
 * @param sellPrice Preço de venda
 * @param buyPrice Preço de compra
 * @returns Spread percentual com 4 casas decimais ou null se inválido
 */
function calculateSpread(sellPrice, buyPrice) {
    try {
        // Garante que os valores são strings para evitar erros de precisão do JavaScript
        const sell = new decimal_js_1.default(sellPrice.toString().trim());
        const buy = new decimal_js_1.default(buyPrice.toString().trim());
        // Validações rigorosas
        if (buy.isZero() || buy.isNegative() || sell.isNegative() ||
            !buy.isFinite() || !sell.isFinite() ||
            buy.equals(0) || sell.equals(0)) {
            return null;
        }
        // Se os valores forem exatamente iguais, retorna null (spread zero)
        if (sell.equals(buy)) {
            return null;
        }
        // Cálculo do spread mantendo precisão máxima em cada etapa
        const difference = sell.minus(buy);
        const ratio = difference.dividedBy(buy);
        const percentageSpread = ratio.times(100);
        // Validação do resultado
        if (percentageSpread.isNegative() || percentageSpread.isZero() || !percentageSpread.isFinite()) {
            return null;
        }
        // Arredonda para 4 casas decimais apenas no final
        // Usamos 4 casas para ter mais precisão no cálculo e exibição
        return percentageSpread.toDecimalPlaces(4, decimal_js_1.default.ROUND_HALF_UP).toString();
    }
    catch (error) {
        console.error('Erro ao calcular spread:', error);
        return null;
    }
}
/**
 * Normaliza um valor de spread para garantir precisão
 * @param spread Valor do spread em porcentagem
 * @returns Spread normalizado com 2 casas decimais ou null se inválido
 */
function normalizeSpread(spread) {
    try {
        const decimalSpread = new decimal_js_1.default(spread.toString());
        if (decimalSpread.isNegative() || decimalSpread.isZero() || !decimalSpread.isFinite()) {
            return null;
        }
        return decimalSpread.toDecimalPlaces(2).toString();
    }
    catch (error) {
        console.error('Erro ao normalizar spread:', error);
        return null;
    }
}
/**
 * Formata um valor para exibição mantendo precisão significativa
 * @param value Valor a ser formatado
 * @param minDecimals Mínimo de casas decimais
 * @param maxDecimals Máximo de casas decimais
 */
function formatValue(value, minDecimals = 2, maxDecimals = 8) {
    try {
        const decimal = new decimal_js_1.default(value.toString().trim());
        // Determina o número de casas decimais significativas
        const stringValue = decimal.toString();
        const decimalPart = stringValue.split('.')[1] || '';
        const significantDecimals = Math.min(Math.max(decimalPart.length, minDecimals), maxDecimals);
        return decimal.toDecimalPlaces(significantDecimals, decimal_js_1.default.ROUND_HALF_UP).toString();
    }
    catch {
        return '0';
    }
}
/**
 * Compara dois valores de spread com precisão
 */
function compareSpread(a, b) {
    if (a === null && b === null)
        return 0;
    if (a === null)
        return -1;
    if (b === null)
        return 1;
    try {
        const decimalA = new decimal_js_1.default(a.trim());
        const decimalB = new decimal_js_1.default(b.trim());
        return decimalA.comparedTo(decimalB);
    }
    catch {
        return 0;
    }
}
/**
 * Verifica se um spread é válido e significativo
 */
function isValidSpread(spread) {
    if (!spread)
        return false;
    try {
        const value = new decimal_js_1.default(spread.trim());
        return !value.isNegative() && value.isFinite() && !value.isZero();
    }
    catch {
        return false;
    }
}
