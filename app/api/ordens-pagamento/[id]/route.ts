import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { OrdemPagamentoService } from '@/lib/services/ordem-pagamento.service';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();

    const { id } = await params;
    const body = await request.json();

    const result = await OrdemPagamentoService.atualizar(id, body, user.id, user.perfil);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true });
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();

    const { id } = await params;
    // Motivo da exclusão no corpo ({ motivo }); sem corpo, o serviço recusa.
    const body = await request.json().catch(() => ({}));
    const result = await OrdemPagamentoService.excluir(id, user.id, user.perfil, body?.motivo);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true });
  });
}
