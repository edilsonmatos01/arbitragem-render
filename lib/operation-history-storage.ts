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

const STORAGE_KEY = 'arbitrage_operation_history';

export class OperationHistoryStorage {
  static saveOperation(operation: OperationHistoryItem) {
    try {
      const existing = this.getAllOperations();
      existing.push(operation);
      
      // Manter apenas os últimos 500 registros
      const limited = existing.slice(-500);
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(limited));
      console.log('✅ Operação salva no localStorage:', operation.symbol);
    } catch (error) {
      console.error('❌ Erro ao salvar no localStorage:', error);
    }
  }

  static getAllOperations(): OperationHistoryItem[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('❌ Erro ao carregar do localStorage:', error);
      return [];
    }
  }

  static deleteOperation(operationId: string): boolean {
    try {
      const existing = this.getAllOperations();
      const filtered = existing.filter(op => op.id !== operationId);
      
      if (filtered.length === existing.length) {
        // Operação não encontrada
        console.log('⚠️ Operação não encontrada no localStorage:', operationId);
        return false;
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      console.log('✅ Operação excluída do localStorage:', operationId);
      return true;
    } catch (error) {
      console.error('❌ Erro ao excluir do localStorage:', error);
      return false;
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

  static clearAll() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('✅ Todos os registros removidos do localStorage');
    } catch (error) {
      console.error('❌ Erro ao limpar localStorage:', error);
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