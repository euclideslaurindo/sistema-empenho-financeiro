import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { OrdemPagamentoLoteService } from '@/lib/services/ordem-pagamento-lote.service';

// Prévia das retenções de várias linhas da emissão (T34-C, D43), sem gravar.
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();
    if (user.perfil !== 'ADMIN' && user.perfil !== 'GESTOR') return forbiddenResponse();

    const body = await request.json();
    const result = await OrdemPagamentoLoteService.previaLote(body, user.perfil);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
  });
}
