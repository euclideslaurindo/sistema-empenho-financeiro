import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { obterIdentificacao, salvarIdentificacao } from '@/lib/services/configuracoes-gerais.service';

// GET /api/configuracoes/identificacao — cabeçalho dos relatórios (qualquer usuário logado)
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();
    return NextResponse.json(await obterIdentificacao(), { headers: { 'Cache-Control': 'no-store' } });
  });
}

// PUT /api/configuracoes/identificacao — só o administrador
export async function PUT(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();
    if (user.perfil !== 'ADMIN') return forbiddenResponse();
    const result = await salvarIdentificacao(await request.json(), user.id, user.perfil);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, ...result.data });
  });
}
