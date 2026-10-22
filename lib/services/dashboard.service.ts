import { query } from '@/lib/db';

// Cache em memória — safe em instância única (standalone Next.js).
// 1 minuto (antes 5): depois de emitir uma OP, o painel não fica minutos
// com o valor antigo. O botão Atualizar da tela pede `fresco` e ignora o cache.
const CACHE_TTL_MS = 60 * 1000;
let statsCache: { data: any; expiresAt: number } | null = null;

export class DashboardService {
  static async obterEstatisticas({ fresco = false }: { fresco?: boolean } = {}) {
    if (!fresco && statsCache && Date.now() < statsCache.expiresAt) {
      return statsCache.data;
    }

    // Total de credores ativos
    const [credoresCount] = await query<{ total: number }[]>(
      'SELECT COUNT(*) as total FROM credores WHERE ativo = 1'
    );

    // Credores do mês anterior (para calcular variação)
    const [credoresMesAnterior] = await query<{ total: number }[]>(
      `SELECT COUNT(*) as total FROM credores
       WHERE ativo = 1 AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );

    // NEs dos últimos 30 dias
    const [nesCount] = await query<{ total: number }[]>(
      `SELECT COUNT(*) as total FROM notas_empenho
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND status != 'CANCELADO'`
    );

    // NEs do período anterior (30-60 dias) para calcular variação
    const [nesCountAnterior] = await query<{ total: number }[]>(
      `SELECT COUNT(*) as total FROM notas_empenho
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
         AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
         AND status != 'CANCELADO'`
    );

    // Total a pagar: saldo restante de NEs pendentes (EMITIDO ou PARCIALMENTE PAGO)
    const [pagamentosPendentes] = await query<{ total: number }[]>(
      `SELECT COALESCE(SUM(ne.valor - COALESCE(op_sum.total_pago, 0)), 0) as total
       FROM notas_empenho ne
       LEFT JOIN (
         SELECT numero_ne, SUM(valor_pagamento) as total_pago
         FROM ordens_pagamento
         GROUP BY numero_ne
       ) op_sum ON op_sum.numero_ne = ne.numero
       WHERE ne.status IN ('EMITIDO', 'PARCIALMENTE PAGO')`
    );

    // Total pago mês anterior para variação (mesmo critério histórico)
    const [pagamentosMesAnterior] = await query<{ total: number }[]>(
      `SELECT COALESCE(SUM(ne.valor - COALESCE(op_sum.total_pago, 0)), 0) as total
       FROM notas_empenho ne
       LEFT JOIN (
         SELECT numero_ne, SUM(valor_pagamento) as total_pago
         FROM ordens_pagamento
         WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY numero_ne
       ) op_sum ON op_sum.numero_ne = ne.numero
       WHERE ne.created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
         AND ne.status != 'CANCELADO'
         AND (ne.valor - COALESCE(op_sum.total_pago, 0)) > 0`
    );

    // Últimas 5 NEs com unidade gestora
    const ultimasNes = await query<Record<string, any>[]>(
      `SELECT ne.numero, DATE_FORMAT(ne.created_at, '%d/%m/%Y') as data,
              ne.valor, ne.status, COALESCE(u.nome, 'Sistema') as unidade
       FROM notas_empenho ne
       LEFT JOIN usuarios u ON ne.usuario_id = u.id
       ORDER BY ne.created_at DESC
       LIMIT 5`
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
    // Nota: diferente das duas métricas acima, se não há dado anterior a variação
    // fica 0 (não 100) — comportamento já existente, mantido de propósito.
    const pagVariacao = pagAnterior > 0
      ? Number((((pagAtual - pagAnterior) / pagAnterior) * 100).toFixed(1))
      : 0;

    const responseData = {
      credoresTotal: credoresAtual,
      credoresVariacao,
      nesUltimos30: nesAtual,
      nesVariacao,
      pagamentosPendentesTotal: pagAtual,
      pagamentosVariacao: pagVariacao,
      ultimasNes: ultimasNes || [],
      // Quando os números foram lidos do banco (a tela mostra "Atualizado às").
      atualizadoEm: new Date().toISOString(),
    };

    statsCache = { data: responseData, expiresAt: Date.now() + CACHE_TTL_MS };

    return responseData;
  }
}
