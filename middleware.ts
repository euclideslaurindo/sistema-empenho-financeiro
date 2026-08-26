import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as jose from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'chave-local-dev-2026-nao-usar-em-producao'
);

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const { pathname } = request.nextUrl;

  // Rotas que não precisam de autenticação
  const isPublicPath =
    pathname === '/login' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/setup');

  if (isPublicPath) {
    return NextResponse.next();
  }

  // Se não há token, retorna 401 para API ou redireciona para login
  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    // Verifica a assinatura e validade do token
    await jose.jwtVerify(token, JWT_SECRET);
    return NextResponse.next();
  } catch {
    // Token inválido ou expirado
    if (pathname.startsWith('/api/')) {
      const response = NextResponse.json({ error: 'Sessao expirada.' }, { status: 401 });
      response.cookies.delete('auth_token');
      return response;
    }
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('auth_token');
    return response;
  }
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};

