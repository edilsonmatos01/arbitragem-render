import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { encrypt, decrypt } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

// GET - Buscar configurações das exchanges
export async function GET(req: NextRequest) {
  try {
    if (!prisma) {
      console.warn('Aviso: Banco de dados não disponível');
      return NextResponse.json([]);
    }

    const configs = await prisma.apiConfiguration.findMany({
      select: {
        id: true,
        exchange: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // Não retornamos as chaves por segurança
      }
    });

    return NextResponse.json(configs);
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// POST - Criar ou atualizar configuração
export async function POST(req: NextRequest) {
  try {
    if (!prisma) {
      return NextResponse.json({ error: 'Banco de dados não disponível' }, { status: 500 });
    }

    const body = await req.json();
    const { exchange, apiKey, apiSecret, passphrase, isActive = true } = body;

    if (!exchange || !apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Exchange, API Key e API Secret são obrigatórios' }, { status: 400 });
    }

    // Validar exchange
    const supportedExchanges = ['gateio', 'mexc', 'binance', 'bybit', 'bitget'];
    if (!supportedExchanges.includes(exchange)) {
      return NextResponse.json({ 
        error: `Exchange deve ser uma das seguintes: ${supportedExchanges.join(', ')}` 
      }, { status: 400 });
    }

    // Criptografar as chaves
    const encryptedApiKey = encrypt(apiKey);
    const encryptedApiSecret = encrypt(apiSecret);
    const encryptedPassphrase = passphrase ? encrypt(passphrase) : null;

    // Verificar se já existe configuração para esta exchange
    const existingConfig = await prisma.apiConfiguration.findUnique({
      where: { exchange }
    });

    let config;
    if (existingConfig) {
      // Atualizar configuração existente
      config = await prisma.apiConfiguration.update({
        where: { exchange },
        data: {
          apiKey: encryptedApiKey,
          apiSecret: encryptedApiSecret,
          passphrase: encryptedPassphrase,
          isActive
        },
        select: {
          id: true,
          exchange: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });
    } else {
      // Criar nova configuração
      config = await prisma.apiConfiguration.create({
        data: {
          exchange,
          apiKey: encryptedApiKey,
          apiSecret: encryptedApiSecret,
          passphrase: encryptedPassphrase,
          isActive
        },
        select: {
          id: true,
          exchange: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error('Erro ao salvar configuração:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// DELETE - Remover configuração
export async function DELETE(req: NextRequest) {
  try {
    if (!prisma) {
      return NextResponse.json({ error: 'Banco de dados não disponível' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const exchange = searchParams.get('exchange');

    if (!exchange) {
      return NextResponse.json({ error: 'Exchange é obrigatório' }, { status: 400 });
    }

    await prisma.apiConfiguration.delete({
      where: { exchange }
    });

    return NextResponse.json({ message: 'Configuração removida com sucesso' });
  } catch (error) {
    console.error('Erro ao remover configuração:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// Função utilitária para obter credenciais descriptografadas (para uso interno)
export async function getApiCredentials(exchange: string): Promise<{
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
} | null> {
  try {
    if (!prisma) {
      return null;
    }

    const config = await prisma.apiConfiguration.findUnique({
      where: { 
        exchange,
        isActive: true
      }
    });

    if (!config) {
      return null;
    }

    return {
      apiKey: decrypt(config.apiKey),
      apiSecret: decrypt(config.apiSecret),
      passphrase: config.passphrase ? decrypt(config.passphrase) : undefined
    };
  } catch (error) {
    console.error('Erro ao obter credenciais:', error);
    return null;
  }
} 