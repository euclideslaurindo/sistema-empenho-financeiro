import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import * as jose from 'jose';
import { JWT_SECRET } from '@/lib/jwt-secret';
import { AUTH_COOKIE_NAME } from '@/lib/constants';
import { PerfilService } from '@/lib/services/perfil.service';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const result = await PerfilService.buscarPorEmail(user.email);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ usuario: result.data });
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

    const result = await PerfilService.atualizarDados(user.id, nome, email, user.perfil);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    // Gerar um novo JWT atualizado (fica na rota: é responsabilidade de sessão HTTP)
    const jwt = await new jose.SignJWT({
      id: result.data.id,
      nome: result.data.nome,
      email: result.data.email,
      perfil: result.data.perfil,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('8h')
      .sign(JWT_SECRET);

    const response = NextResponse.json({ message: 'Perfil atualizado com sucesso' });

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
