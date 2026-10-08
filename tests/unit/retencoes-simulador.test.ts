import { describe, test, expect } from "vitest";
import { simularRetencoes, type SimuladorCampoConfig } from "@/lib/retencoes-simulador";

const camposPadrao: SimuladorCampoConfig[] = [
  { campo: "irrf", tipo: "PERCENTUAL", aliquota: "1,5", calculoAutomatico: true, ativo: true },
  { campo: "iss", tipo: "PERCENTUAL", aliquota: "5", calculoAutomatico: true, ativo: true },
  { campo: "inss", tipo: "PERCENTUAL", aliquota: "11", calculoAutomatico: true, ativo: true },
  { campo: "patronal", tipo: "PERCENTUAL", aliquota: "20", calculoAutomatico: true, ativo: true },
  { campo: "sest_senat", tipo: "PERCENTUAL", aliquota: "2,5", calculoAutomatico: true, ativo: true },
];

const TODOS_TRIBUTARIOS = ["irrf", "iss", "inss", "patronal", "sest_senat"];
const SEM_ISS = ["irrf", "inss", "patronal", "sest_senat"];

describe("simularRetencoes — casos de referência do README (A-F)", () => {
  test("Caso A: 1.000,00 no .36 -> líquido 600,00", () => {
    const r = simularRetencoes({ brutoReais: 1000, regrasElemento: TODOS_TRIBUTARIOS, camposConfig: camposPadrao });
    expect(r.itensCents.irrf).toBe(1500); // 15,00
    expect(r.itensCents.iss).toBe(5000); // 50,00
    expect(r.itensCents.inss).toBe(11000); // 110,00
    expect(r.itensCents.patronal).toBe(20000); // 200,00
    expect(r.itensCents.sest_senat).toBe(2500); // 25,00
    expect(r.totalDescontosCents).toBe(40000); // 400,00
    expect(r.liquidoCents).toBe(60000); // 600,00
  });

  test("Caso B: 665,00 no .36 -> líquido 398,99 (com arredondamentos 9,98 e 16,63)", () => {
    const r = simularRetencoes({ brutoReais: 665, regrasElemento: TODOS_TRIBUTARIOS, camposConfig: camposPadrao });
    expect(r.itensCents.irrf).toBe(998); // 9,98
    expect(r.itensCents.iss).toBe(3325); // 33,25
    expect(r.itensCents.inss).toBe(7315); // 73,15
    expect(r.itensCents.patronal).toBe(13300); // 133,00
    expect(r.itensCents.sest_senat).toBe(1663); // 16,63
    expect(r.totalDescontosCents).toBe(26601); // 266,01
    expect(r.liquidoCents).toBe(39899); // 398,99
  });

  test("Caso C: 1.000,00 no .30 (sem ISS) -> líquido 650,00", () => {
    const r = simularRetencoes({ brutoReais: 1000, regrasElemento: SEM_ISS, camposConfig: camposPadrao });
    expect(r.itensCents.irrf).toBe(1500);
    expect(r.itensCents.iss).toBe(0); // não se aplica a este elemento
    expect(r.itensCents.inss).toBe(11000);
    expect(r.itensCents.patronal).toBe(20000);
    expect(r.itensCents.sest_senat).toBe(2500);
    expect(r.totalDescontosCents).toBe(35000); // 350,00
    expect(r.liquidoCents).toBe(65000); // 650,00
  });

  test("Caso D: 1.000,00 no .14 (sem nenhuma retenção) -> líquido = bruto", () => {
    const r = simularRetencoes({ brutoReais: 1000, regrasElemento: [], camposConfig: camposPadrao });
    expect(r.totalDescontosCents).toBe(0);
    expect(r.liquidoCents).toBe(100000); // 1.000,00
  });

  test("Caso E: 665,00 no .36 + taxa bancária 8,50 -> líquido 390,49", () => {
    const r = simularRetencoes({
      brutoReais: 665,
      regrasElemento: TODOS_TRIBUTARIOS,
      camposConfig: camposPadrao,
      taxaBancariaReais: 8.5,
    });
    expect(r.totalDescontosCents).toBe(27451); // 266,01 + 8,50 = 274,51
    expect(r.liquidoCents).toBe(39049); // 390,49
  });

  test("Caso F: 11,00 no .36 -> IRRF 0,17 (não 0,16 — bug histórico de ponto flutuante já corrigido na T01)", () => {
    const r = simularRetencoes({ brutoReais: 11, regrasElemento: TODOS_TRIBUTARIOS, camposConfig: camposPadrao });
    expect(r.itensCents.irrf).toBe(17); // 0,17
  });

  test("campo com calculoAutomatico=false não calcula (valor digitado, simulador não adivinha)", () => {
    const campos: SimuladorCampoConfig[] = [
      { campo: "iss", tipo: "PERCENTUAL", aliquota: "5", calculoAutomatico: false, ativo: true },
    ];
    const r = simularRetencoes({ brutoReais: 1000, regrasElemento: ["iss"], camposConfig: campos });
    expect(r.itensCents.iss).toBe(0);
  });

  test("campo inativo não calcula mesmo se o elemento aplicar", () => {
    const campos: SimuladorCampoConfig[] = [
      { campo: "irrf", tipo: "PERCENTUAL", aliquota: "1,5", calculoAutomatico: true, ativo: false },
    ];
    const r = simularRetencoes({ brutoReais: 1000, regrasElemento: ["irrf"], camposConfig: campos });
    expect(r.itensCents.irrf).toBe(0);
  });
});
