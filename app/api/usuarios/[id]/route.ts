import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { UsuarioDB } from '@/lib/types/db';

// DELETE /api/usuarios/[id] - Deleta um usuário
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user || user.perfil !== 'ADMIN') return unauthorizedResponse();

  const { id: idToDel } = await params;
  
  if (user.id === idToDel) {
    return NextResponse.json({ error: 'Você não pode excluir seu próprio usuário' }, { status: 400 });
  }

  // Trava de Deleção do Root Admin
  if (idToDel === 'user-admin-1') {
    return NextResponse.json({ error: 'Acesso Negado: O usuário administrador raiz não pode ser excluído do sistema.' }, { status: 403 });
  }

  try {
    // verifica se o user existe
    const [existing] = await query<UsuarioDB[]>('SELECT id FROM usuarios WHERE id = ?', [idToDel]);
    if (!existing) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // Trava de Deleção: Verificar histórico de Ordens de Pagamento
    const transacoes = await query<{id: string}[]>('SELECT id FROM ordens_pagamento WHERE usuario_id = ? LIMIT 1', [idToDel]);
    if (transacoes && transacoes.length > 0) {
      return NextResponse.json(
        { error: 'Não é possível excluir: Este usuário possui Ordens de Pagamento vinculadas. Utilize a função "Bloquear" para preservar o histórico.' },
        { status: 409 }
      );
    }

    // Nao pode excluir admin root, ex id fixo admin-123
    // Como segurança adicional
    await query('DELETE FROM usuarios WHERE id = ?', [idToDel]);
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
  
  if (user.id === idToUpdate) {
    return NextResponse.json({ error: 'Você não pode alterar seu próprio status' }, { status: 400 });
  }

  // Trava de Desativação do Root Admin
  if (idToUpdate === 'user-admin-1') {
    return NextResponse.json({ error: 'Acesso Negado: O usuário administrador raiz não pode ser alterado ou bloqueado.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const ativo = body.ativo ? 1 : 0;

    await query('UPDATE usuarios SET ativo = ? WHERE id = ?', [ativo, idToUpdate]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[PUT /api/usuarios/[id]] Erro:', error);
    return NextResponse.json({ error: 'Erro ao alterar status do usuário' }, { status: 500 });
  }
}
