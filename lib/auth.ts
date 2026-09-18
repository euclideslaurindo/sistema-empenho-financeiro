import * as jose from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import { JWT_SECRET } from '@/lib/jwt-secret';
import { AUTH_COOKIE_NAME } from '@/lib/constants';

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
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return null;

    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    const id = payload.id as string;

    // Consulta o banco em tempo real para garantir revogação imediata de acesso
    const { query } = await import('@/lib/db');
    const users: any[] = await query('SELECT ativo FROM usuarios WHERE id = ?', [id]);
    const isAtivo = (users && users.length > 0 && users[0].ativo);

    if (!isAtivo) {
      return null;
    }

    return {
      id,
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
