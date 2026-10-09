import { query, withTransaction } from '@/lib/db';
import type { PoolConnection } from 'mysql2/promise';
import { z } from 'zod';
import { fromCents, toCents } from '@/lib/money';
import { CAMPOS_TRIBUTARIOS, type CampoTributario } from '@/lib/retencoes';
import { obterConfigRetencoes, type ConfigRetencaoCampoMapeado } from '@/lib/services/config-retencoes.service';
import { rotuloMunicipio } from '@/lib/credor-endereco';

export type ServiceResult<T = any> =
  | { success: true; data: T; status?: number }
  | { success: false; error: string; status: number };

// ---------------------------------------------------------------------------
// Valor e competência (puros)
// ---------------------------------------------------------------------------

/** Campos tributários que compõem a DARF pela config vigente (seed: INSS, Patronal, SEST/SENAT — D4). */
export function entraDarfDaConfig(campos: ConfigRetencaoCampoMapeado[]): CampoTributario[] {
  return campos
    .filter((c) => c.ativo && c.entraDarf && (CAMPOS_TRIBUTARIOS as string[]).includes(c.campo))
    .map((c) => c.campo as CampoTributario);
}

export function calcularDarf(
  valores: Partial<Record<CampoTributario, number | string | null>>,
  entraDarf: CampoTributario[]
): { valorCents: number; detalhe: Record<string, number> } {
  const detalhe: Record<string, number> = {};
  let valorCents = 0;
  for (const campo of entraDarf) {
    const cents = toCents(valores[campo] ?? 0);
    detalhe[campo] = fromCents(cents);
    valorCents += cents;
  }
  return { valorCents, detalhe };
}

const hojeLocal = (agora: Date) => {
  const tz = agora.getTimezoneOffset() * 60000;
  return new Date(agora.getTime() - tz).toISOString().slice(0, 10);
};

/** D6: data de pagamento da OP, senão data de emissão, senão hoje → 'YYYY-MM'. */
export function competenciaDaOp(
  dataPagamento: string | null | undefined,
  dataEmissao: string | null | undefined,
  agora: Date = new Date()
): string {
  for (const d of [dataPagamento, dataEmissao]) {
    if (d && /^\d{4}-\d{2}/.test(String(d))) return String(d).slice(0, 7);
  }
  return hojeLocal(agora).slice(0, 7);
}

// ---------------------------------------------------------------------------
// Sincronização com a OP (sempre dentro da transação da OP)
// ---------------------------------------------------------------------------

export interface OpParaDarf {
  id: string;
  numeroNe: string;
  numeroOp: string | null;
  sub: string | null;
  credorCpfCnpj: string;
  credorNome: string | null;
  dataPagamento: string | null | undefined;
  dataEmissao: string | null | undefined;
  valores: Partial<Record<CampoTributario, number>>;
}

const ERRO_DARF_PAGA = 'DARF já paga: reabra o status antes de alterar a OP.';

/**
 * `manterValorExistente`: edição da OP sem recálculo de retenções (D12) não
 * recalcula a DARF já existente — se o admin mudou `entra_darf` depois, a DARF
 * criada antes continua com o valor da época; só competência/credor seguem a OP.
 */
export async function sincronizarDarfDaOp(
  conn: PoolConnection,
  op: OpParaDarf,
  opcoes: { entraDarf?: CampoTributario[]; manterValorExistente?: boolean } = {}
) {
  const competencia = competenciaDaOp(op.dataPagamento, op.dataEmissao);

  const [rows]: any = await conn.execute(
    'SELECT id, status, valor_darf, detalhe_json, competencia FROM darf_acompanhamento WHERE ordem_pagamento_id = ? FOR UPDATE',
    [op.id]
  );
  const atual = rows?.[0];

  let valorCents: number;
  let detalhe: Record<string, number>;
  if (atual && opcoes.manterValorExistente) {
    valorCents = toCents(atual.valor_darf);
    detalhe = typeof atual.detalhe_json === 'string' ? JSON.parse(atual.detalhe_json) : atual.detalhe_json ?? {};
  } else {
    const campos = opcoes.entraDarf ?? entraDarfDaConfig((await obterConfigRetencoes(conn)).campos);
    ({ valorCents, detalhe } = calcularDarf(op.valores, campos));
  }

  if (!atual) {
    if (valorCents <= 0) return;
    await conn.execute(
      `INSERT INTO darf_acompanhamento
         (id, ordem_pagamento_id, numero_ne, numero_op, sub, credor_cpf_cnpj, credor_nome, competencia, valor_darf, detalhe_json, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDENTE')`,
      [
        crypto.randomUUID(), op.id, op.numeroNe, op.numeroOp, op.sub, op.credorCpfCnpj, op.credorNome,
        competencia, fromCents(valorCents), JSON.stringify(detalhe),
      ]
    );
    return;
  }

  if (atual.status === 'PAGA') {
    // D13: DARF paga só aceita alteração da OP que não mexa nela.
    if (toCents(atual.valor_darf) !== valorCents || atual.competencia !== competencia) {
      throw { status: 409, error: ERRO_DARF_PAGA };
    }
    return;
  }

  if (valorCents <= 0) {
    await conn.execute('DELETE FROM darf_acompanhamento WHERE id = ?', [atual.id]);
    return;
  }

  await conn.execute(
    `UPDATE darf_acompanhamento
        SET numero_ne = ?, numero_op = ?, sub = ?, credor_cpf_cnpj = ?, credor_nome = ?,
            competencia = ?, valor_darf = ?, detalhe_json = ?
      WHERE id = ?`,
    [
      op.numeroNe, op.numeroOp, op.sub, op.credorCpfCnpj, op.credorNome,
      competencia, fromCents(valorCents), JSON.stringify(detalhe), atual.id,
    ]
  );
}

/** Chamar antes do DELETE da OP. */
export async function removerDarfDaOp(conn: PoolConnection, opId: string) {
  const [rows]: any = await conn.execute(
    'SELECT id, status FROM darf_acompanhamento WHERE ordem_pagamento_id = ? FOR UPDATE',
    [opId]
  );
  const atual = rows?.[0];
  if (!atual) return;
  if (atual.status === 'PAGA') {
    throw { status: 409, error: 'DARF já paga: reabra o status antes de excluir a OP.' };
  }
  await conn.execute('DELETE FROM darf_acompanhamento WHERE id = ?', [atual.id]);
}

// ---------------------------------------------------------------------------
// Consulta
// ---------------------------------------------------------------------------

export interface FiltrosDarf {
  competencia?: string | null;
  status?: 'PENDENTE' | 'PAGA' | null;
  busca?: string | null;
  page?: number;
  limit?: number;
  agrupar?: 'op' | 'credor';
}

const reais = (v: unknown) => fromCents(toCents(v as any));

export async function listarDarf(filtros: FiltrosDarf) {
  const { competencia, status, busca, page = 1, limit = 50, agrupar = 'op' } = filtros;
  const offset = (page - 1) * limit;

  const condicoes: string[] = [];
  const params: any[] = [];
  if (competencia) {
    condicoes.push('d.competencia = ?');
    params.push(competencia);
  }
  if (busca && busca.trim()) {
    const b = busca.trim();
    // Prefixo nos campos indexados (NE, CPF/CNPJ); nome do credor por trecho.
    condicoes.push('(d.numero_ne LIKE ? OR d.numero_op LIKE ? OR d.credor_cpf_cnpj LIKE ? OR d.credor_nome LIKE ?)');
    params.push(`${b}%`, `${b}%`, `${b}%`, `%${b}%`);
  }
  const whereSemStatus = condicoes.length ? ` WHERE ${condicoes.join(' AND ')}` : '';
  const condicoesComStatus = status ? [...condicoes, 'd.status = ?'] : condicoes;
  const paramsComStatus = status ? [...params, status] : params;
  const where = condicoesComStatus.length ? ` WHERE ${condicoesComStatus.join(' AND ')}` : '';
  // Município vem do cadastro (darf_acompanhamento não guarda); mesma
  // collation de ordens_pagamento.credor_cpf_cnpj, que já tem FK para credores.
  const joinCredor = ' LEFT JOIN credores c ON c.cpf_cnpj = d.credor_cpf_cnpj';

  let itens: any[];
  let total: number;
  if (agrupar === 'credor') {
    const [{ total: t } = { total: 0 }] = await query<any[]>(
      `SELECT COUNT(DISTINCT d.credor_cpf_cnpj) as total FROM darf_acompanhamento d${where}`,
      paramsComStatus
    );
    total = Number(t) || 0;
    const rows = await query<any[]>(
      `SELECT d.credor_cpf_cnpj as credorCpfCnpj, MAX(d.credor_nome) as credorNome,
              MAX(c.cidade) as cidade, MAX(c.uf) as uf,
              COUNT(*) as qtd, SUM(d.valor_darf) as total,
              SUM(CASE WHEN d.status = 'PENDENTE' THEN d.valor_darf ELSE 0 END) as totalPendente
         FROM darf_acompanhamento d${joinCredor}${where}
        GROUP BY d.credor_cpf_cnpj
        ORDER BY credorNome ASC
        LIMIT ? OFFSET ?`,
      [...paramsComStatus, limit, offset]
    );
    itens = rows.map(({ cidade, uf, ...r }) => ({
      ...r,
      municipio: rotuloMunicipio(cidade, uf),
      qtd: Number(r.qtd) || 0,
      total: reais(r.total),
      totalPendente: reais(r.totalPendente),
    }));
  } else {
    const [{ total: t } = { total: 0 }] = await query<any[]>(
      `SELECT COUNT(*) as total FROM darf_acompanhamento d${where}`,
      paramsComStatus
    );
    total = Number(t) || 0;
    const rows = await query<any[]>(
      `SELECT d.id, d.ordem_pagamento_id as ordemPagamentoId, d.numero_ne as numeroNe, d.numero_op as numeroOp, d.sub,
              d.credor_cpf_cnpj as credorCpfCnpj, d.credor_nome as credorNome, d.competencia,
              d.valor_darf as valorDarf, d.detalhe_json as detalhe, d.status,
              DATE_FORMAT(d.data_pagamento, '%Y-%m-%d') as dataPagamento, d.observacao, d.updated_at as atualizadoEm,
              c.cidade, c.uf
         FROM darf_acompanhamento d${joinCredor}${where}
        ORDER BY d.competencia DESC, d.numero_op DESC
        LIMIT ? OFFSET ?`,
      [...paramsComStatus, limit, offset]
    );
    itens = rows.map(({ cidade, uf, ...r }) => ({
      ...r,
      municipio: rotuloMunicipio(cidade, uf),
      valorDarf: reais(r.valorDarf),
    }));
  }

  const totaisRows = await query<any[]>(
    `SELECT d.status, COUNT(*) as qtd, COALESCE(SUM(d.valor_darf), 0) as valor, COUNT(DISTINCT d.credor_cpf_cnpj) as credores
       FROM darf_acompanhamento d${whereSemStatus}
      GROUP BY d.status`,
    params
  );
  const totalDe = (s: string) => {
    const r = totaisRows.find((x) => x.status === s);
    return { qtd: Number(r?.qtd) || 0, valor: reais(r?.valor ?? 0), credores: Number(r?.credores) || 0 };
  };

  return {
    success: true as const,
    data: {
      agrupar,
      itens,
      totais: { pendente: totalDe('PENDENTE'), paga: totalDe('PAGA') },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    },
  };
}

// ---------------------------------------------------------------------------
// Baixa (marcar como paga / reabrir), em lote e atômica
// ---------------------------------------------------------------------------

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export const alterarStatusDarfSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1, 'Selecione ao menos uma DARF.').max(500, 'Máximo de 500 DARFs por vez.'),
  status: z.enum(['PAGA', 'PENDENTE']),
  dataPagamento: z.string().regex(DATA_ISO, 'Data de pagamento inválida (use AAAA-MM-DD).').optional().nullable(),
  observacao: z.string().max(300, 'Observação com no máximo 300 caracteres.').optional().nullable(),
});

function dataValida(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return !isNaN(d.getTime()) && hojeLocal(d) === iso;
}

export async function alterarStatusDarf(
  body: unknown,
  usuarioId: string,
  perfil: string,
  agora: Date = new Date()
): Promise<ServiceResult<{ atualizadas: number }>> {
  if (perfil === 'CONSULTA') {
    return { success: false, error: 'Acesso negado. Perfil insuficiente para esta operacao.', status: 403 };
  }

  const { ids, status, dataPagamento, observacao } = alterarStatusDarfSchema.parse(body); // ZodError -> 400
  if (status === 'PAGA') {
    if (!dataPagamento) return { success: false, error: 'Informe a data de pagamento da DARF.', status: 400 };
    if (!dataValida(dataPagamento)) return { success: false, error: 'Data de pagamento inválida.', status: 400 };
    if (dataPagamento > hojeLocal(agora)) {
      return { success: false, error: 'A data de pagamento não pode ser futura.', status: 400 };
    }
  }

  const unicos = [...new Set(ids)];
  const marcadores = unicos.map(() => '?').join(',');

  try {
    await withTransaction(async (conn: PoolConnection) => {
      const [rows]: any = await conn.execute(
        `SELECT * FROM darf_acompanhamento WHERE id IN (${marcadores}) FOR UPDATE`,
        unicos
      );
      const encontrados = rows || [];
      if (encontrados.length !== unicos.length) {
        throw {
          status: 404,
          error: `${unicos.length - encontrados.length} DARF(s) não encontrada(s). Nenhuma foi alterada.`,
        };
      }

      const novaData = status === 'PAGA' ? dataPagamento : null;
      const sets = ['status = ?', 'data_pagamento = ?', 'atualizado_por = ?'];
      const valores: any[] = [status, novaData, usuarioId];
      if (observacao !== undefined) {
        sets.push('observacao = ?');
        valores.push(observacao?.trim() || null);
      }
      await conn.execute(
        `UPDATE darf_acompanhamento SET ${sets.join(', ')} WHERE id IN (${marcadores})`,
        [...valores, ...unicos]
      );

      for (const antes of encontrados) {
        const depois = {
          ...antes,
          status,
          data_pagamento: novaData,
          atualizado_por: usuarioId,
          ...(observacao !== undefined ? { observacao: observacao?.trim() || null } : {}),
        };
        await conn.execute(
          `INSERT INTO auditoria_financeira (id, entidade, entidade_id, acao, dados_anteriores, dados_novos, usuario_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [crypto.randomUUID(), 'darf_acompanhamento', antes.id, 'UPDATE', JSON.stringify(antes), JSON.stringify(depois), usuarioId]
        );
      }
    });
  } catch (error: any) {
    if (error.status && error.error) return { success: false, error: error.error, status: error.status };
    throw error;
  }

  return { success: true, data: { atualizadas: unicos.length } };
}
