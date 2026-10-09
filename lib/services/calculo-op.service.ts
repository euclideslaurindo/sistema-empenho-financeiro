import { query } from '@/lib/db';
import type { PoolConnection } from 'mysql2/promise';
import { calcularRetencoes, type CampoDesconto, type CampoTributario, type ResultadoCalculo } from '@/lib/retencoes';
import { calcularTransporteAutonomo } from '@/lib/retencoes-transporte';
import { perfilDoElemento, type PerfilCalculo } from '@/lib/perfis-calculo';
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
  e: EntradaCalculoOp
): Promise<ResultadoCalculoOp> {
  const { campos, regras } = await obterConfigRetencoes(conn);

  const sqlCredor = `SELECT cidade, uf, is_mei FROM credores
     WHERE cpf_cnpj = ? OR REPLACE(REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', ''), ' ', '') = ?
     LIMIT 1`;
  const paramsCredor = [e.credorCpfCnpj, String(e.credorCpfCnpj ?? '').replace(/\D/g, '')];
  const credores: any[] = conn ? ((await conn.execute(sqlCredor, paramsCredor))[0] as any[]) : await query<any[]>(sqlCredor, paramsCredor);
  const credor = credores?.[0];
  const credorMei = !!Number(credor?.is_mei);

  const perfilCalculo = perfilDoElemento(e.elementoCodigo);

  if (perfilCalculo === 'TRANSPORTE_AUTONOMO') {
    const data = dataReferenciaDaOp(e.dataPagamento, e.dataEmissao);
    const [{ parametros, vigencia }, { faixas, vigencia: vigenciaIrrf }, issMunicipio] = await Promise.all([
      obterParametrosVigentes(conn, perfilCalculo, data),
      obterFaixasIrrfVigentes(conn, data),
      obterIssMunicipio(conn, credor?.cidade),
    ]);
    const resultado = calcularTransporteAutonomo({
      brutoCents: e.brutoCents,
      elementoCodigo: e.elementoCodigo,
      vigencia,
      vigenciaIrrf,
      parametros,
      faixas,
      issMunicipio,
      municipioCredor: credor?.cidade ?? null,
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
