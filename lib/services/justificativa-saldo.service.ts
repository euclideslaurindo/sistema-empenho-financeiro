// Justificativa de sobra de recurso da NE (B13): leitura e gravação (uma
// por NE). O saldo é sempre o do servidor (valor da NE − soma das OPs).
import { query, withTransaction } from '@/lib/db';
import { z } from 'zod';
import { fromCents, toCents } from '@/lib/money';
import { obterSaldoNe } from '@/lib/services/saldo-ne';
import { MAX_TEXTO, montarJustificativa, validarJustificativa, type DadosJustificativa } from '@/lib/justificativa-saldo';

export type ServiceResult<T = any> =
  | { success: true; data: T; status?: number }
  | { success: false; error: string; status: number };

const semTabela = (e: any) => e?.code === 'ER_NO_SUCH_TABLE' || e?.errno === 1146;
const ERRO_SEM_TABELA = 'A tabela das justificativas ainda não existe. Rode a migration_26 no banco.';

export interface RespostaJustificativa {
  ne: { numero: string; exercicio: string | null; historico: string | null; status: string; valor: number };
  saldo: { valor: number; gasto: number; restante: number };
  /** Valores para o formulário: os salvos, senão os iniciais. */
  dados: DadosJustificativa;
  salva: null | { em: string; por: string | null; valorSaldoSalvo: number };
}

function lerMotivos(v: unknown): Array<{ codigo: string; texto: string }> {
  try {
    const lista = typeof v === 'string' ? JSON.parse(v) : v;
    return Array.isArray(lista)
      ? lista.filter((m) => m && typeof m === 'object').map((m: any) => ({ codigo: String(m.codigo ?? ''), texto: String(m.texto ?? '') }))
      : [];
  } catch {
    return [];
  }
}

async function buscarNe(numero: string) {
  const [ne] =
    (await query<any[]>('SELECT numero, exercicio, historico, status, valor FROM notas_empenho WHERE numero = ? LIMIT 1', [numero])) || [];
  return ne ?? null;
}

export async function obterJustificativa(numeroNe: string): Promise<ServiceResult<RespostaJustificativa>> {
  const ne = await buscarNe(numeroNe);
  if (!ne) return { success: false, error: `NE "${numeroNe}" não encontrada.`, status: 404 };
  const saldo = await obterSaldoNe((sql, params) => query<any[]>(sql, params), ne.numero);
  const restante = fromCents(saldo?.restanteCents ?? 0);

  let salva: any = null;
  try {
    [salva] = (await query<any[]>('SELECT * FROM justificativas_saldo WHERE numero_ne = ? LIMIT 1', [ne.numero])) || [];
  } catch (e) {
    if (!semTabela(e)) throw e;
  }
  let por: string | null = null;
  if (salva?.usuario_id) {
    const [u] = (await query<any[]>('SELECT nome FROM usuarios WHERE id = ? LIMIT 1', [salva.usuario_id])) || [];
    por = u?.nome ?? null;
  }

  const dados = montarJustificativa(
    { numero: ne.numero, exercicio: ne.exercicio, historico: ne.historico },
    restante,
    salva
      ? {
          exercicio: salva.exercicio ?? undefined,
          objeto: salva.objeto ?? '',
          valorAtualizado: Number(salva.valor_atualizado),
          motivos: lerMotivos(salva.motivos),
          outros: salva.outros ?? '',
          textoDevolucao: salva.texto_devolucao ?? undefined,
        }
      : null
  );

  return {
    success: true,
    data: {
      ne: { numero: ne.numero, exercicio: ne.exercicio ?? null, historico: ne.historico ?? null, status: ne.status, valor: Number(ne.valor) || 0 },
      saldo: { valor: fromCents(saldo?.valorCents ?? 0), gasto: fromCents(saldo?.gastoCents ?? 0), restante },
      dados,
      salva: salva
        ? { em: new Date(salva.updated_at ?? salva.created_at).toISOString(), por, valorSaldoSalvo: Number(salva.valor_saldo) }
        : null,
    },
  };
}

const texto = z.string().max(MAX_TEXTO).optional().default('');
export const justificativaSchema = z.object({
  exercicio: z.string().trim().max(10).optional(),
  objeto: texto,
  valorAtualizado: z.number(),
  motivos: z.array(z.object({ codigo: z.string().max(30), texto: z.string().max(MAX_TEXTO) })).max(10),
  outros: texto,
  textoDevolucao: texto,
});

/** GESTOR e ADMIN. O saldo gravado é o do servidor; o "atualizado" é o informado. */
export async function salvarJustificativa(
  numeroNe: string,
  body: unknown,
  usuarioId: string,
  perfil: string
): Promise<ServiceResult<{ numeroNe: string }>> {
  if (perfil !== 'ADMIN' && perfil !== 'GESTOR') {
    return { success: false, error: 'Acesso negado. Perfil insuficiente para esta operacao.', status: 403 };
  }
  const d = justificativaSchema.parse(body); // ZodError -> 400
  const erros = validarJustificativa(d);
  if (erros.length > 0) return { success: false, error: erros.join(' '), status: 400 };

  const ne = await buscarNe(numeroNe);
  if (!ne) return { success: false, error: `NE "${numeroNe}" não encontrada.`, status: 404 };
  if (ne.status === 'CANCELADO') return { success: false, error: `A NE "${ne.numero}" está CANCELADA.`, status: 409 };

  try {
    await withTransaction(async (conn) => {
      const exec = async (sql: string, params: any[]) => ((await conn.execute(sql, params))[0] as any[]) || [];
      const saldo = await obterSaldoNe(exec, ne.numero);
      const valorSaldo = fromCents(saldo?.restanteCents ?? 0);
      const [antes] = await exec('SELECT * FROM justificativas_saldo WHERE numero_ne = ? FOR UPDATE', [ne.numero]);
      const novo = {
        exercicio: d.exercicio || String(ne.exercicio ?? '').trim() || null,
        objeto: d.objeto.trim(),
        valor_saldo: valorSaldo,
        valor_atualizado: fromCents(toCents(d.valorAtualizado)),
        motivos: d.motivos.map((m) => ({ codigo: m.codigo, texto: m.texto.trim() })).filter((m) => m.texto),
        outros: d.outros.trim() || null,
        texto_devolucao: d.textoDevolucao.trim() || null,
      };
      await conn.execute(
        `INSERT INTO justificativas_saldo
           (id, numero_ne, exercicio, objeto, valor_saldo, valor_atualizado, motivos, outros, texto_devolucao, usuario_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE exercicio = VALUES(exercicio), objeto = VALUES(objeto), valor_saldo = VALUES(valor_saldo),
           valor_atualizado = VALUES(valor_atualizado), motivos = VALUES(motivos), outros = VALUES(outros),
           texto_devolucao = VALUES(texto_devolucao), usuario_id = VALUES(usuario_id)`,
        [
          antes?.id ?? crypto.randomUUID(), ne.numero, novo.exercicio, novo.objeto, novo.valor_saldo, novo.valor_atualizado,
          JSON.stringify(novo.motivos), novo.outros, novo.texto_devolucao, usuarioId,
        ]
      );
      await conn.execute(
        `INSERT INTO auditoria_financeira (id, entidade, entidade_id, acao, dados_anteriores, dados_novos, usuario_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(), 'justificativa_saldo', antes?.id ?? ne.numero, antes ? 'UPDATE' : 'CREATE',
          antes ? JSON.stringify({ ...antes, motivos: lerMotivos(antes.motivos) }) : null, JSON.stringify(novo), usuarioId,
        ]
      );
    });
  } catch (e: any) {
    if (semTabela(e)) return { success: false, error: ERRO_SEM_TABELA, status: 409 };
    if (e?.status && e?.error) return { success: false, error: e.error, status: e.status };
    throw e;
  }
  return { success: true, data: { numeroNe: ne.numero } };
}
