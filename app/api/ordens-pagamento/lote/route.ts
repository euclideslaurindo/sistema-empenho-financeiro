import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { OrdemPagamentoLoteService } from '@/lib/services/ordem-pagamento-lote.service';

// Emissão em lote (T34-C): várias OPs da mesma NE, uma por credor, tudo ou nada.
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();
    if (user.perfil !== 'ADMIN' && user.perfil !== 'GESTOR') return forbiddenResponse();

    const body = await request.json();
    const result = await OrdemPagamentoLoteService.criarLote(body, user.id, user.perfil);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.data, { status: result.status ?? 201 });
  });
}
