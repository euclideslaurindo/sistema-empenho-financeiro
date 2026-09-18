import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { isValidCpfCnpj } from '@/lib/utils';

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
      cep, logradouro, numero, bairro, pix, isMei
    } = body;

    if (!nome || !cpfCnpj) {
      return NextResponse.json({ error: 'Nome e CPF/CNPJ são obrigatórios.' }, { status: 400 });
    }

    if (!isValidCpfCnpj(cpfCnpj)) {
      return NextResponse.json({ error: 'CPF ou CNPJ inválido. Verifique os dígitos digitados.' }, { status: 400 });
    }

    // Verificar duplicidade de CPF/CNPJ (excluindo o próprio)
    const existing = await query<{id: string, nome: string}[]>(
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
      const userCheck = await query<{id: string}[]>('SELECT id FROM usuarios WHERE id = ?', [usuarioId]);
      if (!userCheck || userCheck.length === 0) usuarioId = null;
    } catch {
      usuarioId = null;
    }

    // Construção dinâmica do UPDATE para evitar erros de posição com 20+ parâmetros
    const enderecoFinal = endereco?.trim() || [logradouro, numero ? `Nº ${numero}` : '', bairro, cidade, uf].filter(Boolean).join(', ') || null;
    const dataExpFormatada = dataExpedicao && String(dataExpedicao).trim().length >= 8 ? String(dataExpedicao).trim() : null;

    const updateFields: Record<string, any> = {
      nome: nome.trim(),
      endereco: enderecoFinal,
      cpf_cnpj: cpfCnpj.trim(),
      pis: pis?.trim() || null,
      rg: rg?.trim() || 'ISENTO',
      orgao_emissor: orgaoEmissor?.trim() || null,
      data_expedicao: dataExpFormatada,
      cidade: cidade?.trim() || null,
      uf: uf?.trim() || null,
      telefone: telefone?.trim() || null,
      banco: banco?.trim() || null,
      agencia: agencia?.trim() || null,
      conta_corrente: contaCorrente?.trim() || null,
      cep: cep?.trim() || null,
      logradouro: logradouro?.trim() || null,
      numero: numero?.trim() || null,
      bairro: bairro?.trim() || null,
      pix: pix?.trim() || null,
      is_mei: isMei ? 1 : 0,
      usuario_id: usuarioId,
    };

    const setClauses = Object.keys(updateFields).map(col => `${col} = ?`).join(', ');
    const values = [...Object.values(updateFields), id];

    await query(
      `UPDATE credores SET ${setClauses} WHERE id = ? AND ativo = 1`,
      values
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API PUT /credores/[id]] Erro:', error);
    return NextResponse.json({ 
      error: 'Erro interno ao atualizar credor.',
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
    
    // Verificar se o credor existe
    const credorData = await query<{cpf_cnpj: string}[]>('SELECT cpf_cnpj FROM credores WHERE id = ? AND ativo = 1', [id]);

    if (!credorData || credorData.length === 0) {
      return NextResponse.json({ error: 'Credor não encontrado.' }, { status: 404 });
    }
    
    const cpfCnpj = credorData[0].cpf_cnpj;
    const opSum = await query<{total: number}[]>('SELECT COUNT(*) as total FROM ordens_pagamento WHERE credor_cpf_cnpj = ?', [cpfCnpj]);
    const totalOps = parseInt(opSum[0]?.total as any || 0);

    if (totalOps > 0) {
      return NextResponse.json(
        { error: `Não é possível excluir este credor pois existem ${totalOps} ordem(ns) de pagamento vinculada(s) a ele. O sistema necessita preservar o histórico.` },
        { status: 409 }
      );
    }

    // Soft delete: Apenas inativa o credor para preservar dados associados que possam existir (logs, etc.)
    await query('UPDATE credores SET ativo = 0 WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API DELETE /credores/[id]] Erro:', error);
    return NextResponse.json({ error: 'Erro ao desativar credor.' }, { status: 500 });
  }
}
