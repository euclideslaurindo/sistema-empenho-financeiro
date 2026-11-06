// B9 — IR de pessoa jurídica pela natureza do subelemento (3.3.90.39) e
// credor do Simples Nacional: motor, regras da tela e a migration_22.
import fs from 'fs';
import path from 'path';
import { describe, test, expect } from 'vitest';
import { aliquotaIrrfDaNatureza, calcularRetencoes, AVISO_SIMPLES, type EntradaCalculo } from '@/lib/retencoes';
import { estadoCampoOp, rotuloCampoDoElemento } from '@/lib/retencoes-form';
import { simularRetencoes } from '@/lib/retencoes-simulador';
import { lerAliquota, textoAliquota, descreverMudancaAliquota } from '@/components/admin/RetencoesSubelementos';
import type { ConfigRetencaoCampoMapeado } from '@/lib/services/config-retencoes.service';
import { FAIXAS_IRRF_2026, PARAMETROS_PF_2026 } from '../fixtures/pessoa-fisica-2026';

const c = (reais: number) => Math.round(reais * 100);
const CONFIG: ConfigRetencaoCampoMapeado[] = [
  ['irrf', 'IRRF', 1.5, 0], ['iss', 'ISS', 5, 0], ['inss', 'INSS', 11, 1], ['patronal', 'Patronal', 20, 1], ['sest_senat', 'SEST/SENAT', 2.5, 1],
].map(([campo, rotulo, aliquota, entra], i) => ({
  campo: campo as string, rotulo: rotulo as string, tipo: 'PERCENTUAL', aliquota: aliquota as number, calculoAutomatico: true,
  editavelOperador: false, entraDarf: !!entra, ativo: true, ordem: i,
}));
const TODOS = ['irrf', 'iss', 'inss', 'patronal', 'sest_senat'];
// Matriz do 3.3.90.39 depois do ajuste na tela (B9): só IRRF e ISS.
const REGRAS = { '3.3.90.39': ['irrf', 'iss'], '3.3.90.36': TODOS, '3.3.90.30': TODOS };
const ALIQUOTAS = { '3.3.90.39.01': 0.24, '3.3.90.39.04': 1.2, '3.3.90.39.15': 2.4, '3.3.90.39.22': 4.8, '3.3.90.39.28': 4.8 };

function calcular(bruto: number, over: Partial<EntradaCalculo> = {}) {
  return calcularRetencoes({
    brutoCents: c(bruto),
    elementoCodigo: '3.3.90.39',
    config: CONFIG,
    regras: REGRAS,
    informados: {},
    perfil: 'GESTOR',
    aliquotasIrrfSubelemento: ALIQUOTAS,
    ...over,
  });
}

describe('aliquotaIrrfDaNatureza', () => {
  test('só vale para subelemento do próprio elemento', () => {
    expect(aliquotaIrrfDaNatureza('3.3.90.39', '3.3.90.39.22', ALIQUOTAS)).toBe(4.8);
    expect(aliquotaIrrfDaNatureza('3.3.90.30', '3.3.90.39.22', ALIQUOTAS)).toBeUndefined();
    expect(aliquotaIrrfDaNatureza('3.3.90.3', '3.3.90.39.22', ALIQUOTAS)).toBeUndefined(); // prefixo sem o ponto
    expect(aliquotaIrrfDaNatureza('3.3.90.39', '3.3.90.39.99', ALIQUOTAS)).toBeUndefined();
    expect(aliquotaIrrfDaNatureza('3.3.90.39', null, ALIQUOTAS)).toBeUndefined();
    expect(aliquotaIrrfDaNatureza('3.3.90.39', '3.3.90.39.22', undefined)).toBeUndefined();
  });
});

describe('IRRF pela natureza (3.3.90.39) — R$ 10.000,00', () => {
  test.each([
    ['3.3.90.39.01', 24], // 0,24% combustíveis
    ['3.3.90.39.04', 120], // 1,20% alimentação
    ['3.3.90.39.15', 240], // 2,40% passagens
    ['3.3.90.39.22', 480], // 4,80% limpeza
  ])('%s → IRRF %s', (sub: string, irrf: number) => {
    expect(calcular(10000, { subelementoCodigo: sub }).itens.irrf).toBe(c(irrf));
  });

  test('Limpeza: IR 480 + ISS 500 → líquido 9.020; sem INSS, SEST/SENAT nem patronal', () => {
    const r = calcular(10000, { subelementoCodigo: '3.3.90.39.22' });
    expect(r.itens).toMatchObject({ irrf: 48000, iss: 50000, inss: 0, sest_senat: 0, patronal: 0 });
    expect(r.liquidoCents).toBe(c(9020));
  });

  test('sem subelemento (ou sem natureza): 1,5% como sempre', () => {
    expect(calcular(10000).itens.irrf).toBe(15000);
    expect(calcular(10000, { subelementoCodigo: '3.3.90.39.99' }).itens.irrf).toBe(15000);
  });

  test('subelemento de natureza numa NE de outro elemento não vale', () => {
    expect(calcular(10000, { elementoCodigo: '3.3.90.30', subelementoCodigo: '3.3.90.39.22' }).itens.irrf).toBe(15000);
  });

  test('sem o mapa de alíquotas (migration_22 não rodada): idêntico ao de hoje', () => {
    const r = calcular(10000, { subelementoCodigo: '3.3.90.39.22', aliquotasIrrfSubelemento: undefined });
    expect(r.itens.irrf).toBe(15000);
    expect(r.snapshot.irrf_natureza).toBeUndefined();
    expect(r.snapshot.campos.irrf.aliquota).toBe(1.5);
  });

  test('snapshot: alíquota usada e a natureza', () => {
    const s = calcular(10000, { subelementoCodigo: '3.3.90.39.22' }).snapshot;
    expect(s.campos.irrf.aliquota).toBe(4.8);
    expect(s.irrf_natureza).toEqual({ subelemento: '3.3.90.39.22', aliquota: 4.8 });
    expect(s.regra).toBe('v1');
  });

  test('ADMIN sobrescreve; GESTOR não', () => {
    expect(calcular(10000, { subelementoCodigo: '3.3.90.39.22', perfil: 'ADMIN', informados: { irrf: c(1) } }).itens.irrf).toBe(100);
    expect(calcular(10000, { subelementoCodigo: '3.3.90.39.22', informados: { irrf: c(1) } }).itens.irrf).toBe(48000);
  });

  test('regra própria do subelemento sem IRRF: a natureza não cria IR', () => {
    const r = calcular(10000, { subelementoCodigo: '3.3.90.39.22', regrasSubelemento: { '3.3.90.39.22': ['iss'] } });
    expect(r.itens.irrf).toBe(0);
  });
});

describe('credor do Simples Nacional', () => {
  test('IRRF 0, o resto da matriz continua, com aviso', () => {
    const r = calcular(10000, { subelementoCodigo: '3.3.90.39.22', credorSimples: true });
    expect(r.itens).toMatchObject({ irrf: 0, iss: 50000 });
    expect(r.avisos).toContain(AVISO_SIMPLES);
    expect(r.snapshot.simples).toBe(true);
  });

  test('em elemento com as 5 retenções, só o IRRF zera', () => {
    const r = calcular(1000, { elementoCodigo: '3.3.90.30', credorSimples: true });
    expect(r.itens).toMatchObject({ irrf: 0, iss: 5000, inss: 11000, sest_senat: 2500, patronal: 20000 });
  });

  test('Simples + MEI: vale o MEI (tudo zerado, sem o aviso do Simples)', () => {
    const r = calcular(10000, { subelementoCodigo: '3.3.90.39.22', credorSimples: true, credorMei: true });
    expect(r.totalDescontosCents).toBe(0);
    expect(r.avisos).not.toContain(AVISO_SIMPLES);
    expect(r.snapshot.simples).toBeUndefined();
  });

  test('ADMIN ainda pode digitar o IRRF', () => {
    expect(calcular(10000, { credorSimples: true, perfil: 'ADMIN', informados: { irrf: c(50) } }).itens.irrf).toBe(5000);
  });

  test('no 3.3.90.36 (pessoa física) zera o IR progressivo; o INSS continua', () => {
    const r = calcular(5200, {
      elementoCodigo: '3.3.90.36',
      credorSimples: true,
      pessoaFisica: { parametros: PARAMETROS_PF_2026, faixas: FAIXAS_IRRF_2026, vigencia: '2026-01-01' },
    });
    expect(r.itens).toMatchObject({ irrf: 0, inss: 57200 });
  });
});

describe('tela da OP', () => {
  const irrf = CONFIG[0];
  test('rótulo do IRRF com a alíquota da natureza', () => {
    expect(rotuloCampoDoElemento(irrf, '3.3.90.39', '3.3.90.39.22', ALIQUOTAS)).toBe('IRRF (4,8%)');
    expect(rotuloCampoDoElemento(irrf, '3.3.90.39', '3.3.90.39.01', ALIQUOTAS)).toBe('IRRF (0,24%)');
    expect(rotuloCampoDoElemento(irrf, '3.3.90.39', null, ALIQUOTAS)).toBe('IRRF (1,5%)');
    expect(rotuloCampoDoElemento(irrf, '3.3.90.36', '3.3.90.36.08', ALIQUOTAS)).toBe('IRRF (tabela progressiva)');
    expect(rotuloCampoDoElemento(CONFIG[1], '3.3.90.39', '3.3.90.39.22', ALIQUOTAS)).toBe('ISS (5%)');
  });

  test('Simples: o IRRF mostra a dica de isento; os outros campos não mudam', () => {
    const mei = { credorMei: false, sobrescreverMei: false, credorSimples: true };
    expect(estadoCampoOp(irrf, '3.3.90.39', REGRAS, 'GESTOR', mei).dica).toBe('Isento de IR (Simples Nacional)');
    expect(estadoCampoOp(CONFIG[1], '3.3.90.39', REGRAS, 'GESTOR', mei).dica).toBeNull();
    // IRRF que não se aplica continua "Não se aplica"
    expect(estadoCampoOp(irrf, '3.3.90.14', { '3.3.90.14': [] }, 'GESTOR', mei).dica).toBe('Não se aplica a 3.3.90.14');
  });
});

describe('simulador e campo de alíquota do admin', () => {
  const campos = CONFIG.map((x) => ({ ...x, aliquota: String(x.aliquota).replace('.', ',') }));
  test('simulador usa a alíquota da natureza no IRRF', () => {
    const r = simularRetencoes({ brutoReais: 10000, regrasElemento: ['irrf', 'iss'], camposConfig: campos, aliquotaIrrf: 4.8 });
    expect(r.itensCents.irrf).toBe(48000);
    expect(r.liquidoCents).toBe(c(9020));
    expect(simularRetencoes({ brutoReais: 10000, regrasElemento: ['irrf'], camposConfig: campos }).itensCents.irrf).toBe(15000);
  });

  test('lerAliquota / textoAliquota / confirmação', () => {
    expect(lerAliquota('4,8')).toBe(4.8);
    expect(lerAliquota('0,24')).toBe(0.24);
    expect(lerAliquota('')).toBeNull();
    expect(lerAliquota('101')).toBe('invalida');
    expect(lerAliquota('abc')).toBe('invalida');
    expect(textoAliquota(0.24)).toBe('0,24');
    expect(textoAliquota(null)).toBe('');
    expect(descreverMudancaAliquota('3.3.90.39.22', null, 4.8)).toBe('3.3.90.39.22: alíquota padrão do IRRF → IRRF de 4,8%');
  });
});

describe('migration_22', () => {
  const sql = fs.readFileSync(path.join(process.cwd(), 'database', 'migration_22.sql'), 'utf8');
  const ativo = sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');

  const subelementos = [...sql.matchAll(/\('(3\.3\.90\.39\.\d{2})', '3\.3\.90\.39', '([^']+)', (\d+)\)/g)].map((m) => ({
    codigo: m[1], descricao: m[2], ordem: Number(m[3]),
  }));
  const aliquotas = Object.fromEntries([...sql.matchAll(/\('(3\.3\.90\.39\.\d{2})', ([\d.]+)\)/g)].map((m) => [m[1], Number(m[2])]));

  test('28 subelementos .01 a .28, em ordem, sem repetir', () => {
    expect(subelementos).toHaveLength(28);
    expect(subelementos.map((s) => s.codigo)).toEqual(Array.from({ length: 28 }, (_, i) => `3.3.90.39.${String(i + 1).padStart(2, '0')}`));
    expect(subelementos.map((s) => s.ordem)).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
    expect(subelementos.every((s) => s.descricao.length <= 250)).toBe(true);
  });

  test('alíquotas da tabela: 3 × 0,24 · 11 × 1,20 · 3 × 2,40 · 11 × 4,80, uma por subelemento', () => {
    expect(Object.keys(aliquotas)).toEqual(subelementos.map((s) => s.codigo));
    const contagem: Record<string, number> = {};
    for (const v of Object.values(aliquotas)) contagem[v] = (contagem[v] ?? 0) + 1;
    expect(contagem).toEqual({ 0.24: 3, 1.2: 11, 2.4: 3, 4.8: 11 });
    expect(aliquotas['3.3.90.39.22']).toBe(4.8); // Limpeza
    expect(aliquotas['3.3.90.39.12']).toBe(1.2); // Mercadorias e bens em geral
    expect(aliquotas['3.3.90.39.28']).toBe(4.8); // Demais serviços
    const desc = (cod: string) => subelementos.find((s) => s.codigo === cod)!.descricao;
    expect(desc('3.3.90.39.22')).toBe('Limpeza');
    expect(desc('3.3.90.39.28')).toBe('Demais serviços');
  });

  test('aditiva: INSERT IGNORE, CREATE IF NOT EXISTS e ADD COLUMN protegido; nada removido', () => {
    expect(ativo).toMatch(/INSERT IGNORE INTO subelementos_despesa/);
    expect(ativo).toMatch(/INSERT IGNORE INTO subelemento_irrf/);
    expect(ativo).toMatch(/CREATE TABLE IF NOT EXISTS subelemento_irrf/);
    expect(ativo).toMatch(/COLUMN_NAME = 'is_simples'/);
    expect(ativo).toMatch(/IF\(@existe = 0,\s*'ALTER TABLE credores ADD COLUMN is_simples TINYINT\(1\) NOT NULL DEFAULT 0'/);
    expect(ativo.replace(/ON UPDATE CURRENT_TIMESTAMP/g, '')).not.toMatch(/\b(DROP|TRUNCATE|UPDATE|DELETE|RENAME)\b/i);
    expect(ativo.match(/ALTER TABLE/g)).toHaveLength(1);
  });
});
