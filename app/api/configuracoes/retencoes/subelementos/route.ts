import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { salvarRegraSubelemento } from '@/lib/services/config-retencoes.service';

// PUT /api/configuracoes/retencoes/subelementos — regra própria de um
// subelemento (B7a). Só o administrador. A leitura vem junto do GET de
// /api/configuracoes/retencoes (regrasSubelemento).
export async function PUT(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();
    if (user.perfil !== 'ADMIN') return forbiddenResponse();
    const result = await salvarRegraSubelemento(await request.json(), user.id, user.perfil);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, ...result.data });
  });
}
