import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const rows = await query<any[]>('SELECT * FROM configuracoes_sistema WHERE id = 1');
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Configuracoes nao encontradas.' }, { status: 404 });
    }
    return NextResponse.json({ configuracoes: rows[0] });
  } catch (error) {
    console.error('[API GET /configuracoes] Erro:', error);
    return NextResponse.json({ error: 'Erro ao carregar configuracoes.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();

  // Apenas ADMIN pode alterar configuracoes globais
  if (user.perfil !== 'ADMIN') {
    return forbiddenResponse();
  }

  try {
    const data = await request.json();
    const {
      nome_completo, email_corporativo, unidade_padrao, gestao_padrao,
      auto_preencher_credor, notifica_email_empenho, exigir_2fa_op,
      alerta_integracao, aviso_manutencao
    } = data;

    await query(
      `UPDATE configuracoes_sistema SET
        nome_completo = ?, email_corporativo = ?, unidade_padrao = ?, gestao_padrao = ?,
        auto_preencher_credor = ?, notifica_email_empenho = ?, exigir_2fa_op = ?,
        alerta_integracao = ?, aviso_manutencao = ?
       WHERE id = 1`,
      [
        nome_completo?.trim() || '', email_corporativo?.trim() || '',
        unidade_padrao?.trim() || '', gestao_padrao?.trim() || '',
        auto_preencher_credor ? 1 : 0, notifica_email_empenho ? 1 : 0, exigir_2fa_op ? 1 : 0,
        alerta_integracao ? 1 : 0, aviso_manutencao ? 1 : 0
      ]
    );

    return NextResponse.json({ message: 'Configuracoes salvas com sucesso' });
  } catch (error) {
    console.error('[API PUT /configuracoes] Erro:', error);
    return NextResponse.json({ error: 'Erro ao salvar configuracoes.' }, { status: 500 });
  }
}
