import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { OrdemPagamentoService } from '@/lib/services/ordem-pagamento.service';

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const numeroNe = searchParams.get('numeroNe');
    const busca = searchParams.get('busca');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));

    const result = await OrdemPagamentoService.listar({ numeroNe, busca, page, limit });
    return NextResponse.json(result.data);
  });
}

export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();

    const body = await request.json();
    console.log('[POST OP] body recebido:', JSON.stringify(body, null, 2));
    
    const result = await OrdemPagamentoService.criar(body, user.id, user.perfil);

    if (!result.success) {
      // devolvendo o erro do jeito que veio pra mostrar na tela
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    
    return NextResponse.json({ success: true, ...result.data }, { status: result.status });
  });
}
