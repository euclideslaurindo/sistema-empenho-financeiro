import { query } from '@/lib/db';
import type { PoolConnection } from 'mysql2/promise';
import { calcularRetencoes, type CampoDesconto, type CampoTributario, type ResultadoCalculo } from '@/lib/retencoes';
import { calcularTransporteAutonomo } from '@/lib/retencoes-transporte';
import { normalizarMunicipio, perfilDoElemento, type PerfilCalculo } from '@/lib/perfis-calculo';
import { obterConfigRetencoes, type ConfigRetencaoCampoMapeado } from '@/lib/services/config-retencoes.service';
import {
  dataReferenciaDaOp,
  obterFaixasIrrfVigentes,
  obterIssMunicipio,
  obterParametrosVigentes,
} from '@/lib/services/parametros-calculo.service';

export interface EntradaCalculoOp {
  brutoCents: number;
  elementoCodigo: string | null;
  credorCpfCnpj: string;
  dataPagamento?: string | null;
  dataEmissao?: string | null;
  informados: Partial<Record<CampoTributario | CampoDesconto, number>>;
  perfilUsuario: 'ADMIN' | 'GESTOR' | 'CONSULTA';
  /** T26: ADMIN confirmou reter mesmo com credor MEI (os motores ignoram para outros perfis). */
  sobrescreverMei?: boolean;
}

/**
 * Cache por requisição (T34-C): no lote, config, parâmetros/faixas por data,
 * ISS por município e o credor são lidos uma vez, não uma vez por OP. Guarda
 * a promessa (inclusive a recusa: o 422 de vigência vale para a mesma data).
 * Nunca compartilhar entre requisições — a config pode mudar.
 */
export interface CacheCalculo {
  memo<T>(chave: string, carregar: () => Promise<T>): Promise<T>;
}

export function criarCacheCalculo(): CacheCalculo {
  const promessas = new Map<string, Promise<unknown>>();
  return {
    memo<T>(chave: string, carregar: () => Promise<T>): Promise<T> {
      if (!promessas.has(chave)) promessas.set(chave, carregar());
      return promessas.get(chave) as Promise<T>;
    },
  };
}

const semCache: CacheCalculo = { memo: (_chave, carregar) => carregar() };

export interface ResultadoCalculoOp {
  resultado: ResultadoCalculo;
  configCampos: ConfigRetencaoCampoMapeado[];
  perfilCalculo: PerfilCalculo;
}

/**
 * Um só caminho para salvar a OP e para a prévia do formulário: lê a config,
 * o credor (município e MEI) e, no 3.3.90.33, os parâmetros do transporte
 * pela vigência da OP. Com `conn`, roda dentro da transação da OP.
 */
export async function calcularRetencoesDaOp(
  conn: PoolConnection | undefined,
  e: EntradaCalculoOp,
  cache: CacheCalculo = semCache
): Promise<ResultadoCalculoOp> {
  const { campos, regras } = await cache.memo('config', () => obterConfigRetencoes(conn));

  // T33: no 3.3.90.33 a taxa de expediente vem só do Município (Expediente);
  // a `cidade` do endereço não entra no cálculo. Credor inativo é ignorado
  // (o cadastro não deixa desativar credor que já tem OP).
  const sqlCredor = `SELECT municipioExpediente, is_mei FROM credores
     WHERE ativo = 1
       AND (cpf_cnpj = ? OR REPLACE(REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', ''), ' ', '') = ?)
     LIMIT 1`;
  const paramsCredor = [e.credorCpfCnpj, String(e.credorCpfCnpj ?? '').replace(/\D/g, '')];
  const credores: any[] = await cache.memo(`credor|${paramsCredor[1] || paramsCredor[0]}`, async () =>
    conn ? ((await conn.execute(sqlCredor, paramsCredor))[0] as any[]) : await query<any[]>(sqlCredor, paramsCredor)
  );
  const credor = credores?.[0];
  const credorMei = !!Number(credor?.is_mei);

  const perfilCalculo = perfilDoElemento(e.elementoCodigo);

  if (perfilCalculo === 'TRANSPORTE_AUTONOMO') {
    const data = dataReferenciaDaOp(e.dataPagamento, e.dataEmissao);
    const [{ parametros, vigencia }, { faixas, vigencia: vigenciaIrrf }, issMunicipio] = await Promise.all([
      cache.memo(`parametros|${perfilCalculo}|${data}`, () => obterParametrosVigentes(conn, perfilCalculo, data)),
      cache.memo(`irrf|${data}`, () => obterFaixasIrrfVigentes(conn, data)),
      cache.memo(`iss|${normalizarMunicipio(credor?.municipioExpediente)}`, () => obterIssMunicipio(conn, credor?.municipioExpediente)),
    ]);
    const resultado = calcularTransporteAutonomo({
      brutoCents: e.brutoCents,
      elementoCodigo: e.elementoCodigo,
      vigencia,
      vigenciaIrrf,
      parametros,
      faixas,
      issMunicipio,
      municipioCredor: credor?.municipioExpediente ?? null,
      credorMei,
      sobrescreverMei: e.sobrescreverMei,
      config: campos,
      informados: e.informados,
      perfil: e.perfilUsuario,
    });
    return { resultado, configCampos: campos, perfilCalculo };
  }

  const resultado = calcularRetencoes({
    brutoCents: e.brutoCents,
    elementoCodigo: e.elementoCodigo,
    config: campos,
    regras,
    informados: e.informados,
    perfil: e.perfilUsuario,
    credorMei,
    sobrescreverMei: e.sobrescreverMei,
  });
  return { resultado, configCampos: campos, perfilCalculo };
}
