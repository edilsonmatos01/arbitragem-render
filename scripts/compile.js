const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Limpa a pasta dist
console.log('Limpando pasta dist...');
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
}

// Limpa o Prisma Client existente
console.log('Limpando Prisma Client...');
const prismaClientPath = path.join(__dirname, '..', 'node_modules', '.prisma', 'client');
if (fs.existsSync(prismaClientPath)) {
  fs.rmSync(prismaClientPath, { recursive: true, force: true });
}

// Gera o Prisma Client com configurações específicas
console.log('Gerando Prisma Client...');
process.env.NODE_ENV = 'production';
execSync('npx prisma generate', {
  stdio: 'inherit',
  env: {
    ...process.env,
    PRISMA_CLIENT_ENGINE_TYPE: 'binary',
  },
});

// Compila TypeScript para JavaScript ES5
console.log('Compilando TypeScript para JavaScript ES5...');
execSync('npx tsc --project tsconfig.compile.json', { stdio: 'inherit' });

console.log('Compilação concluída!'); 