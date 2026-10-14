// T28 — Conformidade do cálculo do 3.3.90.33 com a planilha EJA Campo
// (5ª parcela/2026, NE 28925, aba Total). Passa pelo serviço
// (calcularRetencoesDaOp) com o banco simulado e o seed da migration_16, para
// cobrir também a busca do município, a vigência e o MEI do cadastro.
import { describe, test, expect, vi, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('@/lib/db', () => ({ query: vi.fn(), withTransaction: vi.fn() }));

import { query } from '@/lib/db';
import { calcularRetencoesDaOp } from '@/lib/services/calculo-op.service';
import fixture from '../fixtures/eja-campo-5a-parcela.json';
import fixtureDocs from '../../docs/projeto-retencoes-v2/fixtures/eja-campo-5a-parcela.json';
import {
  FAIXAS_SEED,
  MUNICIPIOS_SEED,
  PARAMETROS_SEED,
  responderCalculoTransporte,
  type CredorSimulado,
} from '../fixtures/seed-transporte';

type Linha = (typeof fixture.linhas)[number] & { divergenciaConhecida?: boolean };
const LINHAS = fixture.linhas as Linha[];
const CAMPOS = ['irrf', 'iss', 'inss', 'patronal', 'sest', 'senat', 'liquido'] as const;
type Campo = (typeof CAMPOS)[number];
const RETENCOES = CAMPOS.filter((c) => c !== 'liquido');
const cents = (reais: number) => Math.round(reais * 100);

/** O credor como o cadastro devolve. Na T33, o município passa a vir de `municipioExpediente`. */
const credorDaLinha = (l: Linha): CredorSimulado => ({ cidade: l.municipio, uf: 'PE', is_mei: l.isento ? 1 : 0 });

const tipo = (l: Linha) => (l.isento ? 'isenta' : l.divergenciaConhecida ? 'divergente' : 'exata');

/** Calcula a linha pelo serviço e devolve cada valor em centavos. */
async function calcularLinha(l: Linha): Promise<Record<Campo, number>> {
  (query as any).mockImplementation(async (sql: string) => responderCalculoTransporte(sql, credorDaLinha(l)));
  const { resultado } = await calcularRetencoesDaOp(undefined, {
    brutoCents: cents(l.bruto),
    elementoCodigo: '3.3.90.33',
    credorCpfCnpj: `000.000.000-${l.id.slice(-2)}`,
    dataPagamento: fixture.vigencia,
    informados: {},
    perfilUsuario: 'GESTOR',
  });
  const s = resultado.snapshot as any;
  return {
    irrf: resultado.itens.irrf ?? 0,
    iss: resultado.itens.iss ?? 0,
    inss: resultado.itens.inss ?? 0,
    patronal: resultado.itens.patronal ?? 0,
    sest: cents(s.sest),
    senat: cents(s.senat),
    liquido: resultado.liquidoCents,
  };
}

const diferencas = (l: Linha, r: Record<Campo, number>) =>
  Object.fromEntries(CAMPOS.map((c) => [c, r[c] - cents((l.esperado as any)[c])])) as Record<Campo, number>;

const calculado = new Map<string, Record<Campo, number>>();
beforeAll(async () => {
  for (const l of LINHAS) calculado.set(l.id, await calcularLinha(l));
});

describe('fixture da planilha EJA Campo', () => {
  test('a cópia em tests/fixtures é idêntica à da documentação', () => {
    expect(fixture).toEqual(fixtureDocs);
  });

  test('91 linhas: 63 exatas + 5 com divergência conhecida + 23 isentas', () => {
    expect(LINHAS).toHaveLength(91);
    expect(LINHAS.filter((l) => tipo(l) === 'exata')).toHaveLength(63);
    expect(LINHAS.filter((l) => tipo(l) === 'divergente').map((l) => l.id)).toEqual([
      'motorista-16',
      'motorista-25',
      'motorista-30',
      'motorista-81',
      'motorista-83',
    ]);
    expect(LINHAS.filter((l) => tipo(l) === 'isenta')).toHaveLength(23);
  });

  test('a soma das linhas é igual aos totais da planilha', () => {
    const totais = fixture.totaisPlanilha as Record<string, number>;
    expect(LINHAS.reduce((t, l) => t + cents(l.bruto), 0)).toBe(cents(totais.bruto));
    for (const c of CAMPOS) {
      expect(LINHAS.reduce((t, l) => t + cents((l.esperado as any)[c]), 0), c).toBe(cents(totais[c]));
    }
  });

  test('sem dados pessoais: só id anônimo, município e valores', () => {
    const permitidos = new Set(['id', 'municipio', 'bruto', 'isento', 'esperado', 'divergenciaConhecida']);
    for (const l of LINHAS) {
      expect(Object.keys(l).filter((k) => !permitidos.has(k)), l.id).toEqual([]);
      expect(l.id).toMatch(/^motorista-\d{2}$/);
    }
  });

  test('o seed usado no teste é o da migration_16', () => {
    const sql = fs.readFileSync(path.join(process.cwd(), 'database', 'migration_16.sql'), 'utf8');

    const parametros = Object.fromEntries(
      [...sql.matchAll(/\('TRANSPORTE_AUTONOMO',\s*'(\w+)',\s*([\d.]+),\s*'2026-01-01'\)/g)].map((m) => [m[1], Number(m[2])])
    );
    expect(parametros).toEqual(Object.fromEntries(Object.entries(PARAMETROS_SEED).map(([k, v]) => [k, Number(v)])));

    const faixas = [...sql.matchAll(/\('2026-01-01',\s*(\d+),\s*(NULL|[\d.]+),\s*([\d.]+),\s*([\d.]+)\)/g)].map((m) => [
      Number(m[1]),
      m[2] === 'NULL' ? null : Number(m[2]),
      Number(m[3]),
      Number(m[4]),
    ]);
    expect(faixas).toEqual(
      FAIXAS_SEED.map((f) => [f.ordem, f.limite_ate === null ? null : Number(f.limite_ate), Number(f.aliquota), Number(f.parcela_deduzir)])
    );

    const municipios = [...sql.matchAll(/\('([^']+)',\s*'([^']+)',\s*'PE',\s*([\d.]+),\s*([\d.]+),\s*(NULL|'[^']*')\)/g)].map((m) => [
      m[1],
      m[2],
      Number(m[3]),
      Number(m[4]),
      m[5] === 'NULL' ? null : m[5].slice(1, -1),
    ]);
    expect(municipios).toEqual(
      MUNICIPIOS_SEED.map((m) => [m.chave, m.nome, Number(m.aliquota), Number(m.taxa_expediente), m.apelidos])
    );
  });
});

describe('cálculo do 3.3.90.33 × planilha, motorista a motorista', () => {
  test.each(LINHAS.map((l) => [l.id, tipo(l), l] as [string, string, Linha]))('%s (%s)', (_id: string, tipoLinha: string, l: Linha) => {
    const r = calculado.get(l.id)!;
    const dif = diferencas(l, r);
    if (tipoLinha === 'exata') {
      expect(dif).toEqual(Object.fromEntries(CAMPOS.map((c) => [c, 0])));
    } else if (tipoLinha === 'divergente') {
      for (const c of CAMPOS) expect(Math.abs(dif[c]), c).toBeLessThanOrEqual(1);
    } else {
      for (const c of RETENCOES) expect(r[c], c).toBe(0);
      expect(r.liquido).toBe(cents(l.bruto));
    }
  });
});

describe('resultado do conjunto', () => {
  test('as linhas com diferença são exatamente as 5 marcadas como divergência conhecida', () => {
    const comDiferenca = LINHAS.filter((l) => Object.values(diferencas(l, calculado.get(l.id)!)).some((d) => d !== 0)).map((l) => l.id);
    const marcadas = LINHAS.filter((l) => l.divergenciaConhecida).map((l) => l.id);
    // Se mudar, a fórmula ou um parâmetro mudou: rever e atualizar o fixture conscientemente.
    expect(comDiferenca).toEqual(marcadas);
  });

  test('totais do sistema dentro de 5 centavos dos totais da planilha', () => {
    const totais = fixture.totaisPlanilha as Record<string, number>;
    const resumo: string[] = [];
    for (const c of CAMPOS) {
      const soma = LINHAS.reduce((t, l) => t + calculado.get(l.id)![c], 0);
      const dif = soma - cents(totais[c]);
      resumo.push(`${c} ${dif >= 0 ? '+' : ''}${dif}`);
      expect(Math.abs(dif), c).toBeLessThanOrEqual(5);
    }
    const divergentes = LINHAS.filter((l) => tipo(l) === 'divergente').map((l) => l.id);
    console.info(
      `EJA Campo: 63 exatas, ${divergentes.length} com 1 centavo (${divergentes.join(', ')}), 23 isentas. ` +
        `Diferença nos totais (centavos): ${resumo.join(' · ')}`
    );
  });
});
