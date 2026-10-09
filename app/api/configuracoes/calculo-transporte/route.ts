import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { listarVigenciasParametros, salvarVigenciaParametros } from '@/lib/services/parametros-calculo.service';

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();
    return NextResponse.json(await listarVigenciasParametros(), { headers: { 'Cache-Control': 'no-store' } });
  });
}

export async function PUT(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();
    if (user.perfil !== 'ADMIN') return forbiddenResponse();
    const result = await salvarVigenciaParametros(await request.json(), user.id, user.perfil);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true });
  });
}
