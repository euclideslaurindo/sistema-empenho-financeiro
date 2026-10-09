import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { preverProximoNumeroOp } from '@/lib/services/numeracao-op';

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();
    if (user.perfil !== 'ADMIN' && user.perfil !== 'GESTOR') return forbiddenResponse();

    const numeroNe = new URL(request.url).searchParams.get('numeroNe')?.trim();
    if (!numeroNe) {
      return NextResponse.json({ error: 'Informe o número da NE.' }, { status: 400 });
    }

    const result = await preverProximoNumeroOp(numeroNe);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
  });
}
