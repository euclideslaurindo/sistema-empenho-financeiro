import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { SubelementoService } from '@/lib/services/elemento.service';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();
    if (user.perfil !== 'ADMIN') return forbiddenResponse();

    const { codigo } = await params;
    const body = await request.json();
    const result = await SubelementoService.atualizar(codigo, body, user.id);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true });
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();
    if (user.perfil !== 'ADMIN') return forbiddenResponse();

    const { codigo } = await params;
    const result = await SubelementoService.excluir(codigo, user.id);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true });
  });
}
