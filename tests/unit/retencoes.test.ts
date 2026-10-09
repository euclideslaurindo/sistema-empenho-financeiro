import { describe, test, expect } from "vitest";
import { calcularRetencoes } from "@/lib/retencoes";
import { toCents } from "@/lib/money";
import type { ConfigRetencaoCampoMapeado } from "@/lib/services/config-retencoes.service";

// Mesma config seed da T03 (migration_12.sql) — alíquotas e flags reais.
const CONFIG_PADRAO: ConfigRetencaoCampoMapeado[] = [
  { campo: "irrf", rotulo: "IRRF", tipo: "PERCENTUAL", aliquota: 1.5, calculoAutomatico: true, editavelOperador: false, entraDarf: false, ativo: true, ordem: 10 },
  { campo: "iss", rotulo: "ISS", tipo: "PERCENTUAL", aliquota: 5, calculoAutomatico: true, editavelOperador: false, entraDarf: false, ativo: true, ordem: 20 },
  { campo: "inss", rotulo: "INSS", tipo: "PERCENTUAL", aliquota: 11, calculoAutomatico: true, editavelOperador: false, entraDarf: true, ativo: true, ordem: 30 },
  { campo: "patronal", rotulo: "Patronal", tipo: "PERCENTUAL", aliquota: 20, calculoAutomatico: true, editavelOperador: false, entraDarf: true, ativo: true, ordem: 40 },
  { campo: "sest_senat", rotulo: "SEST/SENAT", tipo: "PERCENTUAL", aliquota: 2.5, calculoAutomatico: true, editavelOperador: false, entraDarf: true, ativo: true, ordem: 50 },
  { campo: "outros", rotulo: "Outros", tipo: "VALOR_DIGITADO", aliquota: null, calculoAutomatico: false, editavelOperador: false, entraDarf: false, ativo: true, ordem: 60 },
  { campo: "taxa_bancaria", rotulo: "Taxa bancária", tipo: "VALOR_DIGITADO", aliquota: null, calculoAutomatico: false, editavelOperador: true, entraDarf: false, ativo: true, ordem: 70 },
  { campo: "taxa_pix", rotulo: "Taxa PIX", tipo: "VALOR_DIGITADO", aliquota: null, calculoAutomatico: false, editavelOperador: true, entraDarf: false, ativo: true, ordem: 80 },
];

const REGRAS_PADRAO: Record<string, string[]> = {
  "3.3.90.14": [],
  "3.3.90.30": ["irrf", "inss", "patronal", "sest_senat"],
  "3.3.90.36": ["irrf", "iss", "inss", "patronal", "sest_senat"],
};

describe("calcularRetencoes — casos A-F do README", () => {
  test("Caso A: 1.000,00 no .36 -> líquido 600,00", () => {
    const r = calcularRetencoes({
      brutoCents: toCents(1000),
      elementoCodigo: "3.3.90.36",
      config: CONFIG_PADRAO,
      regras: REGRAS_PADRAO,
      informados: {},
      perfil: "GESTOR",
    });
    expect(r.itens.irrf).toBe(1500);
    expect(r.itens.iss).toBe(5000);
    expect(r.itens.inss).toBe(11000);
    expect(r.itens.patronal).toBe(20000);
    expect(r.itens.sest_senat).toBe(2500);
    expect(r.totalDescontosCents).toBe(40000);
    expect(r.liquidoCents).toBe(60000);
  });

  test("Caso B: 665,00 no .36 -> líquido 398,99", () => {
    const r = calcularRetencoes({
      brutoCents: toCents(665),
      elementoCodigo: "3.3.90.36",
      config: CONFIG_PADRAO,
      regras: REGRAS_PADRAO,
      informados: {},
      perfil: "GESTOR",
    });
    expect(r.itens.irrf).toBe(998);
    expect(r.itens.sest_senat).toBe(1663);
    expect(r.totalDescontosCents).toBe(26601);
    expect(r.liquidoCents).toBe(39899);
  });

  test("Caso C: 1.000,00 no .30 (sem ISS) -> líquido 650,00", () => {
    const r = calcularRetencoes({
      brutoCents: toCents(1000),
      elementoCodigo: "3.3.90.30",
      config: CONFIG_PADRAO,
      regras: REGRAS_PADRAO,
      informados: {},
      perfil: "GESTOR",
    });
    expect(r.itens.iss).toBe(0);
    expect(r.totalDescontosCents).toBe(35000);
    expect(r.liquidoCents).toBe(65000);
  });

  test("Caso D: 1.000,00 no .14 -> líquido = bruto, mesmo com tentativa de fraude", () => {
    const r = calcularRetencoes({
      brutoCents: toCents(1000),
      elementoCodigo: "3.3.90.14",
      config: CONFIG_PADRAO,
      regras: REGRAS_PADRAO,
      informados: { irrf: 999999 },
      perfil: "ADMIN", // nem ADMIN consegue: "aplica" é false pra esse elemento, não é questão de permissão
    });
    expect(r.totalDescontosCents).toBe(0);
    expect(r.liquidoCents).toBe(100000);
  });

  test("Caso E: 665,00 no .36 + taxa bancária 8,50 -> líquido 390,49", () => {
    const r = calcularRetencoes({
      brutoCents: toCents(665),
      elementoCodigo: "3.3.90.36",
      config: CONFIG_PADRAO,
      regras: REGRAS_PADRAO,
      informados: { taxa_bancaria: toCents(8.5) },
      perfil: "GESTOR",
    });
    expect(r.totalDescontosCents).toBe(27451);
    expect(r.liquidoCents).toBe(39049);
  });

  test("Caso F: 11,00 no .36 -> IRRF 0,17 (bug histórico de ponto flutuante já corrigido na T01)", () => {
    const r = calcularRetencoes({
      brutoCents: toCents(11),
      elementoCodigo: "3.3.90.36",
      config: CONFIG_PADRAO,
      regras: REGRAS_PADRAO,
      informados: {},
      perfil: "GESTOR",
    });
    expect(r.itens.irrf).toBe(17);
  });
});

describe("calcularRetencoes — elemento desconhecido (regra 1)", () => {
  test("elementoCodigo null zera tudo e avisa", () => {
    const r = calcularRetencoes({
      brutoCents: toCents(1000),
      elementoCodigo: null,
      config: CONFIG_PADRAO,
      regras: REGRAS_PADRAO,
      informados: {},
      perfil: "GESTOR",
    });
    expect(r.totalDescontosCents).toBe(0);
    expect(r.avisos.length).toBeGreaterThan(0);
  });

  test("elemento não cadastrado na matriz zera tudo", () => {
    const r = calcularRetencoes({
      brutoCents: toCents(1000),
      elementoCodigo: "9.9.99.99",
      config: CONFIG_PADRAO,
      regras: REGRAS_PADRAO,
      informados: {},
      perfil: "GESTOR",
    });
    expect(r.totalDescontosCents).toBe(0);
  });

  test("elemento desconhecido aceita valor digitado de quem PODE editar", () => {
    const r = calcularRetencoes({
      brutoCents: toCents(1000),
      elementoCodigo: null,
      config: CONFIG_PADRAO,
      regras: REGRAS_PADRAO,
      informados: { irrf: toCents(50) },
      perfil: "ADMIN",
    });
    expect(r.itens.irrf).toBe(5000);
  });

  test("elemento desconhecido NÃO aceita valor digitado de quem não pode editar", () => {
    const r = calcularRetencoes({
      brutoCents: toCents(1000),
      elementoCodigo: null,
      config: CONFIG_PADRAO,
      regras: REGRAS_PADRAO,
      informados: { irrf: toCents(50) },
      perfil: "GESTOR", // irrf tem editavelOperador=false no seed
    });
    expect(r.itens.irrf).toBe(0);
  });
});

describe("calcularRetencoes — sobrescrita manual de cálculo automático (regra 3)", () => {
  test("GESTOR sem editavelOperador: valor enviado é ignorado, mantém o calculado", () => {
    const r = calcularRetencoes({
      brutoCents: toCents(1000),
      elementoCodigo: "3.3.90.36",
      config: CONFIG_PADRAO,
      regras: REGRAS_PADRAO,
      informados: { irrf: 1 },
      perfil: "GESTOR",
    });
    expect(r.itens.irrf).toBe(1500);
  });

  test("GESTOR com editavelOperador=true no campo: valor enviado é aceito", () => {
    const configComIrrfEditavel = CONFIG_PADRAO.map((c) => (c.campo === "irrf" ? { ...c, editavelOperador: true } : c));
    const r = calcularRetencoes({
      brutoCents: toCents(1000),
      elementoCodigo: "3.3.90.36",
      config: configComIrrfEditavel,
      regras: REGRAS_PADRAO,
      informados: { irrf: toCents(7) },
      perfil: "GESTOR",
    });
    expect(r.itens.irrf).toBe(700);
  });

  test("ADMIN sempre pode sobrescrever, mesmo sem editavelOperador", () => {
    const r = calcularRetencoes({
      brutoCents: toCents(1000),
      elementoCodigo: "3.3.90.36",
      config: CONFIG_PADRAO,
      regras: REGRAS_PADRAO,
      informados: { irrf: toCents(2) },
      perfil: "ADMIN",
    });
    expect(r.itens.irrf).toBe(200);
  });

  test('cliente "pulando" um imposto ao enviar 0 não funciona sem permissão', () => {
    const r = calcularRetencoes({
      brutoCents: toCents(1000),
      elementoCodigo: "3.3.90.36",
      config: CONFIG_PADRAO,
      regras: REGRAS_PADRAO,
      informados: { irrf: 0 },
      perfil: "GESTOR",
    });
    expect(r.itens.irrf).toBe(1500);
  });
});

describe("calcularRetencoes — campo não automático (ISS digitado, D1)", () => {
  test("qualquer perfil pode digitar quando calculoAutomatico=false", () => {
    const configIssDigitado = CONFIG_PADRAO.map((c) => (c.campo === "iss" ? { ...c, calculoAutomatico: false } : c));
    const r = calcularRetencoes({
      brutoCents: toCents(1000),
      elementoCodigo: "3.3.90.36",
      config: configIssDigitado,
      regras: REGRAS_PADRAO,
      informados: { iss: toCents(42) },
      perfil: "GESTOR",
    });
    expect(r.itens.iss).toBe(4200);
  });

  test("sem valor informado e sem cálculo automático, grava 0 e avisa", () => {
    const configIssDigitado = CONFIG_PADRAO.map((c) => (c.campo === "iss" ? { ...c, calculoAutomatico: false } : c));
    const r = calcularRetencoes({
      brutoCents: toCents(1000),
      elementoCodigo: "3.3.90.36",
      config: configIssDigitado,
      regras: REGRAS_PADRAO,
      informados: {},
      perfil: "GESTOR",
    });
    expect(r.itens.iss).toBe(0);
    expect(r.avisos.some((a) => a.includes("iss"))).toBe(true);
  });
});

describe("calcularRetencoes — validações e limites", () => {
  test("campo inativo sempre 0, mesmo aplicável, informado e perfil ADMIN", () => {
    const configIrrfInativo = CONFIG_PADRAO.map((c) => (c.campo === "irrf" ? { ...c, ativo: false } : c));
    const r = calcularRetencoes({
      brutoCents: toCents(1000),
      elementoCodigo: "3.3.90.36",
      config: configIrrfInativo,
      regras: REGRAS_PADRAO,
      informados: { irrf: toCents(999) },
      perfil: "ADMIN",
    });
    expect(r.itens.irrf).toBe(0);
  });

  test("total de descontos maior que o bruto lança erro 422", () => {
    expect(() =>
      calcularRetencoes({
        brutoCents: toCents(100),
        elementoCodigo: "3.3.90.36",
        config: CONFIG_PADRAO,
        regras: REGRAS_PADRAO,
        informados: { taxa_bancaria: toCents(99999) },
        perfil: "ADMIN",
      })
    ).toThrow();
  });

  test("valor informado negativo lança erro 422", () => {
    expect(() =>
      calcularRetencoes({
        brutoCents: toCents(1000),
        elementoCodigo: "3.3.90.36",
        config: CONFIG_PADRAO,
        regras: REGRAS_PADRAO,
        informados: { irrf: -100 },
        perfil: "ADMIN",
      })
    ).toThrow();
  });

  test("valor informado maior que o bruto lança erro 422", () => {
    expect(() =>
      calcularRetencoes({
        brutoCents: toCents(100),
        elementoCodigo: "3.3.90.36",
        config: CONFIG_PADRAO,
        regras: REGRAS_PADRAO,
        informados: { irrf: toCents(200) },
        perfil: "ADMIN",
      })
    ).toThrow();
  });

  test("taxa_bancaria e taxa_pix entram no total e reduzem o líquido", () => {
    const r = calcularRetencoes({
      brutoCents: toCents(1000),
      elementoCodigo: "3.3.90.14", // sem nenhum imposto, só pra isolar o efeito das taxas
      config: CONFIG_PADRAO,
      regras: REGRAS_PADRAO,
      informados: { taxa_bancaria: toCents(10), taxa_pix: toCents(2) },
      perfil: "GESTOR",
    });
    expect(r.itens.taxa_bancaria).toBe(1000);
    expect(r.itens.taxa_pix).toBe(200);
    expect(r.totalDescontosCents).toBe(1200);
    expect(r.liquidoCents).toBe(98800);
  });
});

describe("calcularRetencoes — snapshot (usado pela impressão, T12)", () => {
  const calcular = (elementoCodigo: string | null, config = CONFIG_PADRAO) =>
    calcularRetencoes({
      brutoCents: toCents(1000),
      elementoCodigo,
      config,
      regras: REGRAS_PADRAO,
      informados: {},
      perfil: "GESTOR",
    }).snapshot;

  test("guarda rótulo, alíquota, ativo, aplica e valor de cada campo", () => {
    const s = calcular("3.3.90.30");
    expect(s.elemento).toBe("3.3.90.30");
    expect(s.campos.irrf).toEqual({ rotulo: "IRRF", aliquota: 1.5, automatico: true, ativo: true, aplica: true, valor: 15 });
    expect(s.campos.iss.aplica).toBe(false);
    expect(s.campos.taxa_bancaria.aplica).toBe(true);
  });

  test(".14: nenhum imposto se aplica, descontos sim", () => {
    const s = calcular("3.3.90.14");
    for (const c of ["irrf", "iss", "inss", "patronal", "sest_senat"]) expect(s.campos[c].aplica).toBe(false);
    for (const c of ["outros", "taxa_bancaria", "taxa_pix"]) expect(s.campos[c].aplica).toBe(true);
  });

  test("elemento desconhecido: impostos marcados como aplicáveis (podem ter sido digitados)", () => {
    expect(calcular(null).campos.irrf.aplica).toBe(true);
  });

  test("campo inativo fica registrado como inativo", () => {
    const config = CONFIG_PADRAO.map((c) => (c.campo === "taxa_pix" ? { ...c, ativo: false } : c));
    expect(calcular("3.3.90.36", config).campos.taxa_pix.ativo).toBe(false);
  });
});
