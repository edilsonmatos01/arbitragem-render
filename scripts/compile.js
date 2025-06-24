const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Limpa a pasta dist
console.log('Limpando pasta dist...');
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
}

// Remove node_modules e reinstala
console.log('Reinstalando dependências...');
if (fs.existsSync('node_modules')) {
  fs.rmSync('node_modules', { recursive: true, force: true });
}

// Instala dependências com npm ci
execSync('npm ci --production=false', { stdio: 'inherit' });

// Gera o Prisma Client com configurações específicas
console.log('Gerando Prisma Client...');
process.env.NODE_ENV = 'production';
execSync('npx prisma generate', {
  stdio: 'inherit',
  env: {
    ...process.env,
    PRISMA_CLIENT_ENGINE_TYPE: 'binary',
    PRISMA_CLI_QUERY_ENGINE_TYPE: 'binary'
  },
});

// Lista de arquivos TypeScript para compilar
const files = [
  'spread-monitor.ts',
  'store-spreads.ts',
  'cleanSpreadData.ts',
  'check-spread-data.ts',
  'fetchMarketSymbols.ts',
  'scheduleCleanup.ts'
];

// Compila cada arquivo
files.forEach(file => {
  const filePath = path.join(__dirname, file);
  console.log(`Compilando ${file}...`);
  
  execSync(`tsc ${filePath} --project ${path.join(__dirname, 'tsconfig.json')}`, { stdio: 'inherit' });
});

// Move os arquivos necessários para dist
console.log('Movendo arquivos para dist...');
if (!fs.existsSync('dist/node_modules')) {
  fs.mkdirSync('dist/node_modules', { recursive: true });
}

// Copia o Prisma Client gerado para dist
const prismaClientPath = path.join('node_modules', '.prisma', 'client');
if (fs.existsSync(prismaClientPath)) {
  const distPrismaPath = path.join('dist', 'node_modules', '.prisma', 'client');
  fs.mkdirSync(distPrismaPath, { recursive: true });
  fs.cpSync(prismaClientPath, distPrismaPath, { recursive: true });
}

console.log('Compilação concluída!'); 