import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/dashboard/stats — estatísticas para o dashboard
export async function GET(request: NextRequest) {
  try {
    const [credoresCount] = await query<any[]>(
      'SELECT COUNT(*) as total FROM credores WHERE ativo = 1'
    );

    const [nesCount] = await query<any[]>(
      `SELECT COUNT(*) as total FROM notas_empenho
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND status != 'CANCELADO'`
    );

    const [pagamentosPendentes] = await query<any[]>(
      `SELECT COALESCE(SUM(valor_pagamento), 0) as total
       FROM ordens_pagamento
       WHERE MONTH(data_pagamento) = MONTH(CURDATE()) AND YEAR(data_pagamento) = YEAR(CURDATE())`
    );

    // Últimas 5 NEs
    const ultimasNes = await query<any[]>(
      `SELECT numero, DATE_FORMAT(created_at, '%d/%m/%Y') as data,
              valor, status
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

    return NextResponse.json({
      credoresTotal: credoresCount?.total || 0,
      nesUltimos30: nesCount?.total || 0,
      pagamentosPendentesTotal: pagamentosPendentes?.total || 0,
      ultimasNes: ultimasNes || [],
      ultimasOrdens: ultimasOrdens || [],
    });
  } catch (error: any) {
    console.error('[API GET /dashboard/stats] Erro:', error);
    return NextResponse.json({ error: 'Erro ao buscar estatísticas.' }, { status: 500 });
  }
}
