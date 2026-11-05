// B8 — IRRF progressivo 2026 da pessoa física (3.3.90.36): cálculo puro, o
// motor padrão com `pessoaFisica`, os seeds da migration_21 e a validação dos
// parâmetros da tela do admin.
import fs from 'fs';
import path from 'path';
import { describe, test, expect } from 'vitest';
import { inssPessoaFisica, irrfPessoaFisica, CHAVES_PESSOA_FISICA } from '@/lib/irrf-pessoa-fisica';
import { calcularRetencoes, type EntradaCalculo } from '@/lib/retencoes';
import { diffParametros, validarParametrosTransporte } from '@/lib/transporte-admin';
import type { ConfigRetencaoCampoMapeado } from '@/lib/services/config-retencoes.service';
import { FAIXAS_IRRF_2026, PARAMETROS_PF_2026 } from '../fixtures/pessoa-fisica-2026';

const c = (reais: number) => Math.round(reais * 100);
const irrf = (bruto: number, inss = inssPessoaFisica(c(bruto), 11, PARAMETROS_PF_2026)) =>
  irrfPessoaFisica(c(bruto), inss, PARAMETROS_PF_2026, FAIXAS_IRRF_2026);

describe('inssPessoaFisica — 11% do bruto, com teto', () => {
  test.each([
    [4000, 440],
    [5000, 550],
    [5200, 572],
    [7000, 770],
    [8475.55, 932.31], // 11% de 8.475,55 = 932,3105 → 932,31 (= teto)
    [10000, 932.31],
    [0, 0],
  ])('bruto %s → INSS %s', (bruto: number, esperado: number) => {
    expect(inssPessoaFisica(c(bruto), 11, PARAMETROS_PF_2026)).toBe(c(esperado));
  });

  test('a alíquota vem da config (não é fixa em 11%)', () => {
    expect(inssPessoaFisica(c(1000), 12, PARAMETROS_PF_2026)).toBe(c(120));
  });
});

describe('irrfPessoaFisica — documento "IR 2026"', () => {
  test('exemplo do documento: R$ 5.200,00 → IR R$ 71,63', () => {
    const r = irrf(5200);
    expect(r.deducao).toBe(607.2); // 572 < 607,20 → usa o desconto simplificado
    expect(r.base).toBe(4592.8);
    expect(r.irrfTabela).toBe(357.89); // 4.592,80 × 22,5% − 675,49
    expect(r.redutor).toBe(286.256); // 978,61 − 0,133145 × 5.200
    expect(r.irrfCents).toBe(7163);
    expect(r.isento).toBe(false);
  });

  test.each([
    // bruto, IR esperado
    [4000, 0],
    [5000, 0], // isento — o redutor sozinho deixaria R$ 0,01 (312,89 − 312,885)
    [5000.01, 0.01],
    [5200, 71.63],
    [7000, 757.93], // dedução 770 (INSS > 607,20): 6.230 × 27,5% − 908,73 − 46,595
    [7350, 890.18], // redutor = máx(0; 978,61 − 978,61575) = 0
    [7350.01, 890.19], // sem redutor (acima do limite)
    [10000, 1584.88], // INSS no teto: base 9.067,69
  ])('bruto %s → IR %s', (bruto: number, esperado: number) => {
    expect(irrf(bruto).irrfCents).toBe(c(esperado));
  });

  test('até o limite da isenção: IR 0 e marcado isento', () => {
    expect(irrf(5000)).toMatchObject({ irrfCents: 0, isento: true, redutor: 0 });
    expect(irrf(1).isento).toBe(true);
  });

  test('dedução = máx(INSS retido; desconto simplificado)', () => {
    expect(irrf(7000).deducao).toBe(770);
    expect(irrf(7000, 0).deducao).toBe(607.2); // sem INSS retido
    expect(irrf(10000).deducao).toBe(932.31);
  });

  test('base nunca negativa; bruto 0', () => {
    expect(irrf(100, 0)).toMatchObject({ base: 0, irrfTabela: 0, irrfCents: 0 });
    expect(irrf(0, 0).irrfCents).toBe(0);
  });

  test('bruto inválido → 422', () => {
    expect(() => irrfPessoaFisica(-1, 0, PARAMETROS_PF_2026, FAIXAS_IRRF_2026)).toThrow();
    expect(() => irrfPessoaFisica(10.5, 0, PARAMETROS_PF_2026, FAIXAS_IRRF_2026)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Motor padrão com pessoaFisica
// ---------------------------------------------------------------------------
const CONFIG: ConfigRetencaoCampoMapeado[] = [
  ['irrf', 'IRRF', 1.5, 0], ['iss', 'ISS', 5, 0], ['inss', 'INSS', 11, 1], ['patronal', 'Patronal', 20, 1], ['sest_senat', 'SEST/SENAT', 2.5, 1],
].map(([campo, rotulo, aliquota, entra], i) => ({
  campo: campo as string, rotulo: rotulo as string, tipo: 'PERCENTUAL', aliquota: aliquota as number, calculoAutomatico: true,
  editavelOperador: false, entraDarf: !!entra, ativo: true, ordem: i,
}));
const TODOS = ['irrf', 'iss', 'inss', 'patronal', 'sest_senat'];
const PF = { parametros: PARAMETROS_PF_2026, faixas: FAIXAS_IRRF_2026, vigencia: '2026-01-01', vigenciaIrrf: '2026-01-01' };

function calcular(bruto: number, over: Partial<EntradaCalculo> = {}) {
  return calcularRetencoes({
    brutoCents: c(bruto),
    elementoCodigo: '3.3.90.36',
    config: CONFIG,
    regras: { '3.3.90.36': TODOS, '3.3.90.39': TODOS },
    informados: {},
    perfil: 'GESTOR',
    pessoaFisica: PF,
    ...over,
  });
}

describe('calcularRetencoes com pessoaFisica (3.3.90.36)', () => {
  test('R$ 5.200,00: INSS 572, IRRF 71,63; ISS, SEST/SENAT e patronal como sempre', () => {
    const r = calcular(5200);
    expect(r.itens).toMatchObject({ irrf: 7163, inss: 57200, iss: 26000, sest_senat: 13000, patronal: 104000 });
    expect(r.totalDescontosCents).toBe(7163 + 57200 + 26000 + 13000);
    expect(r.liquidoCents).toBe(c(5200) - r.totalDescontosCents);
  });

  test('R$ 4.000,00: isento de IRRF, INSS 440', () => {
    expect(calcular(4000).itens).toMatchObject({ irrf: 0, inss: 44000 });
  });

  test('R$ 10.000,00: INSS no teto (932,31)', () => {
    expect(calcular(10000).itens).toMatchObject({ inss: 93231, irrf: 158488 });
  });

  test('snapshot: perfil, vigências e detalhes do IR; IRRF sem alíquota fixa', () => {
    const s = calcular(5200).snapshot;
    expect(s).toMatchObject({
      perfil: 'PESSOA_FISICA', vigencia: '2026-01-01', vigencia_irrf: '2026-01-01', regra: 'pf-2026-v1',
      base_irrf: 4592.8, deducao_irrf: 607.2, irrf_tabela: 357.89, redutor: 286.256, isento_irrf: false,
      elemento: '3.3.90.36', origemRegra: 'elemento',
    });
    expect(s.campos.irrf.aliquota).toBeNull();
    expect(s.campos.inss.aliquota).toBe(11);
  });

  test('sem pessoaFisica: idêntico ao de sempre (1,5% de IRRF, INSS sem teto)', () => {
    const r = calcular(10000, { pessoaFisica: undefined, elementoCodigo: '3.3.90.39' });
    expect(r.itens).toMatchObject({ irrf: 15000, inss: 110000 });
    expect(r.snapshot.perfil).toBeUndefined();
    expect(r.snapshot.regra).toBe('v1');
  });

  test('estagiário (3.3.90.36.08) com regra vazia: nada retido', () => {
    const r = calcular(5200, { subelementoCodigo: '3.3.90.36.08', regrasSubelemento: { '3.3.90.36.08': [] } });
    expect(r.totalDescontosCents).toBe(0);
    expect(r.snapshot.base_irrf).toBeUndefined();
  });

  test('subelemento só com IRRF: a dedução é o desconto simplificado (INSS não retido)', () => {
    const r = calcular(7000, { subelementoCodigo: '3.3.90.36.08', regrasSubelemento: { '3.3.90.36.08': ['irrf'] } });
    expect(r.itens.inss).toBe(0);
    expect(r.snapshot.deducao_irrf).toBe(607.2);
    // base 6.392,80 × 27,5% − 908,73 = 849,29; − redutor 46,595 = 802,695 → 802,70
    expect(r.itens.irrf).toBe(80270);
  });

  test('MEI: tudo zerado, como sempre', () => {
    const r = calcular(5200, { credorMei: true });
    expect(r.totalDescontosCents).toBe(0);
    expect(r.avisos).toContain('Credor MEI: isento de retenções.');
  });

  test('ADMIN sobrescreve o INSS: a dedução do IR segue o INSS final', () => {
    const r = calcular(7000, { perfil: 'ADMIN', informados: { inss: c(900) } });
    expect(r.itens.inss).toBe(c(900));
    expect(r.snapshot.deducao_irrf).toBe(900);
    // base 6.100 × 27,5% − 908,73 = 768,77; − 46,595 = 722,175 → 722,18
    expect(r.itens.irrf).toBe(72218);
  });

  test('ADMIN sobrescreve o IRRF: vale o digitado', () => {
    const r = calcular(5200, { perfil: 'ADMIN', informados: { irrf: c(10) } });
    expect(r.itens.irrf).toBe(1000);
    expect(r.snapshot.base_irrf).toBeUndefined();
  });

  test('GESTOR não sobrescreve o cálculo automático', () => {
    expect(calcular(5200, { informados: { irrf: c(10), inss: c(1) } }).itens).toMatchObject({ irrf: 7163, inss: 57200 });
  });

  test('IRRF inativo na config: 0, e o INSS continua com teto', () => {
    const config = CONFIG.map((x) => (x.campo === 'irrf' ? { ...x, ativo: false } : x));
    expect(calcular(10000, { config }).itens).toMatchObject({ irrf: 0, inss: 93231 });
  });
});

// ---------------------------------------------------------------------------
// Seeds e validação
// ---------------------------------------------------------------------------
describe('migration_21', () => {
  const sql = fs.readFileSync(path.join(process.cwd(), 'database', 'migration_21.sql'), 'utf8');

  test('seeds = os parâmetros usados nos testes (978,61 do documento)', () => {
    const seeds = Object.fromEntries(
      [...sql.matchAll(/\('PESSOA_FISICA',\s*'(\w+)',\s*([\d.]+),\s*'2026-01-01'\)/g)].map((m) => [m[1], Number(m[2])])
    );
    expect(seeds).toEqual(Object.fromEntries(Object.entries(PARAMETROS_PF_2026).map(([k, v]) => [k, Number(v)])));
    expect(Object.keys(seeds).sort()).toEqual([...CHAVES_PESSOA_FISICA].sort());
    expect(seeds.redutor_constante).toBe(978.61);
  });

  test('só aditiva: INSERT IGNORE, sem DDL nem UPDATE/DELETE fora do rollback comentado', () => {
    const ativo = sql
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n');
    expect(ativo).toMatch(/INSERT IGNORE INTO calculo_parametros/);
    expect(ativo).not.toMatch(/\b(DROP|ALTER|TRUNCATE|UPDATE|DELETE|CREATE)\b/i);
  });
});

describe('validação dos parâmetros da pessoa física (admin)', () => {
  // Como a tela manda (paraCampo: "932,31") e como o servidor recebe (números).
  const ok: Record<string, string | number> = {
    inss_teto: '932,31', desconto_simplificado: '607,2', isencao_ate: '5000', redutor_ate: '7350',
    redutor_constante: '978,61', redutor_coeficiente: '0,133145',
  };
  const numeros = Object.fromEntries(Object.entries(PARAMETROS_PF_2026).map(([k, v]) => [k, Number(v)]));

  test('o que o servidor recebe (números) também é válido', () => {
    expect(validarParametrosTransporte(numeros, 'PESSOA_FISICA')).toEqual([]);
  });

  test('seeds são válidos', () => {
    expect(validarParametrosTransporte(ok, 'PESSOA_FISICA')).toEqual([]);
  });

  test('vazio, negativo e isenção >= limite do redutor são recusados', () => {
    expect(validarParametrosTransporte({ ...ok, inss_teto: '' }, 'PESSOA_FISICA').join(' ')).toContain('Teto do INSS');
    expect(validarParametrosTransporte({ ...ok, redutor_constante: '-1' }, 'PESSOA_FISICA').join(' ')).toContain('negativo');
    expect(validarParametrosTransporte({ ...ok, isencao_ate: '7350' }, 'PESSOA_FISICA')).toEqual([
      'O limite do redutor deve ser maior que o limite da isenção.',
    ]);
  });

  test('valores em reais aceitam o formato BR', () => {
    expect(validarParametrosTransporte({ ...ok, isencao_ate: '5.000,00', redutor_ate: '7.350,00' }, 'PESSOA_FISICA')).toEqual([]);
  });

  test('diff com os rótulos da pessoa física', () => {
    expect(diffParametros(ok, { ...ok, redutor_constante: '978,62' }, 'PESSOA_FISICA')).toEqual([
      'Redutor — constante (R$): 978,61 → 978,62',
    ]);
  });

  test('o transporte continua validando só as chaves dele', () => {
    expect(validarParametrosTransporte(ok).length).toBeGreaterThan(0);
  });
});
