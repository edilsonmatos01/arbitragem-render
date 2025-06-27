"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSpread = calculateSpread;
function calculateSpread(spotPrice, futuresPrice) {
    if (spotPrice <= 0 || futuresPrice <= 0) {
        return 0;
    }
    return ((futuresPrice - spotPrice) / spotPrice) * 100;
}
//# sourceMappingURL=utils.js.map