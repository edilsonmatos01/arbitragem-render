import { Pool } from 'pg';

class DatabaseClient {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });
  }

  async findSpread(symbol: string) {
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

  async createSpread(data: { 
    symbol: string;
    gateioPrice: number;
    mexcPrice: number;
    spreadPercentage: number;
    timestamp: Date;
  }) {
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

  async deleteOldSpreads(daysToKeep: number) {
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

// Singleton instance
const db = new DatabaseClient();
export default db; 