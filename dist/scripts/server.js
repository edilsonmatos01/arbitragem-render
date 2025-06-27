"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const spread_monitor_1 = require("./spread-monitor");
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
    (0, spread_monitor_1.startContinuousMonitoring)().catch(error => {
        console.error('Erro fatal no monitoramento:', error);
        process.exit(1);
    });
});
//# sourceMappingURL=server.js.map