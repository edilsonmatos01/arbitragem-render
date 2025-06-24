"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSpread = calculateSpread;
const decimal_js_1 = __importDefault(require("decimal.js"));
function calculateSpread(sellPrice, buyPrice) {
    try {
        const sell = new decimal_js_1.default(sellPrice.toString().trim());
        const buy = new decimal_js_1.default(buyPrice.toString().trim());
        if (buy.isZero() || buy.isNegative() || sell.isNegative() ||
            !buy.isFinite() || !sell.isFinite() ||
            buy.equals(0) || sell.equals(0)) {
            return null;
        }
        if (sell.equals(buy)) {
            return null;
        }
        const difference = sell.minus(buy);
        const ratio = difference.dividedBy(buy);
        const percentageSpread = ratio.times(100);
        if (percentageSpread.isNegative() || percentageSpread.isZero() || !percentageSpread.isFinite()) {
            return null;
        }
        return percentageSpread.toDecimalPlaces(4, decimal_js_1.default.ROUND_HALF_UP).toString();
    }
    catch (error) {
        console.error('Erro ao calcular spread:', error);
        return null;
    }
}
//# sourceMappingURL=utils.js.map