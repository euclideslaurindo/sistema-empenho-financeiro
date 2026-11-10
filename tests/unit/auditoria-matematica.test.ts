// Auditoria da matemática do sistema: os motores de cálculo comparados com
// uma conta INDEPENDENTE (exata, em BigInt/racionais) em milhares de casos
// pseudoaleatórios (semente fixa → sempre os mesmos casos), mais as regras
// que nunca podem quebrar: nada se perde, nada sobra, nada fica negativo.
import { describe, test, expect, vi } from 'vitest';
import { calcPercentCents, toCents, fromCents, formatarBRL, lerValorMonetario, somaItensCents, totalItemCents } from '@/lib/money';
import { calcularRetencoes, CAMPOS_INFORMATIVOS, type EntradaCalculo } from '@/lib/retencoes';
import { calcularTransporteAutonomo } from '@/lib/retencoes-transporte';
import { irrfPessoaFisica, inssPessoaFisica } from '@/lib/irrf-pessoa-fisica';
import { calcularDarf } from '@/lib/services/darf.service';
import type { ConfigRetencaoCampoMapeado } from '@/lib/services/config-retencoes.service';
import { FAIXAS_IRRF_2026, PARAMETROS_PF_2026 } from '../fixtures/pessoa-fisica-2026';

// Milhares de casos por teste: mais tempo que o padrão (5 s).
vi.setConfig({ testTimeout: 120_000 });

// ---------------------------------------------------------------- utilidades
/** Gerador determinístico (mulberry32). */
function gerador(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = gerador(20261110);
const inteiro = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;

/** Conta de referência: round-half-up de (centavos × alíquota% ) com alíquota até 4 casas. */
function percentualReferencia(brutoCents: number, aliquota: number): number {
  const a4 = BigInt(Math.round(aliquota * 10000)); // 2.5 → 25000
  const num = BigInt(brutoCents) * a4; // centavos × alíquota × 10^4
  const den = 1_000_000n; // ÷100 (percentual) ÷10^4
  return Number((num * 2n + den) / (2n * den));
}

/** IR da pessoa física por racionais exatos (numerador/denominador BigInt). */
function irrfPfReferencia(brutoCents: number, inssCents: number): number {
  const D = 1_000_000n; // trabalha em milionésimos de centavo
  const bruto = BigInt(brutoCents) * D;
  const deducao = (inssCents > 60720 ? BigInt(inssCents) : 60720n) * D;
  const base = bruto > deducao ? bruto - deducao : 0n;
  if (brutoCents <= 500000) return 0;
  const faixas: Array<[number | null, bigint, bigint]> = [
    [242880, 0n, 0n], [282665, 75n, 18216n], [375105, 150n, 39416n], [466468, 225n, 67549n], [null, 275n, 90873n],
  ];
  const f = faixas.find(([lim]) => lim === null || base <= BigInt(lim) * D)!;
  let tabela = (base * f[1]) / 1000n - f[2] * D; // alíquota em ‰ (7,5% = 75‰)
  if (tabela < 0n) tabela = 0n;
  let redutor = 0n;
  if (brutoCents <= 735000) {
    // 978,62 − 0,133145 × bruto  (em milionésimos de centavo)
    redutor = 97862n * D - (bruto * 133145n) / 1_000_000n;
    if (redutor < 0n) redutor = 0n;
  }
  const ir = tabela - redutor;
  if (ir <= 0n) return 0;
  return Number((ir * 2n + D) / (2n * D)); // meio para cima, para centavos
}

const pct = (campo: string, aliquota: number, extra: Partial<ConfigRetencaoCampoMapeado> = {}): ConfigRetencaoCampoMapeado => ({
  campo, rotulo: campo, tipo: 'PERCENTUAL', aliquota, calculoAutomatico: true, editavelOperador: false, entraDarf: false, ativo: true, ordem: 0, ...extra,
});
const digitado = (campo: string): ConfigRetencaoCampoMapeado => ({
  campo, rotulo: campo, tipo: 'VALOR_DIGITADO', aliquota: null, calculoAutomatico: false, editavelOperador: true, entraDarf: false, ativo: true, ordem: 0,
});
const TRIB = ['irrf', 'iss', 'inss', 'patronal', 'sest_senat'];

/** As regras que valem para QUALQUER resultado de cálculo. */
function conferirFechamento(r: ReturnType<typeof calcularRetencoes>, brutoCents: number) {
  for (const [campo, v] of Object.entries(r.itens)) {
    expect(Number.isInteger(v), `${campo} não é centavo inteiro: ${v}`).toBe(true);
    expect(v, `${campo} negativo`).toBeGreaterThanOrEqual(0);
  }
  const informativos = (r.informativos ?? CAMPOS_INFORMATIVOS) as string[];
  const soma = Object.entries(r.itens).filter(([c]) => !informativos.includes(c)).reduce((t, [, v]) => t + v, 0);
  expect(r.totalDescontosCents).toBe(soma); // nada se perde, nada sobra
  expect(r.liquidoCents).toBe(brutoCents - soma);
  expect(r.liquidoCents).toBeGreaterThanOrEqual(0);
  // O snapshot (que vai para a impressão) guarda o mesmo valor de cada campo.
  for (const [campo, s] of Object.entries(r.snapshot.campos as Record<string, any>)) {
    expect(toCents(s.valor), `snapshot ${campo}`).toBe(r.itens[campo] ?? 0);
  }
}

// ---------------------------------------------------------------- dinheiro
describe('dinheiro (lib/money)', () => {
  test('calcPercentCents = conta exata meio-para-cima (20.000 casos)', () => {
    const aliquotas = [0.24, 1.2, 1.5, 2.4, 2.5, 4.8, 5, 11, 20, 0.0001, 33.3333, 99.9999];
    for (let i = 0; i < 20000; i++) {
      const bruto = inteiro(0, 50_000_000); // até R$ 500 mil
      const a = i < aliquotas.length * 50 ? aliquotas[i % aliquotas.length] : inteiro(0, 1_000_000) / 10000;
      expect(calcPercentCents(bruto, a), `bruto ${bruto} × ${a}%`).toBe(percentualReferencia(bruto, a));
    }
  });

  test('ida e volta: centavos → reais → texto BR → centavos (20.000 casos)', () => {
    for (let i = 0; i < 20000; i++) {
      const c = inteiro(0, 99_999_999_99);
      expect(toCents(fromCents(c))).toBe(c);
      expect(toCents(lerValorMonetario(formatarBRL(c)))).toBe(c);
      expect(toCents(String(fromCents(c)))).toBe(c); // como o MySQL devolve DECIMAL ("1234.5")
    }
  });

  test('itens: cada item arredondado e somado — igual à conta exata (5.000 casos)', () => {
    for (let i = 0; i < 5000; i++) {
      const itens = Array.from({ length: inteiro(1, 8) }, () => ({
        quantidade: inteiro(1, 4000) / (rnd() < 0.5 ? 1 : 100), // inteira ou com 2 casas
        valorUnitario: fromCents(inteiro(1, 10_000_000)),
      }));
      const ref = itens.reduce((t, it) => {
        const q100 = BigInt(Math.round(it.quantidade * 100));
        const prod = q100 * BigInt(toCents(it.valorUnitario)); // ×100
        return t + Number((prod * 2n + 100n) / 200n);
      }, 0);
      expect(somaItensCents(itens)).toBe(ref);
      for (const it of itens) expect(Number.isInteger(totalItemCents(it.quantidade, it.valorUnitario))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------- motor padrão
describe('motor padrão (todos os elementos fora 33/36)', () => {
  test('percentuais exatos e fechamento do total (10.000 OPs aleatórias)', () => {
    for (let i = 0; i < 10000; i++) {
      const aliq = { irrf: [0.24, 1.2, 1.5, 2.4, 4.8][inteiro(0, 4)], iss: inteiro(0, 50000) / 10000, inss: 11, patronal: 20, sest_senat: 2.5 };
      const config = [
        ...TRIB.map((c) => pct(c, (aliq as any)[c])),
        digitado('outros'), digitado('taxa_bancaria'), digitado('taxa_pix'), digitado('iss_bs'),
        pct('x_taxa_teste', inteiro(1, 30000) / 10000),
        digitado('x_livre'),
      ];
      const aplicaveis = TRIB.concat('x_taxa_teste').filter(() => rnd() < 0.6);
      const bruto = inteiro(1, 20_000_000);
      const digitados: Record<string, number> = {};
      for (const c of ['taxa_bancaria', 'taxa_pix', 'iss_bs', 'x_livre']) if (rnd() < 0.3) digitados[c] = inteiro(0, Math.floor(bruto / 50));
      const entrada: EntradaCalculo = {
        brutoCents: bruto, elementoCodigo: '3.3.90.39', config, regras: { '3.3.90.39': aplicaveis },
        informados: digitados, perfil: 'GESTOR', credorMei: rnd() < 0.1, credorSimples: rnd() < 0.15,
      };
      const r = calcularRetencoes(entrada);
      conferirFechamento(r, bruto);
      for (const c of [...TRIB, 'x_taxa_teste']) {
        const cfg = config.find((x) => x.campo === c)!;
        let esperado = aplicaveis.includes(c) ? percentualReferencia(bruto, cfg.aliquota as number) : 0;
        if (entrada.credorMei) esperado = 0;
        else if (entrada.credorSimples && c === 'irrf') esperado = 0;
        expect(r.itens[c], `${c} (OP ${i})`).toBe(esperado);
      }
      for (const [c, v] of Object.entries(digitados)) expect(r.itens[c]).toBe(v); // digitado entra exatamente
    }
  });

  test('IR pela natureza (PJ) = alíquota da natureza, exata (5.000 OPs)', () => {
    const naturezas = { '3.3.90.39.01': 0.24, '3.3.90.39.04': 1.2, '3.3.90.39.15': 2.4, '3.3.90.39.22': 4.8 };
    const codigos = Object.keys(naturezas);
    for (let i = 0; i < 5000; i++) {
      const sub = codigos[inteiro(0, 3)];
      const bruto = inteiro(1, 50_000_000);
      const r = calcularRetencoes({
        brutoCents: bruto, elementoCodigo: '3.3.90.39', subelementoCodigo: sub, config: TRIB.map((c) => pct(c, c === 'iss' ? 5 : 1.5)),
        regras: { '3.3.90.39': ['irrf', 'iss'] }, informados: {}, perfil: 'GESTOR', aliquotasIrrfSubelemento: naturezas,
      });
      conferirFechamento(r, bruto);
      expect(r.itens.irrf).toBe(percentualReferencia(bruto, (naturezas as any)[sub]));
      expect(r.itens.iss).toBe(percentualReferencia(bruto, 5));
    }
  });
});

// ---------------------------------------------------------------- pessoa física
describe('pessoa física (3.3.90.36) — IR progressivo 2026', () => {
  test('IR = conta exata independente, R$ 0 a R$ 15.000 (de 7 em 7 centavos)', { timeout: 120_000 }, () => {
    let anterior = -1;
    for (let bruto = 0; bruto <= 1_500_000; bruto += 7) {
      const inss = inssPessoaFisica(bruto, 11, PARAMETROS_PF_2026);
      expect(inss).toBe(Math.min(percentualReferencia(bruto, 11), 93231));
      const ir = irrfPessoaFisica(bruto, inss, PARAMETROS_PF_2026, FAIXAS_IRRF_2026).irrfCents;
      expect(ir, `bruto ${bruto}`).toBe(irrfPfReferencia(bruto, inss));
      expect(ir, `IR caiu ao subir o bruto (${bruto})`).toBeGreaterThanOrEqual(anterior); // nunca diminui
      anterior = ir;
    }
  });

  test('pontos de virada sem salto: R$ 5.000,00 → 0; logo depois, centavos', () => {
    const ir = (b: number) => irrfPessoaFisica(b, inssPessoaFisica(b, 11, PARAMETROS_PF_2026), PARAMETROS_PF_2026, FAIXAS_IRRF_2026).irrfCents;
    expect(ir(500000)).toBe(0);
    expect(ir(500100)).toBeLessThan(100); // R$ 5.001: menos de R$ 1 de IR
    expect(Math.abs(ir(735001) - ir(735000))).toBeLessThanOrEqual(1); // fim do redutor: contínuo
  });

  test('motor completo da PF fecha o total (5.000 OPs)', () => {
    for (let i = 0; i < 5000; i++) {
      const bruto = inteiro(1, 3_000_000);
      const r = calcularRetencoes({
        brutoCents: bruto, elementoCodigo: '3.3.90.36', config: TRIB.map((c) => pct(c, ({ irrf: 1.5, iss: 5, inss: 11, patronal: 20, sest_senat: 2.5 } as any)[c])),
        regras: { '3.3.90.36': TRIB }, informados: {}, perfil: 'GESTOR',
        pessoaFisica: { parametros: PARAMETROS_PF_2026, faixas: FAIXAS_IRRF_2026, vigencia: '2026-01-01' },
      });
      conferirFechamento(r, bruto);
      expect(r.itens.inss).toBe(Math.min(percentualReferencia(bruto, 11), 93231));
      expect(r.itens.irrf).toBe(irrfPfReferencia(bruto, r.itens.inss));
    }
  });
});

// ---------------------------------------------------------------- transporte
describe('transporte (3.3.90.33)', () => {
  test('OP pequena com expediente maior que o valor: recusada (422), nunca líquido negativo', () => {
    expect(() =>
      calcularTransporteAutonomo({
        brutoCents: 500, elementoCodigo: '3.3.90.33', vigencia: '2026-01-01',
        parametros: { base_percentual: 20, inss_percentual: 11, patronal_percentual: 20, sest_percentual: 1.5, senat_percentual: 1, irrf_tributavel_percentual: 60, desconto_simplificado: 607.2, redutor_constante: 978.62, redutor_coeficiente: 0.133145 },
        faixas: FAIXAS_IRRF_2026, issMunicipio: { nome: 'X', aliquota: 5, taxaExpediente: 15.2 }, municipioCredor: 'X', credorMei: false,
        config: TRIB.map((c) => pct(c, 1)), informados: {}, perfil: 'GESTOR',
      })
    ).toThrow();
  });

  test('fecha o total; SEST+SENAT = soma dos dois arredondados (3.000 OPs)', () => {
    const parametros = {
      base_percentual: 20, inss_percentual: 11, patronal_percentual: 20, sest_percentual: 1.5, senat_percentual: 1,
      irrf_tributavel_percentual: 60, desconto_simplificado: 607.2, redutor_constante: 978.62, redutor_coeficiente: 0.133145,
    };
    const faixas = FAIXAS_IRRF_2026;
    for (let i = 0; i < 3000; i++) {
      // a partir de R$ 100 (abaixo disso a taxa de expediente pode passar do valor: 422, de propósito)
      const bruto = inteiro(10_000, 3_000_000);
      const r = calcularTransporteAutonomo({
        brutoCents: bruto, elementoCodigo: '3.3.90.33', vigencia: '2026-01-01', parametros, faixas,
        issMunicipio: { nome: 'X', aliquota: 5, taxaExpediente: inteiro(0, 2000) / 100 }, municipioCredor: 'X', credorMei: false,
        config: [...TRIB.map((c) => pct(c, 1)), digitado('taxa_bancaria')], informados: {}, perfil: 'GESTOR',
      });
      conferirFechamento(r as any, bruto);
      // base do INSS = 20% do bruto; INSS 11% dela; SEST 1,5% e SENAT 1% arredondados separados
      const base = BigInt(bruto) * 20n; // ×100
      const meio = (num: bigint, den: bigint) => Number((num * 2n + den) / (2n * den));
      expect(r.itens.inss).toBe(meio(base * 11n, 10000n));
      expect(r.itens.sest_senat).toBe(meio(base * 15n, 100000n) + meio(base * 10n, 100000n));
    }
  });
});

// ---------------------------------------------------------------- DARF
describe('DARF', () => {
  test('valor = soma exata dos campos que entram (5.000 casos)', () => {
    for (let i = 0; i < 5000; i++) {
      const valores = { inss: fromCents(inteiro(0, 1e7)), patronal: fromCents(inteiro(0, 1e7)), sest_senat: fromCents(inteiro(0, 1e6)), irrf: fromCents(inteiro(0, 1e6)) };
      const campos = ['inss', 'patronal', 'sest_senat'];
      const { valorCents, detalhe } = calcularDarf(valores, campos);
      expect(valorCents).toBe(toCents(valores.inss) + toCents(valores.patronal) + toCents(valores.sest_senat));
      expect(Object.keys(detalhe)).toEqual(campos);
    }
  });
});
