import crypto from 'crypto';

// Chave de criptografia - em produção, deve vir de variável de ambiente
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'minha-chave-secreta-de-32-chars-default!!';
const ALGORITHM = 'aes-256-cbc';

// Garantir que a chave tenha 32 bytes para AES-256
function getKey(): Buffer {
  const key = ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32);
  return Buffer.from(key, 'utf8');
}

export function encrypt(text: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(encryptedText: string): string {
  try {
    const key = getKey();
    const textParts = encryptedText.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedData = textParts.join(':');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Erro ao descriptografar:', error);
    return '';
  }
}

// Função para validar se uma chave está criptografada
export function isEncrypted(text: string): boolean {
  return text.includes(':') && text.length > 32;
} 