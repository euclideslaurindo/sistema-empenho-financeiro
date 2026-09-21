import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import * as jose from 'jose';
import { JWT_SECRET } from '@/lib/jwt-secret';
import { AUTH_COOKIE_NAME } from '@/lib/constants';
import { UsuarioDB } from '@/lib/types/db';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();

  try {
    // busca os dados do usuario logado pelo email que veio do token
    const rows = await query<UsuarioDB[]>(
      'SELECT id, nome, email, perfil, ativo, created_at, ultimo_acesso FROM usuarios WHERE email = ? LIMIT 1',
      [user.email]
    );
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    }
    return NextResponse.json({ usuario: rows[0] });
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const data = await request.json();
    const { nome, email } = data;

    if (!nome || !email) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // Verificar se o novo e-mail já existe em outro perfil
    const [existing] = await query<{id: string}[]>(
      'SELECT id FROM usuarios WHERE email = ? AND id != ? LIMIT 1',
      [email.trim(), user.id]
    );
    if (existing) {
      return NextResponse.json({ error: 'Este e-mail já está em uso por outro usuário.' }, { status: 409 });
    }

    // cada usuario so pode editar o proprio perfil
    await query(
      'UPDATE usuarios SET nome = ?, email = ? WHERE id = ?',
      [nome.trim(), email.trim(), user.id]
    );

    // Gerar um novo JWT atualizado
    const jwt = await new jose.SignJWT({
      id: user.id,
      nome: nome.trim(),
      email: email.trim(),
      perfil: user.perfil,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('8h')
      .sign(JWT_SECRET);

    const response = NextResponse.json({ message: 'Perfil atualizado com sucesso' });
    
    // Atualizar o cookie com o novo token
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: jwt,
      httpOnly: true,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 horas
    });

    return response;
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
