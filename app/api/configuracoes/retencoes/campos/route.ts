import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { criarTaxaExtra } from '@/lib/services/config-retencoes.service';

// POST /api/configuracoes/retencoes/campos — o ADMIN cria uma taxa nova (B12).
// Editar/desativar segue pelo PUT de /api/configuracoes/retencoes.
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();
    if (user.perfil !== 'ADMIN') return forbiddenResponse();
    const result = await criarTaxaExtra(await request.json(), user.id, user.perfil);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true, campo: result.data }, { status: 201 });
  });
}
