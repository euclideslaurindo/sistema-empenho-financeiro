import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { salvarAliquotaIrrfSubelemento } from '@/lib/services/config-retencoes.service';

// PUT /api/configuracoes/retencoes/subelementos/irrf — alíquota do IRRF pela
// natureza de um subelemento (B9). Só o administrador. A leitura vem junto do
// GET de /api/configuracoes/retencoes (irrfSubelemento).
export async function PUT(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();
    if (user.perfil !== 'ADMIN') return forbiddenResponse();
    const result = await salvarAliquotaIrrfSubelemento(await request.json(), user.id, user.perfil);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, ...result.data });
  });
}
