// Regras de tela da seção "Retenções e Descontos" da OP (T11). Espelham as
// regras de lib/retencoes.ts pra tela nunca oferecer edição que o servidor
// vai ignorar — mas quem decide o valor gravado continua sendo o servidor.
import {
  aliquotaIrrfDaNatureza,
  ehExtraPercentual,
  ehTaxaExtra,
  CAMPOS_INFORMATIVOS,
  CAMPOS_TRIBUTARIOS,
  regraDaOp,
  type CampoDesconto,
  type CampoTributario,
} from "@/lib/retencoes";
import type { ConfigRetencaoCampoMapeado } from "@/lib/services/config-retencoes.service";
import { maskCurrency } from "@/lib/utils";
import { toCents } from "@/lib/money";
import { perfilDoElemento } from "@/lib/perfis-calculo";

export type CampoRetencao = CampoTributario | CampoDesconto;
export type Perfil = "ADMIN" | "GESTOR" | "CONSULTA";

export const CAMPO_FORM: Record<CampoRetencao, string> = {
  irrf: "irrf",
  iss: "iss",
  inss: "inss",
  patronal: "patronal",
  sest_senat: "sestSenat",
  outros: "outrosDescontos",
  taxa_bancaria: "taxaBancaria",
  taxa_pix: "taxaPix",
  iss_bs: "issBs",
};

export const CAMPOS_RETENCAO = Object.keys(CAMPO_FORM) as CampoRetencao[];

/** B12: as taxas criadas pelo ADMIN ("x_…") também são campos de retenção da tela. */
export function ehCampoRetencao(campo: string): campo is CampoRetencao {
  return campo in CAMPO_FORM || ehTaxaExtra(campo);
}

/** Nome do campo no formulário: o fixo (ex.: "sestSenat") ou o próprio "x_…". */
export const nomeFormDoCampo = (campo: string): string => (CAMPO_FORM as Record<string, string>)[campo] ?? campo;

const ROTULOS_TRIBUTARIOS: Record<string, string> = {
  irrf: "IRRF",
  iss: "ISS",
  inss: "INSS",
  patronal: "Patronal",
  sest_senat: "SEST/SENAT",
};

/**
 * B12: colunas da Matriz (e das exceções por subelemento): os 5 tributários
 * fixos + as taxas "x_" percentuais (ativas ou não — desativar não apaga a
 * Matriz delas).
 */
export function colunasDaMatriz(
  campos: Array<{ campo?: string; rotulo?: string; tipo?: string }> | null | undefined
): Array<{ campo: string; rotulo: string }> {
  const extras = (campos ?? [])
    .filter((c) => ehTaxaExtra(c.campo) && c.tipo === "PERCENTUAL")
    .map((c) => ({ campo: c.campo as string, rotulo: c.rotulo || (c.campo as string) }));
  return [...CAMPOS_TRIBUTARIOS.map((c) => ({ campo: c, rotulo: ROTULOS_TRIBUTARIOS[c] })), ...extras];
}

/** B12: taxas "x_" ativas da config, na ordem. */
export const camposExtrasDaConfig = (config: { campos: Array<Partial<ConfigRetencaoCampoMapeado>> } | null | undefined): string[] =>
  (config?.campos ?? [])
    .filter((c) => !!c.ativo && ehTaxaExtra(c.campo))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .map((c) => c.campo as string);

export interface RegraDaTela {
  /** Código cuja regra vale (subelemento com regra própria ou elemento). */
  codigo: string | null;
  /** Só a regra que vale, no formato que estadoCampo/estadoCampoOp esperam. */
  regras: Record<string, string[]>;
  origem: "subelemento" | "elemento";
}

/**
 * B7a: a regra de retenções que vale na tela — a mesma do servidor
 * (regraDaOp): o subelemento com regra própria substitui a do elemento.
 */
export function regraDaTela(
  config: { regras: Record<string, string[]>; regrasSubelemento?: Record<string, string[]> },
  elementoCodigo: string | null,
  subelementoCodigo: string | null | undefined
): RegraDaTela {
  const r = regraDaOp(elementoCodigo, subelementoCodigo, config.regras, config.regrasSubelemento);
  return { codigo: r.codigo, regras: r.codigo !== null && r.campos !== undefined ? { [r.codigo]: r.campos } : {}, origem: r.origem };
}

export interface EstadoCampo {
  editavel: boolean;
  obrigatorio: boolean;
  dica: string | null;
}

export function estadoCampo(
  cfg: ConfigRetencaoCampoMapeado,
  elementoCodigo: string | null,
  regras: Record<string, string[]>,
  perfil: Perfil
): EstadoCampo {
  const podeEditar = cfg.editavelOperador || perfil === "ADMIN";
  // B12: taxa "x_" percentual segue a Matriz, como um tributário.
  if (!(CAMPOS_TRIBUTARIOS as string[]).includes(cfg.campo) && !ehExtraPercentual(cfg)) {
    return { editavel: podeEditar, obrigatorio: false, dica: null };
  }

  const aplicaveis = elementoCodigo !== null ? regras[elementoCodigo] : undefined;
  if (aplicaveis === undefined) {
    return { editavel: podeEditar, obrigatorio: false, dica: null };
  }
  if (!aplicaveis.includes(cfg.campo)) {
    return { editavel: false, obrigatorio: false, dica: `Não se aplica a ${elementoCodigo}` };
  }

  const automatico = cfg.calculoAutomatico && cfg.tipo === "PERCENTUAL" && cfg.aliquota != null;
  if (automatico) {
    return { editavel: podeEditar, obrigatorio: false, dica: null };
  }
  return { editavel: true, obrigatorio: true, dica: "Sem cálculo automático: informe o valor" };
}

/**
 * Estado do campo considerando o credor MEI (T26): tributários isentos e
 * travados; só o ADMIN que confirmou a sobrescrita digita manualmente.
 */
export function estadoCampoOp(
  cfg: ConfigRetencaoCampoMapeado,
  elementoCodigo: string | null,
  regras: Record<string, string[]>,
  perfil: Perfil,
  mei: { credorMei: boolean; sobrescreverMei: boolean; credorSimples?: boolean } = { credorMei: false, sobrescreverMei: false }
): EstadoCampo {
  if (mei.credorMei && ((CAMPOS_TRIBUTARIOS as string[]).includes(cfg.campo) || ehExtraPercentual(cfg))) {
    const manual = mei.sobrescreverMei && perfil === "ADMIN";
    return { editavel: manual, obrigatorio: false, dica: manual ? "Valor manual (ADMIN, credor MEI)" : "Isento (MEI)" };
  }
  const estado = estadoCampo(cfg, elementoCodigo, regras, perfil);
  // B9: Simples Nacional não sofre retenção de IR (o motor zera o automático).
  if (mei.credorSimples && cfg.campo === "irrf" && !estado.dica) {
    return { ...estado, obrigatorio: false, dica: "Isento de IR (Simples Nacional)" };
  }
  return estado;
}

export function rotuloCampo(cfg: ConfigRetencaoCampoMapeado): string {
  if (cfg.tipo === "PERCENTUAL" && cfg.aliquota != null) {
    const aliquota = cfg.aliquota.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
    return `${cfg.rotulo} (${aliquota}%)`;
  }
  return cfg.rotulo;
}

// maskCurrency devolve "" pra zero, o que impediria informar R$ 0,00 de
// propósito (ex.: ISS digitado que não é devido). Digitar 0 vira "0,00";
// apagar a partir de zero limpa o campo.
export function mascararValorDigitado(bruto: string, apagando: boolean): string {
  const digitos = bruto.replace(/\D/g, "");
  if (!digitos) return "";
  if (parseInt(digitos, 10) === 0) return apagando ? "" : "0,00";
  return maskCurrency(bruto);
}

export function informadosEmCentavos(
  valores: Record<string, unknown>,
  camposInformados: string[]
): Partial<Record<CampoRetencao, number>> {
  const informados: Partial<Record<CampoRetencao, number>> = {};
  for (const campo of camposInformados) {
    if (ehCampoRetencao(campo)) {
      informados[campo] = toCents(valores[nomeFormDoCampo(campo)] as string | number | undefined);
    }
  }
  return informados;
}

/**
 * `excluir`: campos informativos, que não entram no total (ex.: patronal no
 * transporte). B12: soma também as taxas "x_" presentes nos valores.
 */
export function somarDescontosCents(valores: Record<string, unknown>, excluir: CampoRetencao[] = []): number {
  const fixos = CAMPOS_RETENCAO.filter((c) => !excluir.includes(c)).reduce(
    (total, campo) => total + toCents(valores[CAMPO_FORM[campo]] as string | number | undefined),
    0
  );
  const extras = Object.keys(valores ?? {})
    .filter((k) => ehTaxaExtra(k))
    .reduce((total, k) => total + toCents(valores[k] as string | number | undefined), 0);
  return fixos + extras;
}

/**
 * Campos só informativos (a patronal), fora do total e do líquido em TODOS os
 * elementos (R15/D15) — a mesma lista do motor (lib/retencoes.ts). O parâmetro
 * fica por compatibilidade com quem já chama passando o elemento.
 */
export const camposInformativos = (_elementoCodigo?: string | null): CampoRetencao[] => [...CAMPOS_INFORMATIVOS];

/**
 * No transporte os percentuais incidem sobre bases diferentes: rótulo sem "%".
 * Na pessoa física (B8) o IRRF é pela tabela progressiva, não um percentual.
 * Com natureza no subelemento (B9), o IRRF mostra a alíquota dela.
 */
export function rotuloCampoDoElemento(
  cfg: ConfigRetencaoCampoMapeado,
  elementoCodigo: string | null,
  subelementoCodigo: string | null = null,
  irrfSubelemento?: Record<string, number>
): string {
  const perfil = perfilDoElemento(elementoCodigo);
  if (perfil === "PESSOA_FISICA" && cfg.campo === "irrf") return `${cfg.rotulo} (tabela progressiva)`;
  if (perfil !== "TRANSPORTE_AUTONOMO") {
    const natureza = cfg.campo === "irrf" ? aliquotaIrrfDaNatureza(elementoCodigo, subelementoCodigo, irrfSubelemento) : undefined;
    return rotuloCampo(natureza !== undefined ? { ...cfg, aliquota: natureza } : cfg);
  }
  return cfg.campo === "patronal" ? `${cfg.rotulo} (informativa)` : cfg.rotulo;
}

// T35-A: um mesmo componente do formulário da OP pode servir a várias linhas
// (`credores.0`, `credores.1`…). Sem prefixo, tudo continua na raiz, como antes.
export function nomeNaLinha(basePath: string, nome: string): string {
  return basePath ? `${basePath}.${nome}` : nome;
}

/** Id de elemento único por linha; sem prefixo, o id de sempre. */
export function idNaLinha(basePath: string, id: string): string {
  return basePath ? `${id}-${basePath.replace(/[^A-Za-z0-9_-]/g, "-")}` : id;
}

/**
 * Campos que o operador digitou e que CONTINUAM editáveis. Um campo digitado
 * que deixou de ser editável (ex.: trocou a NE e o imposto não se aplica mais)
 * volta para o cálculo automático. Mesma regra no cálculo local e na prévia.
 */
export function informadosValidosDaLinha(
  camposInformados: string[],
  config: {
    campos: ConfigRetencaoCampoMapeado[] | Array<Partial<ConfigRetencaoCampoMapeado>>;
    regras: Record<string, string[]>;
    regrasSubelemento?: Record<string, string[]>;
  },
  elementoCodigo: string | null,
  perfil: Perfil,
  mei: { credorMei: boolean; sobrescreverMei: boolean },
  subelementoCodigo: string | null = null
): string[] {
  const configPorCampo = new Map((config.campos as ConfigRetencaoCampoMapeado[]).map((c) => [c.campo, c]));
  const regra = regraDaTela(config, elementoCodigo, subelementoCodigo);
  return camposInformados.filter((campo) => {
    const cfg = configPorCampo.get(campo);
    return !!cfg && cfg.ativo && estadoCampoOp(cfg, regra.codigo, regra.regras, perfil, mei).editavel;
  });
}

/**
 * Valores mascarados que o cálculo devolve para os campos NÃO digitados
 * (nome do campo no formulário → "15,00" ou "" se zero). Os digitados ficam
 * de fora: o valor do operador nunca é sobrescrito.
 */
export function valoresCalculadosDoForm(
  itensCents: Partial<Record<string, number>>,
  informadosValidos: string[],
  /** B12: taxas "x_" da config (para também limpar as que não vieram no cálculo). */
  extras: string[] = []
): Record<string, string> {
  const novos: Record<string, string> = {};
  const campos = [...CAMPOS_RETENCAO, ...new Set([...extras, ...Object.keys(itensCents).filter((k) => ehTaxaExtra(k))])];
  for (const campo of campos) {
    if (informadosValidos.includes(campo)) continue;
    const cents = itensCents[campo] ?? 0;
    novos[nomeFormDoCampo(campo)] = cents > 0 ? maskCurrency(cents / 100) : "";
  }
  return novos;
}
