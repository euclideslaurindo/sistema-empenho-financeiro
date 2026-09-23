import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { excluirUsuario, alterarStatusUsuario } from '@/lib/services/usuario.service';

// DELETE /api/usuarios/[id] - Deleta um usuário
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user || user.perfil !== 'ADMIN') return unauthorizedResponse();

  const { id: idToDel } = await params;

  try {
    const result = await excluirUsuario(idToDel, user.id);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[DELETE /api/usuarios/[id]] Erro:', error);
    return NextResponse.json({ error: 'Erro ao excluir usuário (verifique se ele já possui registros no sistema)' }, { status: 500 });
  }
}

// PUT /api/usuarios/[id] - Bloqueia/Desbloqueia usuário
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user || user.perfil !== 'ADMIN') return unauthorizedResponse();

  const { id: idToUpdate } = await params;

  try {
    const body = await request.json();
    const result = await alterarStatusUsuario(idToUpdate, user.id, !!body.ativo);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[PUT /api/usuarios/[id]] Erro:', error);
    return NextResponse.json({ error: 'Erro ao alterar status do usuário' }, { status: 500 });
  }
}
