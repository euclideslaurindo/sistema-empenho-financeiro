import * as jose from 'jose';
import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'chave-local-dev-2026-nao-usar-em-producao'
);

export interface AuthUser {
  id: string;
  nome: string;
  email: string;
  perfil: string;
}

/**
 * Extrai e valida o usuário autenticado a partir do cookie JWT da requisição.
 * Retorna null se o token não existir ou for inválido.
 */
export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    const token = request.cookies.get('auth_token')?.value;
    if (!token) return null;

    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    return {
      id: payload.id as string,
      nome: payload.nome as string,
      email: payload.email as string,
      perfil: payload.perfil as string,
    };
  } catch {
    return null;
  }
}

/** Resposta 401 padronizada. */
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: 'Nao autenticado. Faca login para continuar.' }, { status: 401 });
}

/** Resposta 403 padronizada. */
export function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: 'Acesso negado. Perfil insuficiente para esta operacao.' }, { status: 403 });
}
