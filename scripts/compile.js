const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Limpa a pasta dist
console.log('Limpando pasta dist...');
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
}

// Gera o Prisma Client
console.log('Gerando Prisma Client...');
execSync('npx prisma generate', { stdio: 'inherit' });

// Compila TypeScript para JavaScript ES5
console.log('Compilando TypeScript para JavaScript ES5...');
execSync('npx tsc --project tsconfig.compile.json', { stdio: 'inherit' });

console.log('Compilação concluída!'); 