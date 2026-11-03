// B7a — regra de retenções por subelemento (puro): o motor e as regras da tela.
import { describe, test, expect } from "vitest";
import { calcularRetencoes, regraDaOp } from "@/lib/retencoes";
import { estadoCampoOp, informadosValidosDaLinha, regraDaTela } from "@/lib/retencoes-form";
import { camposDoTexto, subelementoAceitaRegraPropria } from "@/lib/services/config-retencoes.service";
import { toCents } from "@/lib/money";
import type { ConfigRetencaoCampoMapeado } from "@/lib/services/config-retencoes.service";

const CONFIG: ConfigRetencaoCampoMapeado[] = [
  { campo: "irrf", rotulo: "IRRF", tipo: "PERCENTUAL", aliquota: 1.5, calculoAutomatico: true, editavelOperador: false, entraDarf: false, ativo: true, ordem: 10 },
  { campo: "iss", rotulo: "ISS", tipo: "PERCENTUAL", aliquota: 5, calculoAutomatico: true, editavelOperador: false, entraDarf: false, ativo: true, ordem: 20 },
  { campo: "inss", rotulo: "INSS", tipo: "PERCENTUAL", aliquota: 11, calculoAutomatico: true, editavelOperador: false, entraDarf: true, ativo: true, ordem: 30 },
  { campo: "patronal", rotulo: "Patronal", tipo: "PERCENTUAL", aliquota: 20, calculoAutomatico: true, editavelOperador: false, entraDarf: true, ativo: true, ordem: 40 },
  { campo: "sest_senat", rotulo: "SEST/SENAT", tipo: "PERCENTUAL", aliquota: 2.5, calculoAutomatico: true, editavelOperador: false, entraDarf: true, ativo: true, ordem: 50 },
  { campo: "outros", rotulo: "Outros", tipo: "VALOR_DIGITADO", aliquota: null, calculoAutomatico: false, editavelOperador: false, entraDarf: false, ativo: true, ordem: 60 },
  { campo: "taxa_bancaria", rotulo: "Taxa bancária", tipo: "VALOR_DIGITADO", aliquota: null, calculoAutomatico: false, editavelOperador: true, entraDarf: false, ativo: true, ordem: 70 },
  { campo: "taxa_pix", rotulo: "Taxa PIX", tipo: "VALOR_DIGITADO", aliquota: null, calculoAutomatico: false, editavelOperador: true, entraDarf: false, ativo: true, ordem: 80 },
];
const TODOS = ["irrf", "iss", "inss", "patronal", "sest_senat"];
const REGRAS = { "3.3.90.36": TODOS, "3.3.90.33": TODOS };
const SUB = { "3.3.90.36.08": [] as string[] };

const calcular = (extra: Partial<Parameters<typeof calcularRetencoes>[0]> = {}) =>
  calcularRetencoes({
    brutoCents: toCents(1000),
    elementoCodigo: "3.3.90.36",
    subelementoCodigo: "3.3.90.36.08",
    config: CONFIG,
    regras: REGRAS,
    regrasSubelemento: SUB,
    informados: {},
    perfil: "GESTOR",
    ...extra,
  });

describe("regraDaOp", () => {
  test("subelemento com regra própria vence o elemento; lista vazia continua sendo regra", () => {
    expect(regraDaOp("3.3.90.36", "3.3.90.36.08", REGRAS, SUB)).toEqual({ codigo: "3.3.90.36.08", campos: [], origem: "subelemento" });
  });

  test("sem regra própria, sem subelemento ou sem a tabela: a do elemento", () => {
    const doElemento = { codigo: "3.3.90.36", campos: TODOS, origem: "elemento" };
    expect(regraDaOp("3.3.90.36", "3.3.90.36.01", REGRAS, SUB)).toEqual(doElemento);
    expect(regraDaOp("3.3.90.36", null, REGRAS, SUB)).toEqual(doElemento);
    expect(regraDaOp("3.3.90.36", "3.3.90.36.08", REGRAS, undefined)).toEqual(doElemento);
    expect(regraDaOp("3.3.90.36", "3.3.90.36.08", REGRAS, {})).toEqual(doElemento);
  });

  test("subelemento de outro elemento não conta (nem prefixo parecido)", () => {
    expect(regraDaOp("3.3.90.39", "3.3.90.36.08", { ...REGRAS, "3.3.90.39": ["iss"] }, SUB).origem).toBe("elemento");
    expect(regraDaOp("3.3.90.3", "3.3.90.36.08", { "3.3.90.3": ["iss"] }, SUB).origem).toBe("elemento");
  });

  test("elemento desconhecido sem regra própria → campos undefined", () => {
    expect(regraDaOp(null, null, REGRAS, SUB).campos).toBeUndefined();
    expect(regraDaOp("9.9.99.99", null, REGRAS, SUB).campos).toBeUndefined();
  });
});

describe("calcularRetencoes com subelemento", () => {
  test("estagiário: R$ 1.000,00 → nada retido, líquido R$ 1.000,00, sem aviso de elemento desconhecido", () => {
    const r = calcular();
    expect(Object.values(r.itens).every((v) => v === 0)).toBe(true);
    expect(r.totalDescontosCents).toBe(0);
    expect(r.liquidoCents).toBe(100000);
    expect(r.avisos).toEqual([]);
    expect(r.snapshot).toMatchObject({ elemento: "3.3.90.36", subelemento: "3.3.90.36.08", origemRegra: "subelemento", regraCodigo: "3.3.90.36.08" });
    expect(r.snapshot.campos.irrf.aplica).toBe(false);
    expect(r.snapshot.campos.taxa_pix.aplica).toBe(true);
  });

  test("regra parcial: só o IRRF", () => {
    const r = calcular({ regrasSubelemento: { "3.3.90.36.08": ["irrf"] } });
    expect(r.itens).toMatchObject({ irrf: 1500, iss: 0, inss: 0, patronal: 0, sest_senat: 0 });
    expect(r.liquidoCents).toBe(98500);
  });

  test("sem regra própria: idêntico ao cálculo só pelo elemento (Caso A)", () => {
    const comSub = calcular({ subelementoCodigo: "3.3.90.36.01" });
    const semSub = calcularRetencoes({ brutoCents: toCents(1000), elementoCodigo: "3.3.90.36", config: CONFIG, regras: REGRAS, informados: {}, perfil: "GESTOR" });
    expect(comSub.itens).toEqual(semSub.itens);
    expect(comSub.liquidoCents).toBe(80000);
    expect(semSub.snapshot).toMatchObject({ origemRegra: "elemento", regraCodigo: "3.3.90.36", subelemento: null });
  });

  test("tributário digitado no estagiário é ignorado (não se aplica), mesmo pelo ADMIN", () => {
    const r = calcular({ perfil: "ADMIN", informados: { inss: 5000, irrf: 100 } });
    expect(r.itens.inss).toBe(0);
    expect(r.itens.irrf).toBe(0);
  });

  test("os descontos digitados (taxa bancária, PIX) continuam valendo", () => {
    const r = calcular({ informados: { taxa_bancaria: 250, taxa_pix: 100 } });
    expect(r.itens.taxa_bancaria).toBe(250);
    expect(r.itens.taxa_pix).toBe(100);
    expect(r.liquidoCents).toBe(99650);
  });

  test("MEI continua zerando antes de qualquer regra", () => {
    const r = calcular({ regrasSubelemento: { "3.3.90.36.08": ["irrf"] }, credorMei: true });
    expect(r.itens.irrf).toBe(0);
    expect(r.avisos).toEqual(["Credor MEI: isento de retenções."]);
  });
});

describe("regras da tela", () => {
  const cfg = (campo: string) => CONFIG.find((c) => c.campo === campo)!;
  const config = { campos: CONFIG, regras: REGRAS, regrasSubelemento: SUB };

  test("regraDaTela: o código e só a regra que vale", () => {
    expect(regraDaTela(config, "3.3.90.36", "3.3.90.36.08")).toEqual({ codigo: "3.3.90.36.08", regras: { "3.3.90.36.08": [] }, origem: "subelemento" });
    expect(regraDaTela(config, "3.3.90.36", null)).toEqual({ codigo: "3.3.90.36", regras: { "3.3.90.36": TODOS }, origem: "elemento" });
    expect(regraDaTela(config, null, null)).toEqual({ codigo: null, regras: {}, origem: "elemento" });
  });

  test("campo travado no estagiário, com a dica do subelemento", () => {
    const r = regraDaTela(config, "3.3.90.36", "3.3.90.36.08");
    expect(estadoCampoOp(cfg("inss"), r.codigo, r.regras, "ADMIN")).toEqual({ editavel: false, obrigatorio: false, dica: "Não se aplica a 3.3.90.36.08" });
  });

  test("informadosValidosDaLinha descarta tributário digitado quando o subelemento não retém", () => {
    const mei = { credorMei: false, sobrescreverMei: false };
    expect(informadosValidosDaLinha(["inss", "taxa_pix"], config, "3.3.90.36", "ADMIN", mei, "3.3.90.36.08")).toEqual(["taxa_pix"]);
    expect(informadosValidosDaLinha(["inss", "taxa_pix"], config, "3.3.90.36", "ADMIN", mei)).toEqual(["inss", "taxa_pix"]);
  });
});

describe("leitura da tabela", () => {
  test("camposDoTexto: ordem fixa, sem repetir, ignora lixo; vazio = nenhuma", () => {
    expect(camposDoTexto("sest_senat, irrf,irrf,xyz")).toEqual(["irrf", "sest_senat"]);
    expect(camposDoTexto("")).toEqual([]);
    expect(camposDoTexto(null)).toEqual([]);
  });

  test("transporte (3.3.90.33) não aceita regra própria", () => {
    expect(subelementoAceitaRegraPropria("3.3.90.33.01")).toBe(false);
    expect(subelementoAceitaRegraPropria("3.3.90.36.08")).toBe(true);
    expect(subelementoAceitaRegraPropria("3.3.90.14.03")).toBe(true);
  });
});
