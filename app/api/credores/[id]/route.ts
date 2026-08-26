import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';

// PUT /api/credores/[id] — atualiza credor
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const { id } = await params;
    const body = await request.json();
    const { nome, endereco, cpfCnpj, pis, rg, dataExpedicao, banco, agencia, contaCorrente, tipoChavePix, chavePix } = body;

    if (!nome || !cpfCnpj || !rg) {
      return NextResponse.json({ error: 'Nome, CPF/CNPJ e RG são obrigatórios.' }, { status: 400 });
    }

    // Verificar duplicidade de CPF/CNPJ (excluindo o próprio)
    const existing = await query<any[]>(
      'SELECT id, nome FROM credores WHERE cpf_cnpj = ? AND id != ? AND ativo = 1',
      [cpfCnpj, id]
    );
    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: `CPF/CNPJ já cadastrado para o credor "${existing[0].nome}".` },
        { status: 409 }
      );
    }

    const expedicao = dataExpedicao || null;

    await query(
      `UPDATE credores SET nome = ?, endereco = ?, cpf_cnpj = ?, pis = ?, rg = ?, data_expedicao = ?
       WHERE id = ? AND ativo = 1`,
      [nome.trim(), endereco?.trim() || '', cpfCnpj.trim(), pis?.trim() || '', rg.trim(), expedicao, id]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API PUT /credores/[id]] Erro:', error);
    return NextResponse.json({ error: 'Erro ao atualizar credor.' }, { status: 500 });
  }
}

// DELETE /api/credores/[id] — desativa credor (soft delete)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();

  // Exemplo de RBAC: Apenas ADMIN ou GESTOR podem deletar credores
  if (user.perfil === 'CONSULTA') {
    return forbiddenResponse();
  }

  try {
    const { id } = await params;
    
    // Verificar se o credor tem ordens de pagamento vinculadas
    const credorData = await query<any[]>('SELECT cpf_cnpj FROM credores WHERE id = ?', [id]);
    
    if (credorData && credorData.length > 0) {
      const cpfCnpj = credorData[0].cpf_cnpj;
      const opSum = await query<any[]>('SELECT COUNT(*) as total FROM ordens_pagamento WHERE credor_cpf_cnpj = ?', [cpfCnpj]);
      const totalOps = parseInt(opSum[0]?.total || 0);

      if (totalOps > 0) {
        return NextResponse.json(
          { error: `Não é possível excluir este credor pois existem ${totalOps} ordem(ns) de pagamento vinculada(s) a ele.` },
          { status: 409 }
        );
      }
    }

    await query('UPDATE credores SET ativo = 0 WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API DELETE /credores/[id]] Erro:', error);
    return NextResponse.json({ error: 'Erro ao excluir credor.' }, { status: 500 });
  }
}
