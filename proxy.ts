import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as jose from 'jose';
import { JWT_SECRET } from '@/lib/jwt-secret';
import { AUTH_COOKIE_NAME } from '@/lib/constants';

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const { pathname } = request.nextUrl;

  // Rotas que não precisam de autenticação
  const isPublicPath =
    pathname === '/login' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/setup') ||
    pathname === '/api/health' ||
    // Arquivos estáticos servidos direto de public/ (imagens, manifest, etc).
    // Sem isso, o brasão de Pernambuco no header (via next/image) quebra:
    // o otimizador de imagem do Next busca /brasao_pernambuco.png por baixo
    // dos panos, cai aqui, é redirecionado pro /login (sem cookie de auth
    // nessa busca interna), e o Next recebe uma resposta que não é imagem
    // ("The requested resource isn't a valid image ... received null").
    /\.(png|jpe?g|svg|gif|webp|ico|json|css|js|txt|woff2?)$/i.test(pathname);

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
      response.cookies.delete(AUTH_COOKIE_NAME);
      return response;
    }
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
