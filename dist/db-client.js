"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
class DatabaseClient {
    constructor() {
        this.pool = new pg_1.Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            }
        });
    }
    async findSpread(symbol) {
        const query = `
      SELECT *
      FROM "Spread"
      WHERE symbol = $1
      ORDER BY timestamp DESC
      LIMIT 1
    `;
        const result = await this.pool.query(query, [symbol]);
        return result.rows[0];
    }
    async createSpread(data) {
        const query = `
      INSERT INTO "Spread" (symbol, "gateioPrice", "mexcPrice", "spreadPercentage", timestamp)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
        const values = [
            data.symbol,
            data.gateioPrice,
            data.mexcPrice,
            data.spreadPercentage,
            data.timestamp
        ];
        const result = await this.pool.query(query, values);
        return result.rows[0];
    }
    async deleteOldSpreads(daysToKeep) {
        const query = `
      DELETE FROM "Spread"
      WHERE timestamp < NOW() - INTERVAL '$1 days'
    `;
        await this.pool.query(query, [daysToKeep]);
    }
    async close() {
        await this.pool.end();
    }
}
const db = new DatabaseClient();
exports.default = db;
//# sourceMappingURL=db-client.js.map