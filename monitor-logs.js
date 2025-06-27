const https = require('https');

console.log('🔍 Monitorando logs do servidor Render...');
console.log('📊 Aguardando dados de WebSocket e detecção de oportunidades...\n');

// Função para verificar logs via requisição HTTP (simulação)
function checkServerStatus() {
    console.log(`[${new Date().toLocaleTimeString()}] ⏰ Verificando status do servidor...`);
    
    // Simula verificação de logs
    console.log('📡 Aguardando logs de:');
    console.log('  ✅ [PRICE UPDATE] - Atualizações de preços');
    console.log('  ✅ [MARKET PRICES] - Estado dos dados de mercado');
    console.log('  ✅ [DEBUG] - Verificação de dados ausentes');
    console.log('  🎯 [OPORTUNIDADE DETECTADA] - Oportunidades de arbitragem');
    console.log('');
    
    // Instruções para o usuário
    console.log('📋 COMO VERIFICAR OS LOGS NO RENDER:');
    console.log('1. Acesse: https://dashboard.render.com/');
    console.log('2. Clique no seu serviço "arbitragem-render-03-correcao-de-spread"');
    console.log('3. Vá na aba "Logs"');
    console.log('4. Procure por:');
    console.log('   - "[PRICE UPDATE]" - Se os dados estão chegando');
    console.log('   - "[MARKET PRICES]" - Quantos símbolos estão ativos');
    console.log('   - "[DEBUG] Dados ausentes" - Se há problemas de dados');
    console.log('   - "🔍 OPORTUNIDADE DETECTADA" - Se encontrou arbitragem');
    console.log('');
    
    console.log('🔄 O deploy pode levar 2-3 minutos para ser concluído...');
    console.log('📈 Após o deploy, os logs devem mostrar:');
    console.log('   - Conexões WebSocket estabelecidas');
    console.log('   - Atualizações de preços chegando');
    console.log('   - Oportunidades sendo detectadas');
}

// Executa a verificação a cada 30 segundos
checkServerStatus();
setInterval(checkServerStatus, 30000);

// Encerra após 5 minutos
setTimeout(() => {
    console.log('\n⏰ Monitoramento encerrado.');
    console.log('🔍 Verifique os logs no dashboard do Render para ver os resultados!');
    process.exit(0);
}, 300000); 