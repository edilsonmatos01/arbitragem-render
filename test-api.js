const https = require('https');

function testAPI() {
  const url = 'https://arbitragem-render.onrender.com/api/price-comparison/WHITE_USDT';
  
  console.log('🔍 Testando API:', url);
  
  https.get(url, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('📊 Status:', res.statusCode);
      console.log('📋 Headers:', res.headers);
      
      try {
        const result = JSON.parse(data);
        console.log('✅ Resposta JSON:');
        console.log('- Tipo:', Array.isArray(result) ? 'Array' : typeof result);
        console.log('- Tamanho:', Array.isArray(result) ? result.length : 'N/A');
        
        if (Array.isArray(result) && result.length > 0) {
          console.log('- Primeiro item:', result[0]);
          console.log('- Último item:', result[result.length - 1]);
        } else {
          console.log('- Conteúdo:', result);
        }
      } catch (e) {
        console.log('❌ Erro ao parsear JSON:', e.message);
        console.log('📄 Resposta raw:', data);
      }
    });
  }).on('error', (err) => {
    console.log('❌ Erro na requisição:', err.message);
  });
}

testAPI(); 