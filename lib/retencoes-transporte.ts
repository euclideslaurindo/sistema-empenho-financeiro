// Cálculo do perfil TRANSPORTE_AUTONOMO (elemento 3.3.90.33), igual à
// planilha EJA Campo (T25). Puro: quem busca parâmetros, faixas e município
// por vigência é o serviço (parametros-calculo.service.ts).
//
// Aritmética exata: decimal em BigInt com 12 casas; nenhum passo
// intermediário é arredondado — só os itens finais, para centavos (meio
// para cima, regra da T01).
import {
  avisosMei,
  CAMPOS_DESCONTO,
  CAMPOS_TRIBUTARIOS,
  validarInformado,
  valorTributarioMei,
  type CampoDesconto,
  type CampoTributario,
  type ResultadoCalculo,
} from "@/lib/retencoes";
import type { ConfigRetencaoCampoMapeado } from "@/lib/services/config-retencoes.service";

// ---------------------------------------------------------------------------
// Decimal exato
// ---------------------------------------------------------------------------
const CASAS = 12;
const ESCALA = 10n ** BigInt(CASAS);
type Dec = bigint;

/** Lê o número como texto (ex.: "978.620000" do DECIMAL do MySQL), sem float. */
export function dec(valor: string | number): Dec {
  const s = typeof valor === "number" ? valor.toString() : String(valor).trim();
  if (!/^-?\d+(\.\d+)?(e-?\d+)?$/i.test(s)) throw new RangeError(`Número inválido: "${valor}"`);
  if (/e/i.test(s)) return dec(Number(s).toFixed(CASAS));
  const negativo = s.startsWith("-");
  const [inteiro, fracao = ""] = s.replace("-", "").split(".");
  const v = BigInt(inteiro) * ESCALA + BigInt((fracao + "0".repeat(CASAS)).slice(0, CASAS));
  return negativo ? -v : v;
}

const deCentavos = (c: number): Dec => BigInt(c) * (ESCALA / 100n);
const mul = (a: Dec, b: Dec): Dec => (a * b) / ESCALA;
const pct = (a: Dec, p: Dec): Dec => mul(a, p) / 100n;
const maior = (a: Dec, b: Dec): Dec => (a > b ? a : b);

/** Arredonda para centavos, meio para cima (valores negativos viram 0). */
function paraCentavos(v: Dec): number {
  if (v <= 0n) return 0;
  const metade = ESCALA / 200n;
  return Number((v + metade) / (ESCALA / 100n));
}

/** Para o snapshot: número com até 6 casas, sem arredondar para centavos. */
function paraNumero(v: Dec): number {
  const negativo = v < 0n;
  const abs = negativo ? -v : v;
  const inteiro = abs / ESCALA;
  const fracao = (abs % ESCALA).toString().padStart(CASAS, "0").slice(0, 6);
  return Number(`${negativo ? "-" : ""}${inteiro}.${fracao}`);
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------
export const CHAVES_TRANSPORTE = [
  "base_percentual",
  "inss_percentual",
  "patronal_percentual",
  "sest_percentual",
  "senat_percentual",
  "irrf_tributavel_percentual",
  "desconto_simplificado",
  "redutor_constante",
  "redutor_coeficiente",
] as const;

export type ParametrosTransporte = Record<(typeof CHAVES_TRANSPORTE)[number], string | number>;

export interface FaixaIrrf {
  ordem: number;
  limiteAte: string | number | null; // null = última faixa
  aliquota: string | number; // 7.5 = 7,5%
  parcelaDeduzir: string | number;
}

export interface IssMunicipio {
  nome: string;
  aliquota: string | number;
  taxaExpediente: string | number;
}

export interface EntradaTransporte {
  brutoCents: number;
  elementoCodigo: string | null;
  vigencia: string; // 'YYYY-MM-DD' de onde vieram parâmetros/faixas
  parametros: ParametrosTransporte;
  faixas: FaixaIrrf[];
  issMunicipio: IssMunicipio | null; // null = município sem cadastro
  municipioCredor: string | null;
  credorMei: boolean;
  /** T26: ADMIN confirmou reter mesmo sendo MEI (só valores digitados). */
  sobrescreverMei?: boolean;
  config: ConfigRetencaoCampoMapeado[];
  informados: Partial<Record<CampoTributario | CampoDesconto, number>>;
  perfil: "ADMIN" | "GESTOR" | "CONSULTA";
}

const ISS_ALIQUOTA_PADRAO = "5";

export function calcularTransporteAutonomo(e: EntradaTransporte): ResultadoCalculo {
  if (!Number.isInteger(e.brutoCents) || e.brutoCents < 0) {
    throw { status: 422, error: "Valor bruto inválido para cálculo de retenções." };
  }
  const p = Object.fromEntries(Object.entries(e.parametros).map(([k, v]) => [k, dec(v)])) as Record<
    (typeof CHAVES_TRANSPORTE)[number],
    Dec
  >;
  const bruto = deCentavos(e.brutoCents);
  const avisos: string[] = [];

  // 1-4: base do INSS e contribuições (sem arredondar)
  const baseInss = pct(bruto, p.base_percentual);
  const inss = pct(baseInss, p.inss_percentual);
  const patronal = pct(baseInss, p.patronal_percentual);
  const sest = pct(baseInss, p.sest_percentual);
  const senat = pct(baseInss, p.senat_percentual);

  // 5-9: IRRF
  const descSimplificado = maior(p.desconto_simplificado, inss);
  const baseIrrf = pct(bruto, p.irrf_tributavel_percentual) - descSimplificado;
  const faixas = [...e.faixas].sort((a, b) => a.ordem - b.ordem);
  const faixa = faixas.find((f) => f.limiteAte === null || baseIrrf <= dec(f.limiteAte)) ?? faixas[faixas.length - 1];
  const irrfTabela = baseIrrf > 0n && faixa ? maior(0n, pct(baseIrrf, dec(faixa.aliquota)) - dec(faixa.parcelaDeduzir)) : 0n;
  // D22: o redutor usa o BRUTO, como a planilha.
  const descAdicional = maior(0n, p.redutor_constante - mul(p.redutor_coeficiente, bruto));
  const irrf = maior(0n, irrfTabela - descAdicional);

  // 10: ISS do município + taxa de expediente da prefeitura
  if (!e.issMunicipio) avisos.push("Município sem cadastro de ISS: usada a alíquota padrão (5%) sem taxa de expediente.");
  const issAliquota = dec(e.issMunicipio?.aliquota ?? ISS_ALIQUOTA_PADRAO);
  const taxaExpediente = dec(e.issMunicipio?.taxaExpediente ?? 0);
  const iss = pct(bruto, issAliquota) + taxaExpediente;

  // Só agora arredonda cada item.
  const sestCents = paraCentavos(sest);
  const senatCents = paraCentavos(senat);
  const calculado: Record<CampoTributario, number> = {
    irrf: paraCentavos(irrf),
    iss: paraCentavos(iss),
    inss: paraCentavos(inss),
    patronal: paraCentavos(patronal),
    sest_senat: sestCents + senatCents, // a OP tem uma coluna só
  };

  const configPorCampo = new Map(e.config.map((c) => [c.campo, c]));
  const itens: Record<string, number> = {};

  const sobrescreverMei = e.credorMei && !!e.sobrescreverMei && e.perfil === "ADMIN";
  avisos.push(...avisosMei(e.credorMei, sobrescreverMei));
  for (const campo of CAMPOS_TRIBUTARIOS) {
    const cfg = configPorCampo.get(campo);
    if (e.credorMei) {
      itens[campo] = valorTributarioMei(campo, !!cfg?.ativo, e.informados[campo], sobrescreverMei, e.brutoCents);
      continue;
    }
    if (cfg && !cfg.ativo) {
      itens[campo] = 0;
      continue;
    }
    let valor = calculado[campo];
    const podeSobrescrever = !!cfg && (cfg.editavelOperador || e.perfil === "ADMIN");
    const informado = e.informados[campo];
    if (podeSobrescrever && informado !== undefined) valor = validarInformado(campo, informado, e.brutoCents);
    itens[campo] = valor;
  }
  for (const campo of CAMPOS_DESCONTO) {
    const cfg = configPorCampo.get(campo);
    if (!cfg || !cfg.ativo) {
      itens[campo] = 0;
      continue;
    }
    const permitido = cfg.editavelOperador || e.perfil === "ADMIN";
    const informado = e.informados[campo];
    itens[campo] = permitido && informado !== undefined ? validarInformado(campo, informado, e.brutoCents) : 0;
  }

  // 11-12: patronal é informativa — fora do total e do líquido.
  const informativos = ["patronal"];
  const totalDescontosCents = Object.entries(itens)
    .filter(([campo]) => !informativos.includes(campo))
    .reduce((t, [, v]) => t + v, 0);
  if (totalDescontosCents > e.brutoCents) {
    throw { status: 422, error: "Total de descontos maior que o valor a pagar." };
  }

  const rotulo = (cfg: ConfigRetencaoCampoMapeado) => (cfg.campo === "patronal" ? `${cfg.rotulo} (informativa)` : cfg.rotulo);
  const snapshot = {
    perfil: "TRANSPORTE_AUTONOMO",
    elemento: e.elementoCodigo,
    vigencia: e.vigencia,
    mei: e.credorMei,
    ...(sobrescreverMei ? { mei_sobrescrito: true } : {}),
    base_inss: paraNumero(baseInss),
    base_irrf: paraNumero(baseIrrf),
    desc_simplificado: paraNumero(descSimplificado),
    irrf_tabela: paraNumero(irrfTabela),
    desc_adicional: paraNumero(descAdicional),
    iss_aliquota: paraNumero(issAliquota),
    taxa_expediente: paraNumero(taxaExpediente),
    municipio: e.issMunicipio?.nome ?? e.municipioCredor ?? null,
    municipio_cadastrado: !!e.issMunicipio,
    sest: e.credorMei ? 0 : sestCents / 100,
    senat: e.credorMei ? 0 : senatCents / 100,
    // Sem alíquota nos rótulos: no transporte os percentuais incidem sobre bases diferentes.
    campos: Object.fromEntries(
      e.config.map((cfg) => [
        cfg.campo,
        {
          rotulo: rotulo(cfg),
          aliquota: null,
          automatico: (CAMPOS_TRIBUTARIOS as string[]).includes(cfg.campo),
          ativo: cfg.ativo,
          aplica: true,
          valor: (itens[cfg.campo] ?? 0) / 100,
          ...(informativos.includes(cfg.campo) ? { informativo: true } : {}),
        },
      ])
    ),
    calculadoEm: new Date().toISOString(),
    regra: "transporte-v1",
  };

  return {
    itens,
    totalDescontosCents,
    liquidoCents: e.brutoCents - totalDescontosCents,
    avisos,
    snapshot,
    informativos,
  };
}
