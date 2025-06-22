"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSpread = calculateSpread;
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
        return percentageSpread.toDecimalPlaces(4, decimal_js_1.default.ROUND_HALF_UP).toString();
    }
    catch (error) {
        console.error('Erro ao calcular spread:', error);
        return null;
    }
}
