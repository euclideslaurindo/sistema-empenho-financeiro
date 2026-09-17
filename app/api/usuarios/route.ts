import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { hash } from 'bcryptjs';

// GET /api/usuarios - Lista usuários
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || user.perfil !== 'ADMIN') return unauthorizedResponse();

  try {
    const usuarios = await query<any[]>(
      `SELECT id, nome, email, perfil, ativo, created_at FROM usuarios ORDER BY nome ASC`
    );
    return NextResponse.json({ usuarios });
  } catch (error: any) {
    console.error('[GET /api/usuarios] Erro:', error);
    return NextResponse.json({ error: 'Erro ao listar usuários' }, { status: 500 });
  }
}

// POST /api/usuarios - Cria novo usuário
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || user.perfil !== 'ADMIN') return unauthorizedResponse();

  try {
    const body = await request.json();
    const { nome, email, senha, perfil } = body;

    if (!nome || !email || !senha) {
      return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios' }, { status: 400 });
    }

    const hashed = await hash(senha, 10);
    const id = crypto.randomUUID();
    const roleValue = perfil === 'ADMIN' ? 'ADMIN' : 'USER';

    // check se ja existe
    const [existing] = await query<any[]>(
      'SELECT id FROM usuarios WHERE email = ?',
      [email]
    );

    if (existing) {
      return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 });
    }

    await query(
      `INSERT INTO usuarios (id, nome, email, senha_hash, perfil, ativo) VALUES (?, ?, ?, ?, ?, 1)`,
      [id, nome, email, hashed, roleValue]
    );

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/usuarios] Erro:', error);
    return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 });
  }
}
