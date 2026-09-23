import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { NotasEmpenhoService } from '@/lib/services/notas-empenho.service';

// PUT /api/notas-empenho/[id] — atualiza a ne e ja checa o saldo
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();

    const { id } = await params;
    const body = await request.json();
    const result = await NotasEmpenhoService.atualizar(id, body, user.id);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true });
  });
}

// DELETE /api/notas-empenho/[id] — cancela a ne mas checa as ops antes
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();

    const { id } = await params;
    const result = await NotasEmpenhoService.cancelar(id);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true });
  });
}
