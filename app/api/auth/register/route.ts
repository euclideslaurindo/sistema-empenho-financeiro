import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';

export async function POST(request: NextRequest) {
  // Somente ADMIN pode criar novos usuários
  const admin = await getAuthUser(request);
  if (!admin) return unauthorizedResponse();
  if (admin.perfil !== 'ADMIN') return forbiddenResponse();

  try {
    const body = await request.json();
    const { nome, senha } = body;

    if (!nome || !senha) {
      return NextResponse.json(
        { error: 'Nome e senha são obrigatórios' },
        { status: 400 }
      );
    }

    if (nome.trim().length > 100) {
      return NextResponse.json(
        { error: 'O nome de usuário não pode ter mais de 100 caracteres.' },
        { status: 400 }
      );
    }

    if (senha.length < 8) {
      return NextResponse.json(
        { error: 'A senha deve ter no mínimo 8 caracteres' },
        { status: 400 }
      );
    }

    if (senha.length > 128) {
      return NextResponse.json(
        { error: 'A senha não pode ter mais de 128 caracteres.' },
        { status: 400 }
      );
    }

    // Criar um email fake baseado no nome de usuário + hash único para evitar colisão de homônimos
    // Ex: "João Silva" + UUID abc12345 → "joao.silva.abc12345@empenho.local"
    const id = crypto.randomUUID();
    const normalizedUsername = nome.trim().toLowerCase().replace(/\s+/g, '.');
    const uniqueSuffix = id.replace(/-/g, '').substring(0, 8);
    const fakeEmail = `${normalizedUsername}.${uniqueSuffix}@empenho.local`;

    // Verifica se já existe (praticamente impossível com UUID, mas segurança extra)
    const [existing]: any = await query(
      'SELECT id FROM usuarios WHERE email = ?',
      [fakeEmail]
    );

    if (existing) {
      return NextResponse.json(
        { error: 'Esse nome de usuário já está em uso.' },
        { status: 409 }
      );
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(senha, salt);

    // Inserir no banco como GESTOR (Usuário normal)
    await query(
      `INSERT INTO usuarios (id, nome, email, senha_hash, perfil, ativo)
       VALUES (?, ?, ?, ?, 'GESTOR', 1)`,
      [id, nome.trim(), fakeEmail, hash]
    );

    return NextResponse.json({
      success: true,
      message: 'Usuário criado com sucesso'
    });

  } catch (error: any) {
    console.error('[API Auth Register] Erro:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'Esse usuário já está cadastrado.' }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Erro interno no servidor ao criar usuário.' },
      { status: 500 }
    );
  }
}
