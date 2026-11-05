// Motor único de cálculo de retenções (projeto Retenções v2, T10).
// Puro: sem acesso a banco/HTTP. O servidor (ordem-pagamento.service.ts) é
// quem busca config/regras do banco e chama calcularRetencoes com os dados
// já em mãos — isso é o que torna o resultado testável sem mock de SQL.
import { calcPercentCents } from "@/lib/money";
import { inssPessoaFisica, irrfPessoaFisica, type DadosPessoaFisica, type ResultadoIrrfPessoaFisica } from "@/lib/irrf-pessoa-fisica";
import type { ConfigRetencaoCampoMapeado } from "@/lib/services/config-retencoes.service";

export type CampoTributario = "irrf" | "iss" | "inss" | "patronal" | "sest_senat";
export type CampoDesconto = "outros" | "taxa_bancaria" | "taxa_pix";

export const CAMPOS_TRIBUTARIOS: CampoTributario[] = ["irrf", "iss", "inss", "patronal", "sest_senat"];
export const CAMPOS_DESCONTO: CampoDesconto[] = ["outros", "taxa_bancaria", "taxa_pix"];

/**
 * Campos só informativos (R15/D15): calculados, gravados e impressos, mas FORA
 * do total de descontos e do líquido — em todos os elementos. A patronal é o
 * INSS que o órgão paga; não sai do valor que o credor recebe.
 */
export const CAMPOS_INFORMATIVOS: CampoTributario[] = ["patronal"];
const ehInformativo = (campo: string) => (CAMPOS_INFORMATIVOS as string[]).includes(campo);

export interface EntradaCalculo {
  brutoCents: number;
  elementoCodigo: string | null;
  config: ConfigRetencaoCampoMapeado[];
  regras: Record<string, string[]>;
  /** B7a: código do subelemento da NE (ex.: "3.3.90.36.08"); null/ausente = sem subelemento. */
  subelementoCodigo?: string | null;
  /** B7a: regras próprias por subelemento (subelemento_retencoes); [] = nenhuma retenção. */
  regrasSubelemento?: Record<string, string[]>;
  // Partial de propósito: a AUSÊNCIA de uma chave significa "o operador não
  // tocou nesse campo", diferente de presente-com-zero. O chamador (serviço)
  // só deve incluir uma chave se o valor realmente veio do payload do
  // cliente — ver nota no plano da T10 sobre o contrato que a T11 precisa
  // respeitar (não mandar sempre os 8 campos com "" / 0).
  informados: Partial<Record<CampoTributario | CampoDesconto, number>>;
  perfil: "ADMIN" | "GESTOR" | "CONSULTA";
  /** Regra 0: credor MEI não sofre retenção (lido do cadastro no servidor). */
  credorMei?: boolean;
  /** T26: ADMIN confirmou reter mesmo sendo MEI — aceita só valores digitados, nada automático. */
  sobrescreverMei?: boolean;
  /**
   * B8: perfil PESSOA_FISICA (3.3.90.36) — INSS com teto e IRRF pela tabela
   * progressiva 2026, com parâmetros e faixas da vigência da OP. Ausente =
   * cálculo por percentual, como sempre.
   */
  pessoaFisica?: DadosPessoaFisica;
}

/** MEI: 0, ou o valor digitado se o ADMIN confirmou a sobrescrita (T26). */
export function valorTributarioMei(
  campo: string,
  ativo: boolean,
  informado: number | undefined,
  sobrescrever: boolean,
  brutoCents: number
): number {
  if (!sobrescrever || !ativo || informado === undefined) return 0;
  return validarInformado(campo, informado, brutoCents);
}

export const avisosMei = (credorMei: boolean, sobrescrever: boolean): string[] =>
  !credorMei
    ? []
    : sobrescrever
      ? ["Credor MEI: retenção aplicada manualmente pelo ADMIN."]
      : ["Credor MEI: isento de retenções."];

export interface RegraDaOp {
  /** Código cuja regra vale: o do subelemento (regra própria) ou o do elemento. */
  codigo: string | null;
  /** Campos tributários que se aplicam; undefined = elemento desconhecido. */
  campos: string[] | undefined;
  origem: "subelemento" | "elemento";
}

/**
 * B7a: qual regra de retenções vale para a OP. O subelemento com regra
 * própria substitui a do elemento (lista vazia = nenhuma retenção); sem
 * regra própria, vale a do elemento, como sempre. O subelemento só conta se
 * for mesmo do elemento da NE ("3.3.90.36.08" é do "3.3.90.36").
 * Pura: o servidor e a prévia da tela usam a mesma.
 */
export function regraDaOp(
  elementoCodigo: string | null,
  subelementoCodigo: string | null | undefined,
  regras: Record<string, string[]>,
  regrasSubelemento: Record<string, string[]> | undefined
): RegraDaOp {
  const propria =
    elementoCodigo && subelementoCodigo && subelementoCodigo.startsWith(`${elementoCodigo}.`)
      ? regrasSubelemento?.[subelementoCodigo]
      : undefined;
  if (propria !== undefined) return { codigo: subelementoCodigo as string, campos: propria, origem: "subelemento" };
  return { codigo: elementoCodigo, campos: elementoCodigo !== null ? regras[elementoCodigo] : undefined, origem: "elemento" };
}

export interface ResultadoCalculo {
  itens: Record<string, number>; // centavos, uma chave por um dos 8 campos
  totalDescontosCents: number;
  liquidoCents: number;
  avisos: string[];
  snapshot: Record<string, any>;
  /** Campos gravados só para informação, fora do total (ex.: patronal no transporte). */
  informativos?: string[];
}

export function validarInformado(campo: string, valor: number, brutoCents: number): number {
  if (!Number.isFinite(valor) || valor < 0 || valor > brutoCents) {
    throw { status: 422, error: `Valor informado para "${campo}" é inválido (deve estar entre 0 e o valor bruto).` };
  }
  return Math.round(valor);
}

export function calcularRetencoes(entrada: EntradaCalculo): ResultadoCalculo {
  const { brutoCents, elementoCodigo, config, regras, informados, perfil } = entrada;

  if (!Number.isInteger(brutoCents) || brutoCents < 0) {
    throw { status: 422, error: "Valor bruto inválido para cálculo de retenções." };
  }

  const avisos: string[] = [];
  const itens: Record<string, number> = {};
  const configPorCampo = new Map(config.map((c) => [c.campo, c]));
  const regra = regraDaOp(elementoCodigo, entrada.subelementoCodigo, regras, entrada.regrasSubelemento);
  const camposAplicaveis = regra.campos;
  const elementoDesconhecido = camposAplicaveis === undefined;
  const pf = entrada.pessoaFisica;
  // B8: o IRRF da PF deduz o INSS final da OP, então é calculado depois do laço.
  let irrfPfPendente = false;
  let detalheIrrfPf: ResultadoIrrfPessoaFisica | null = null;

  const sobrescreverMei = !!entrada.credorMei && !!entrada.sobrescreverMei && perfil === "ADMIN";
  if (entrada.credorMei) {
    avisos.push(...avisosMei(true, sobrescreverMei));
  } else if (elementoDesconhecido) {
    avisos.push("Elemento desconhecido: nenhuma retenção foi calculada automaticamente.");
  }

  for (const campo of CAMPOS_TRIBUTARIOS) {
    const cfg = configPorCampo.get(campo);
    // Regra 0: MEI zera os tributários (T26: ADMIN pode digitar, com confirmação).
    if (entrada.credorMei) {
      itens[campo] = valorTributarioMei(campo, !!cfg?.ativo, informados[campo], sobrescreverMei, brutoCents);
      continue;
    }
    if (!cfg || !cfg.ativo) {
      itens[campo] = 0;
      continue;
    }

    if (elementoDesconhecido) {
      // Regra 1: sem matriz pra consultar, nenhum cálculo automático — só
      // aceita valor digitado de quem tem permissão de editar esse campo.
      const podeEditar = cfg.editavelOperador || perfil === "ADMIN";
      const informado = informados[campo];
      if (podeEditar && informado !== undefined) {
        itens[campo] = validarInformado(campo, informado, brutoCents);
      } else {
        itens[campo] = 0;
        if (podeEditar) avisos.push(`Elemento desconhecido: informe "${campo}" manualmente se aplicável.`);
      }
      continue;
    }

    const aplica = (camposAplicaveis as string[]).includes(campo);
    if (!aplica) {
      itens[campo] = 0;
      continue;
    }

    let valor: number;
    if (cfg.calculoAutomatico && cfg.tipo === "PERCENTUAL" && cfg.aliquota != null) {
      if (pf && campo === "inss") valor = inssPessoaFisica(brutoCents, cfg.aliquota, pf.parametros);
      else if (pf && campo === "irrf") {
        valor = 0;
        irrfPfPendente = true;
      } else valor = calcPercentCents(brutoCents, cfg.aliquota);
      // Regra 3: só sobrescreve um cálculo automático se o campo for
      // editável pelo operador ou o perfil for ADMIN — nunca por um cliente
      // simplesmente mandar um número (é o bug que esta task corrige).
      const podeSobrescrever = cfg.editavelOperador || perfil === "ADMIN";
      const informado = informados[campo];
      if (podeSobrescrever && informado !== undefined) {
        valor = validarInformado(campo, informado, brutoCents);
        if (campo === "irrf") irrfPfPendente = false;
      }
    } else {
      // Não automático (ex.: ISS digitado, D1): qualquer perfil digita —
      // não existe cálculo automático aqui pra "sobrescrever".
      const informado = informados[campo];
      if (informado === undefined) {
        avisos.push(`"${campo}" não tem cálculo automático e nenhum valor foi informado; gravado como 0.`);
        valor = 0;
      } else {
        valor = validarInformado(campo, informado, brutoCents);
      }
    }

    itens[campo] = valor;
  }

  if (pf && irrfPfPendente) {
    // Dedução = máx(INSS retido na OP; desconto simplificado). INSS que não
    // se aplica (ou MEI/inativo) entra como 0.
    detalheIrrfPf = irrfPessoaFisica(brutoCents, itens.inss ?? 0, pf.parametros, pf.faixas);
    itens.irrf = detalheIrrfPf.irrfCents;
  }

  for (const campo of CAMPOS_DESCONTO) {
    const cfg = configPorCampo.get(campo);
    if (!cfg || !cfg.ativo) {
      itens[campo] = 0;
      continue;
    }
    const permitido = cfg.editavelOperador || perfil === "ADMIN";
    const informado = informados[campo];
    itens[campo] = permitido && informado !== undefined ? validarInformado(campo, informado, brutoCents) : 0;
  }

  const totalDescontosCents = Object.entries(itens)
    .filter(([campo]) => !ehInformativo(campo))
    .reduce((a, [, b]) => a + b, 0);
  if (totalDescontosCents > brutoCents) {
    throw { status: 422, error: "Total de descontos maior que o valor a pagar." };
  }

  // rotulo/ativo/aplica vão no snapshot pra impressão (T12) reproduzir a OP
  // como ela foi calculada, sem consultar a config atual.
  const tributarios = CAMPOS_TRIBUTARIOS as string[];
  const snapshot = {
    ...(pf
      ? {
          perfil: "PESSOA_FISICA",
          vigencia: pf.vigencia,
          vigencia_irrf: pf.vigenciaIrrf ?? null,
          ...(detalheIrrfPf
            ? {
                base_irrf: detalheIrrfPf.base,
                deducao_irrf: detalheIrrfPf.deducao,
                irrf_tabela: detalheIrrfPf.irrfTabela,
                redutor: detalheIrrfPf.redutor,
                isento_irrf: detalheIrrfPf.isento,
              }
            : {}),
        }
      : {}),
    elemento: elementoCodigo,
    subelemento: entrada.subelementoCodigo ?? null,
    origemRegra: regra.origem,
    regraCodigo: regra.codigo,
    ...(entrada.credorMei ? { mei: true } : {}),
    ...(sobrescreverMei ? { mei_sobrescrito: true } : {}),
    campos: Object.fromEntries(
      config.map((cfg) => [
        cfg.campo,
        {
          rotulo: cfg.rotulo,
          // B8: na PF o IRRF é pela tabela progressiva, não um percentual fixo.
          aliquota: pf && cfg.campo === "irrf" ? null : cfg.aliquota,
          automatico: cfg.calculoAutomatico,
          ativo: cfg.ativo,
          aplica:
            !tributarios.includes(cfg.campo) || elementoDesconhecido || (camposAplicaveis as string[]).includes(cfg.campo),
          valor: (itens[cfg.campo] ?? 0) / 100,
          ...(ehInformativo(cfg.campo) ? { informativo: true } : {}),
        },
      ])
    ),
    calculadoEm: new Date().toISOString(),
    regra: pf ? "pf-2026-v1" : "v1",
  };

  return {
    itens,
    totalDescontosCents,
    liquidoCents: brutoCents - totalDescontosCents,
    avisos,
    snapshot,
    informativos: [...CAMPOS_INFORMATIVOS],
  };
}
