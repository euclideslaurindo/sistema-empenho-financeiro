import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limiter';
import { JWT_SECRET } from '@/lib/jwt-secret';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';

  // Lê o body antecipadamente para usar o email na chave do rate limiter
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido.' }, { status: 400 });
  }

  const { email, senha } = body;

  // Rate Limiting: max 10 tentativas em 15 minutos, por combinação IP+email
  // Isso evita o problema de LAN (IP compartilhado) sem bloquear outros usuários
  const rateKey = `${ip}:${String(email || '').trim().toLowerCase()}`;
  const rateCheck = checkRateLimit(rateKey);
  if (!rateCheck.allowed) {
    const retryAfterSec = Math.ceil((rateCheck.retryAfterMs || 0) / 1000);
    return NextResponse.json(
      { error: `Muitas tentativas de login. Tente novamente em ${retryAfterSec} segundos.` },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
    );
  }

  try {
    if (!email || !senha) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    // Converter o "nome" do login no mesmo formato de email fake gerado no registro
    const normalizedUsername = email.trim().toLowerCase().replace(/\s+/g, '.');
    const fakeEmail = `${normalizedUsername}@empenho.local`;

    // Busca o usuário pelo nome (email fake) ou pelo email exato
    const dbUsers: any[] = await query(
      'SELECT id, nome, email, senha_hash, perfil, ativo FROM usuarios WHERE email = ? OR email = ? LIMIT 1',
      [fakeEmail, email]
    );

    const user = dbUsers && dbUsers.length > 0 ? dbUsers[0] : null;

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 401 });
    }

    if (!user.ativo) {
      return NextResponse.json({ error: 'Sua conta está desativada' }, { status: 403 });
    }

    const isPasswordValid = await bcrypt.compare(senha, user.senha_hash);

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

    // Login bem-sucedido: limpa o contador de tentativas para este usuário
    resetRateLimit(rateKey);

    return response;
  } catch (error) {
    console.error('[API Auth] Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno no servidor.' },
      { status: 500 }
    );
  }
}
