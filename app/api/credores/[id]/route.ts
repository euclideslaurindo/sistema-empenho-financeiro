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
    const { 
      nome, endereco, cpfCnpj, pis, rg, orgaoEmissor, dataExpedicao, 
      banco, agencia, contaCorrente, telefone, cidade, uf,
      cep, logradouro, numero, bairro
    } = body;

    if (!nome || !cpfCnpj) {
      return NextResponse.json({ error: 'Nome e CPF/CNPJ são obrigatórios.' }, { status: 400 });
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

    let usuarioId: string | null = user.id;
    try {
      const userCheck: any = await query('SELECT id FROM usuarios WHERE id = ?', [usuarioId]);
      if (!userCheck || userCheck.length === 0) usuarioId = null;
    } catch {
      usuarioId = null;
    }

    const dataExpFormatada = dataExpedicao && String(dataExpedicao).trim().length >= 8 ? String(dataExpedicao).trim() : null;
    const enderecoFinal = endereco?.trim() || [logradouro, numero ? `Nº ${numero}` : '', bairro, cidade, uf].filter(Boolean).join(', ') || null;

    await query(
      `UPDATE credores SET nome = ?, endereco = ?, cpf_cnpj = ?, pis = ?, rg = ?, orgao_emissor = ?, data_expedicao = ?,
                           cidade = ?, uf = ?, telefone = ?, banco = ?, agencia = ?, conta_corrente = ?, 
                           cep = ?, logradouro = ?, numero = ?, bairro = ?, usuario_id = ?
       WHERE id = ? AND ativo = 1`,
      [nome.trim(), enderecoFinal, cpfCnpj.trim(), pis?.trim() || null, rg?.trim() || 'ISENTO', orgaoEmissor?.trim() || null, dataExpFormatada,
       cidade?.trim() || null, uf?.trim() || null, telefone?.trim() || null, 
       banco?.trim() || null, agencia?.trim() || null, contaCorrente?.trim() || null, 
       cep?.trim() || null, logradouro?.trim() || null, numero?.trim() || null, bairro?.trim() || null, usuarioId, id]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API PUT /credores/[id]] Erro:', error);
    return NextResponse.json({ 
      error: error.sqlMessage || error.message || 'Erro ao atualizar credor.',
      code: error.code 
    }, { status: 500 });
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
