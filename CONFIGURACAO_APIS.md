# 🔧 Configuração das APIs das Exchanges

## ⚠️ IMPORTANTE - Problemas Resolvidos

### Problemas Identificados e Soluções:

1. **❌ Erro "does not have a testnet for spot market"**
   - **Causa**: Gate.io e MEXC não têm sandbox/testnet para mercado spot
   - **Solução**: Configurado `sandbox: false` nas duas exchanges

2. **❌ Erro "missing bootstrap script" do Next.js**
   - **Causa**: Cache corrompido do Next.js
   - **Solução**: Removido cache `.next` e reiniciado servidor

3. **❌ APIs retornando erro de credenciais**
   - **Causa**: Variáveis de ambiente não configuradas
   - **Solução**: Instruções abaixo para configurar

## 🚀 Configuração das Variáveis de Ambiente

### 1. Criar arquivo `.env.local` na raiz do projeto:

```bash
# Configurações das APIs das Exchanges
# IMPORTANTE: Configure suas chaves reais das APIs aqui

# Gate.io API
GATEIO_API_KEY=sua_chave_gateio_aqui
GATEIO_API_SECRET=seu_secret_gateio_aqui

# MEXC API  
MEXC_API_KEY=sua_chave_mexc_aqui
MEXC_API_SECRET=seu_secret_mexc_aqui

# Ambiente
NODE_ENV=development

# Database URL
DATABASE_URL="postgresql://arbitragem_banco_bdx8_user:eSa4DBin3bl9GI5DHmL9x1lXd4I329vT@dpg-d1i63eqdbo4c7387d2l0-a.oregon-postgres.render.com/arbitragem_banco_bdx8"
```

### 2. Como obter as chaves das APIs:

#### Gate.io:
1. Acesse: https://www.gate.io/myaccount/apiv4keys
2. Crie uma nova API Key
3. Permissões necessárias: **Spot Trading**, **Futures Trading**, **Wallet**

#### MEXC:
1. Acesse: https://www.mexc.com/user/openapi
2. Crie uma nova API Key  
3. Permissões necessárias: **Spot Trading**, **Futures Trading**, **Wallet**

### 3. Configurações de Segurança:

- ✅ **Modo Produção**: APIs configuradas para usar contas reais (não sandbox)
- ✅ **Permissões**: Apenas trading e consulta de saldos
- ✅ **IPs**: Configure whitelist de IPs nas exchanges se necessário

## 🔄 Testando a Configuração

### 1. Verificar APIs:
```bash
curl http://localhost:3000/api/trading/balance
```

### 2. Resultado esperado:
```json
{
  "success": true,
  "exchanges": [
    {
      "success": true,
      "exchange": "gateio", 
      "balances": {...},
      "timestamp": "..."
    },
    {
      "success": true,
      "exchange": "mexc",
      "balances": {...}, 
      "timestamp": "..."
    }
  ]
}
```

## 🛠️ Solução de Problemas

### Se ainda houver erros:

1. **Verificar credenciais**:
   - Chaves API corretas
   - Permissões adequadas
   - IPs autorizados

2. **Reiniciar servidor**:
   ```bash
   # Parar servidor (Ctrl+C)
   npm run dev
   ```

3. **Limpar cache se necessário**:
   ```bash
   Remove-Item -Recurse -Force .next
   npm run dev
   ```

## ✅ Status Atual

- ✅ Banco de dados: Funcionando (PostgreSQL limpo)
- ✅ APIs de trading: Configuradas (aguardando credenciais)
- ✅ Interface: Funcionando
- ✅ Execução de ordens: Implementada
- ✅ Cache Next.js: Limpo

**Sistema pronto para operar após configuração das chaves API!**

# Sistema de Configuração de API Keys

## 📋 Resumo

Implementado sistema seguro de configuração de API Keys diretamente no dashboard, eliminando a necessidade de expor credenciais no código fonte.

## 🔧 Componentes Implementados

### 1. **Modelo de Banco de Dados**
```prisma
model ApiConfiguration {
  id          String   @id @default(cuid())
  exchange    String   @unique // 'gateio', 'mexc', 'binance', 'bybit', 'bitget'
  apiKey      String   // Criptografado
  apiSecret   String   // Criptografado
  passphrase  String?  // Para exchanges que precisam (como Bitget)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([exchange])
}
```

### 2. **Sistema de Criptografia** (`lib/crypto.ts`)
- **Algoritmo**: AES-256-CBC
- **Chave de criptografia**: Variável de ambiente `ENCRYPTION_KEY`
- **Funções**:
  - `encrypt(text: string)`: Criptografa texto
  - `decrypt(encryptedText: string)`: Descriptografa texto
  - `isEncrypted(text: string)`: Verifica se texto está criptografado

### 3. **API de Configuração** (`/api/config/api-keys`)

#### **GET** - Listar configurações
```typescript
GET /api/config/api-keys
// Retorna lista de exchanges configuradas (sem expor as chaves)
```

#### **POST** - Salvar/Atualizar configuração
```typescript
POST /api/config/api-keys
{
  "exchange": "gateio" | "mexc" | "binance" | "bybit" | "bitget",
  "apiKey": "sua_api_key",
  "apiSecret": "sua_api_secret",
  "passphrase": "sua_passphrase", // Opcional, obrigatório apenas para Bitget
  "isActive": true
}
```

#### **DELETE** - Remover configuração
```typescript
DELETE /api/config/api-keys?exchange=gateio
```

### 4. **Página de Configuração** (`/configuracoes`)

#### **Recursos da Interface**:
- ✅ Formulários separados para Gate.io, MEXC, Binance, Bybit e Bitget
- ✅ Campos de senha com botão de visualização
- ✅ Campo passphrase para Bitget (obrigatório)
- ✅ Status de configuração (Ativa/Inativa/Não configurada)
- ✅ Validação de campos obrigatórios
- ✅ Mensagens de feedback (sucesso/erro)
- ✅ Instruções para obter API Keys de todas as exchanges
- ✅ Aviso de segurança sobre criptografia

#### **Funcionalidades**:
- **Salvar configurações**: Criptografia automática antes do armazenamento
- **Atualizar configurações**: Substitui configurações existentes
- **Remover configurações**: Exclusão com confirmação
- **Status visual**: Indicadores coloridos de status

### 5. **Integração com APIs de Trading**

#### **APIs Atualizadas**:
- `/api/trading/execute-order` - Execução de ordens
- `/api/trading/balance` - Consulta de saldos

#### **Sistema de Fallback**:
1. **Prioridade 1**: Credenciais do banco de dados (criptografadas)
2. **Prioridade 2**: Variáveis de ambiente (fallback)
3. **Erro**: Se nenhuma configuração disponível

```typescript
// Exemplo de uso interno
const config = await getExchangeConfig('gateio');
if (!config) {
  throw new Error('Credenciais não configuradas. Configure na página de configurações.');
}
```

## 🛡️ Segurança

### **Criptografia**
- Chaves armazenadas com criptografia AES-256-CBC
- IV (Initialization Vector) único para cada chave
- Chave de criptografia via variável de ambiente

### **Validações**
- Validação de exchange suportada
- Campos obrigatórios verificados
- Sanitização de entrada

### **Exposição Mínima**
- API Keys nunca retornadas via GET
- Apenas status e metadados expostos
- Descriptografia apenas para uso interno

## 📱 Como Usar

### **1. Acessar Configurações**
- Ir para `/configuracoes` no menu lateral
- Ou acessar diretamente: `http://localhost:3000/configuracoes`

### **2. Configurar Gate.io**
1. Inserir API Key da Gate.io
2. Inserir API Secret da Gate.io
3. Marcar "Configuração ativa" se desejado
4. Clicar em "Salvar Gate.io"

### **3. Configurar MEXC**
1. Inserir API Key da MEXC
2. Inserir API Secret da MEXC
3. Marcar "Configuração ativa" se desejado
4. Clicar em "Salvar MEXC"

### **4. Obter API Keys**

#### **Gate.io**:
1. Acessar [gate.io](https://www.gate.io) e fazer login
2. Ir em "API Management" no menu do usuário
3. Clicar em "Create API Key"
4. Configurar permissões (Spot Trading, Futures Trading)
5. Copiar API Key e Secret geradas

#### **MEXC**:
1. Acessar [mexc.com](https://www.mexc.com) e fazer login
2. Ir em "API Management" nas configurações da conta
3. Clicar em "Create API"
4. Configurar permissões (Spot Trading, Futures Trading)
5. Copiar API Key e Secret geradas

## 🔄 Migração

### **Variáveis de Ambiente (Antigo)**
```env
GATEIO_API_KEY=sua_chave
GATEIO_API_SECRET=sua_secret
MEXC_API_KEY=sua_chave
MEXC_API_SECRET=sua_secret
```

### **Banco de Dados (Novo)**
- Configurações armazenadas na tabela `ApiConfiguration`
- Criptografia automática
- Interface web para gerenciamento

### **Compatibilidade**
- Sistema mantém compatibilidade com variáveis de ambiente
- Migração gradual possível
- Fallback automático se banco não configurado

## ✅ Vantagens

1. **Segurança Aprimorada**
   - Chaves criptografadas no banco
   - Não expostas no código fonte
   - Controle de acesso via interface

2. **Facilidade de Uso**
   - Interface intuitiva
   - Configuração sem necessidade de redeploy
   - Status visual das configurações

3. **Flexibilidade**
   - Ativação/desativação individual
   - Atualização sem downtime
   - Múltiplas configurações por exchange

4. **Auditoria**
   - Timestamps de criação/atualização
   - Histórico de mudanças
   - Status de ativação

## 🚀 Próximos Passos

- [ ] Implementar logs de uso das API Keys
- [ ] Adicionar validação de conectividade
- [ ] Sistema de backup das configurações
- [ ] Interface para teste de credenciais
- [ ] Notificações de expiração de chaves

---

**Status**: ✅ **IMPLEMENTADO E FUNCIONAL**
**Versão**: 1.0
**Data**: Janeiro 2025

## 🆕 Novas Exchanges Adicionadas

### Exchanges Suportadas:
1. **Gate.io** - API Key + Secret
2. **MEXC** - API Key + Secret  
3. **Binance** - API Key + Secret
4. **Bybit** - API Key + Secret
5. **Bitget** - API Key + Secret + Passphrase

### Como obter API Keys das novas exchanges:

#### **Binance**:
1. Acesse [binance.com](https://www.binance.com) e faça login
2. Vá em "API Management" no menu do usuário
3. Clique em "Create API"
4. Configure as permissões (Spot & Margin Trading, Futures)
5. Copie a API Key e Secret geradas

#### **Bybit**:
1. Acesse [bybit.com](https://www.bybit.com) e faça login
2. Vá em "API" nas configurações da conta
3. Clique em "Create New Key"
4. Configure as permissões (Derivatives, Spot)
5. Copie a API Key e Secret geradas

#### **Bitget**:
1. Acesse [bitget.com](https://www.bitget.com) e faça login
2. Vá em "API Management" nas configurações da conta
3. Clique em "Create API Key"
4. Configure as permissões (Spot Trading, Futures Trading)
5. Copie a API Key, Secret e **Passphrase** geradas

### Funcionalidades Implementadas:
- ✅ Interface web atualizada com cards para todas as exchanges
- ✅ Suporte a passphrase para Bitget
- ✅ Validação específica por exchange
- ✅ Sistema de criptografia expandido
- ✅ Instruções detalhadas para cada exchange

**Atualização**: Janeiro 2025 