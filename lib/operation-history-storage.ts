// Sistema de armazenamento temporário para histórico de operações
// Usado enquanto o banco de dados não está disponível

export interface OperationHistoryItem {
  id: string;
  symbol: string;
  quantity: number;
  spotEntryPrice: number;
  futuresEntryPrice: number;
  spotExitPrice: number;
  futuresExitPrice: number;
  spotExchange: string;
  futuresExchange: string;
  profitLossUsd: number;
  profitLossPercent: number;
  createdAt: string;
  finalizedAt: string;
}

const STORAGE_KEY = 'arbitrage-operation-history';

export class OperationHistoryStorage {
  static saveOperation(operation: OperationHistoryItem): void {
    try {
      const existing = this.getAllOperations();
      existing.unshift(operation); // Adiciona no início (mais recente primeiro)
      
      // Limita a 1000 operações para não sobrecarregar o localStorage
      const limited = existing.slice(0, 1000);
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));
      console.log('✅ Operação salva no localStorage:', operation);
    } catch (error) {
      console.error('❌ Erro ao salvar no localStorage:', error);
    }
  }

  static getAllOperations(): OperationHistoryItem[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('❌ Erro ao buscar do localStorage:', error);
      return [];
    }
  }

  static getFilteredOperations(
    filter: string = '24h',
    startDate?: string,
    endDate?: string,
    symbol?: string
  ): OperationHistoryItem[] {
    const allOperations = this.getAllOperations();
    
    let filtered = allOperations;

    // Filtro por símbolo
    if (symbol) {
      filtered = filtered.filter(op => 
        op.symbol.toLowerCase().includes(symbol.toLowerCase())
      );
    }

    // Filtros de data
    const now = new Date();
    switch (filter) {
      case '24h':
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        filtered = filtered.filter(op => 
          new Date(op.finalizedAt) >= yesterday
        );
        break;
      case 'day':
        if (startDate) {
          const dayStart = new Date(startDate);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(startDate);
          dayEnd.setHours(23, 59, 59, 999);
          filtered = filtered.filter(op => {
            const opDate = new Date(op.finalizedAt);
            return opDate >= dayStart && opDate <= dayEnd;
          });
        }
        break;
      case 'range':
        if (startDate && endDate) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          filtered = filtered.filter(op => {
            const opDate = new Date(op.finalizedAt);
            return opDate >= start && opDate <= end;
          });
        }
        break;
    }

    return filtered.slice(0, 100); // Limita a 100 resultados
  }

  static clearAll(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('🗑️ Histórico limpo');
    } catch (error) {
      console.error('❌ Erro ao limpar histórico:', error);
    }
  }

  static getStats(): {
    totalOperations: number;
    totalProfit: number;
    averagePercent: number;
  } {
    const operations = this.getAllOperations();
    
    const totalOperations = operations.length;
    const totalProfit = operations.reduce((sum, op) => sum + op.profitLossUsd, 0);
    const averagePercent = totalOperations > 0 
      ? operations.reduce((sum, op) => sum + op.profitLossPercent, 0) / totalOperations 
      : 0;

    return { totalOperations, totalProfit, averagePercent };
  }
} 