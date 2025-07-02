# 📊 Estratégia de Arbitragem - Documentação Oficial

## 🎯 Estratégia Padrão (SEMPRE)

### 🟢 Abertura de Posição:
```
SPOT:    COMPRA  (independente da corretora)
FUTURES: VENDA   (independente da corretora)
```

### 🔴 Fechamento de Posição:
```
SPOT:    VENDA   (fechar posição de compra)
FUTURES: COMPRA  (fechar posição de venda)
```

## 💡 Lógica da Estratégia

### Por que sempre COMPRA spot + VENDA futures?

1. **Spot Trading**: Compramos o ativo físico
2. **Futures Trading**: Vendemos o contrato futuro
3. **Lucro**: Capturamos a diferença de preço entre os mercados

### Exemplo Prático:
```
BTC/USDT - Gate.io Spot:    $50,000 (COMPRAR)
BTC/USDT - MEXC Futures:    $50,100 (VENDER)
Spread: +$100 (0.2%)
```

**Resultado**: Independente da direção do BTC, lucramos $100 por BTC

## 🔧 Configuração das Exchanges

### Gate.io:
- **Spot**: Saldo disponível para COMPRAS
- **Futures**: Não utilizado nesta estratégia

### MEXC:
- **Spot**: Não utilizado nesta estratégia  
- **Futures**: Saldo disponível para VENDAS

## ⚙️ Implementação no Sistema

### API de Execução (`/api/trading/execute-order`):

```javascript
// Abertura de posição
const orders = [
  {
    exchange: 'gateio',
    symbol: 'BTC/USDT',
    side: 'buy',        // SEMPRE COMPRA
    amount: 0.01,
    type: 'market',
    marketType: 'spot'  // SEMPRE SPOT
  },
  {
    exchange: 'mexc',
    symbol: 'BTC/USDT',
    side: 'sell',       // SEMPRE VENDA
    amount: 0.01,
    type: 'market',
    marketType: 'futures' // SEMPRE FUTURES
  }
];
```

### Fechamento de posição:
```javascript
// Fechamento (ordens contrárias)
const closeOrders = [
  {
    exchange: 'gateio',
    symbol: 'BTC/USDT',
    side: 'sell',       // VENDER o que compramos
    amount: 0.01,
    type: 'market',
    marketType: 'spot'
  },
  {
    exchange: 'mexc',
    symbol: 'BTC/USDT',
    side: 'buy',        // COMPRAR para fechar venda
    amount: 0.01,
    type: 'market',
    marketType: 'futures'
  }
];
```

## 📈 Cálculo de Lucro

```
Lucro = (Preço_Futures_Venda - Preço_Spot_Compra) * Quantidade
```

### Exemplo:
- Comprou spot: $50,000
- Vendeu futures: $50,100
- Quantidade: 0.01 BTC
- **Lucro**: ($50,100 - $50,000) * 0.01 = $1.00

## ✅ Validações Importantes

### Antes de abrir posição:
1. ✅ Saldo USDT suficiente na Gate.io (spot)
2. ✅ Saldo USDT suficiente na MEXC (futures)
3. ✅ Spread positivo (futures > spot)
4. ✅ Spread maior que spread mínimo configurado

### Durante execução:
1. ✅ Ordens executadas simultaneamente
2. ✅ Preços reais de execução registrados
3. ✅ IDs das ordens salvos para auditoria

## 🚨 Regras de Segurança

1. **NUNCA** inverter a estratégia (venda spot + compra futures)
2. **SEMPRE** validar saldos antes da execução
3. **SEMPRE** confirmar spread positivo
4. **SEMPRE** registrar preços reais de execução

## 📊 Status Atual do Sistema

- ✅ Gate.io Spot: Configurado para COMPRAS
- ✅ MEXC Futures: Configurado para VENDAS  
- ✅ APIs funcionando corretamente
- ✅ Saldos disponíveis:
  - Gate.io: 10.80 USDT (spot)
  - MEXC: 10.32 USDT (futures)
- ✅ Sistema pronto para arbitragem!

**🎯 Estratégia implementada e funcionando conforme especificado!** 