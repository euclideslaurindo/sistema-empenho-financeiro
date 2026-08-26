import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { checkRateLimit } from '@/lib/rate-limiter';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'chave-local-dev-2026-nao-usar-em-producao'
);

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
  
  // Rate Limiting: max 5 tentativas em 15 minutos (900000ms)
  const rateCheck = checkRateLimit(ip);
  
  if (!rateCheck.allowed) {
    const retryAfterSec = Math.ceil((rateCheck.retryAfterMs || 0) / 1000);
    return NextResponse.json(
      { error: `Muitas tentativas de login. Tente novamente em ${retryAfterSec} segundos.` },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
    );
  }

  try {
    const body = await request.json();
    const { email, senha } = body;

    if (!email || !senha) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    // Busca o usuário no banco
    const rows = await query<any[]>(
      'SELECT id, nome, email, senha as senha_hash, nivel_acesso, ativo FROM usuarios WHERE email = ?',
      [email]
    );
    const user = rows && rows.length > 0 ? rows[0] : null;

    if (!user) {
      // Retorna genérico para não expor quais emails existem
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    // Mapear nivel_acesso para string perfil
    let perfil = 'CONSULTA';
    if (user.nivel_acesso === 1) perfil = 'ADMIN';
    else if (user.nivel_acesso === 2) perfil = 'GESTOR';
    user.perfil = perfil;

    if (!user.ativo) {
      return NextResponse.json({ error: 'Usuário inativo. Contate o administrador.' }, { status: 403 });
    }

    // Compara senha
    let isPasswordValid = false;
    if (user.senha_hash.startsWith('$2')) {
      isPasswordValid = await bcrypt.compare(senha, user.senha_hash);
    } else {
      // Fallback para desenvolvimento caso a senha no banco esteja em texto puro (ex: admin123)
      isPasswordValid = (senha === user.senha_hash);
    }

    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    // Gera JWT
    const token = await new SignJWT({
      id: user.id,
      email: user.email,
      nome: user.nome,
      perfil: user.perfil
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('8h')
      .setIssuedAt()
      .sign(JWT_SECRET);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        perfil: user.perfil
      }
    });

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8 // 8 horas
    });

    return response;
  } catch (error) {
    console.error('[API Auth] Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno no servidor: ' + ((error as any).stack || String(error)) },
      { status: 500 }
    );
  }
}
