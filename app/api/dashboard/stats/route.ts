import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/dashboard/stats — estatísticas para o dashboard
export async function GET(request: NextRequest) {
  try {
    // Total de credores ativos
    const [credoresCount] = await query<any[]>(
      'SELECT COUNT(*) as total FROM credores WHERE ativo = 1'
    );

    // Credores do mês anterior (para calcular variação)
    const [credoresMesAnterior] = await query<any[]>(
      `SELECT COUNT(*) as total FROM credores 
       WHERE ativo = 1 AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );

    // NEs dos últimos 30 dias
    const [nesCount] = await query<any[]>(
      `SELECT COUNT(*) as total FROM notas_empenho
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND status != 'CANCELADO'`
    );

    // NEs do período anterior (30-60 dias) para calcular variação
    const [nesCountAnterior] = await query<any[]>(
      `SELECT COUNT(*) as total FROM notas_empenho
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY) 
         AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY) 
         AND status != 'CANCELADO'`
    );

    // Total a pagar: soma de NEs com status EMITIDO (pendentes de pagamento) menos OPs pagas
    const [pagamentosPendentes] = await query<any[]>(
      `SELECT COALESCE(SUM(ne.valor - COALESCE(op_sum.total_pago, 0)), 0) as total
       FROM notas_empenho ne
       LEFT JOIN (
         SELECT numero_ne, SUM(valor_pagamento) as total_pago
         FROM ordens_pagamento
         GROUP BY numero_ne
       ) op_sum ON op_sum.numero_ne = ne.numero
       WHERE ne.status = 'EMITIDO'`
    );

    // Total pago mês anterior para variação
    const [pagamentosMesAnterior] = await query<any[]>(
      `SELECT COALESCE(SUM(ne.valor - COALESCE(op_sum.total_pago, 0)), 0) as total
       FROM notas_empenho ne
       LEFT JOIN (
         SELECT numero_ne, SUM(valor_pagamento) as total_pago
         FROM ordens_pagamento
         WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY numero_ne
       ) op_sum ON op_sum.numero_ne = ne.numero
       WHERE ne.status = 'EMITIDO' 
         AND ne.created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );

    // Últimas 5 NEs com unidade gestora
    const ultimasNes = await query<any[]>(
      `SELECT numero, DATE_FORMAT(created_at, '%d/%m/%Y') as data,
              valor, status, unidade_orcamentaria as unidade
       FROM notas_empenho
       ORDER BY created_at DESC
       LIMIT 5`
    );

    // Atividades recentes (últimas ordens)
    const ultimasOrdens = await query<any[]>(
      `SELECT credor_nome as credorNome, valor_pagamento as valorPagamento,
              DATE_FORMAT(created_at, '%d/%m/%Y às %H:%i') as quando
       FROM ordens_pagamento
       ORDER BY created_at DESC
       LIMIT 3`
    );

    // Calcular variações percentuais reais
    const credoresAtual = credoresCount?.total || 0;
    const credoresAnterior = credoresMesAnterior?.total || 0;
    const credoresNovos = credoresAtual - credoresAnterior;
    const credoresVariacao = credoresAnterior > 0 
      ? Number(((credoresNovos / credoresAnterior) * 100).toFixed(1)) 
      : (credoresAtual > 0 ? 100 : 0);

    const nesAtual = nesCount?.total || 0;
    const nesAnterior = nesCountAnterior?.total || 0;
    const nesVariacao = nesAnterior > 0 
      ? Number((((nesAtual - nesAnterior) / nesAnterior) * 100).toFixed(1)) 
      : (nesAtual > 0 ? 100 : 0);

    const pagAtual = pagamentosPendentes?.total || 0;
    const pagAnterior = pagamentosMesAnterior?.total || 0;
    const pagVariacao = pagAnterior > 0 
      ? Number((((pagAtual - pagAnterior) / pagAnterior) * 100).toFixed(1)) 
      : 0;

    return NextResponse.json({
      credoresTotal: credoresAtual,
      credoresVariacao,
      nesUltimos30: nesAtual,
      nesVariacao,
      pagamentosPendentesTotal: pagAtual,
      pagamentosVariacao: pagVariacao,
      ultimasNes: ultimasNes || [],
      ultimasOrdens: ultimasOrdens || [],
    });
  } catch (error: any) {
    console.error('[API GET /dashboard/stats] Erro:', error);
    return NextResponse.json({ error: 'Erro ao buscar estatísticas.' }, { status: 500 });
  }
}
