// B12 — taxas personalizadas ("x_…") criadas pelo ADMIN: motor, schemas,
// helpers da tela, DARF, impressão e a migration_25.
import fs from 'fs';
import path from 'path';
import { describe, test, expect } from 'vitest';
import { calcularRetencoes, ehTaxaExtra, slugTaxaExtra, type EntradaCalculo } from '@/lib/retencoes';
import { calcularTransporteAutonomo } from '@/lib/retencoes-transporte';
import { configRetencaoCampoSchema, configRetencoesSchema } from '@/lib/schemas';
import { camposDoTexto } from '@/lib/services/config-retencoes.service';
import { montarInformados } from '@/lib/services/ordem-pagamento-core';
import {
  camposExtrasDaConfig,
  colunasDaMatriz,
  ehCampoRetencao,
  estadoCampoOp,
  nomeFormDoCampo,
  somarDescontosCents,
  valoresCalculadosDoForm,
} from '@/lib/retencoes-form';
import { montarPayloadLote, linhaDoCredor } from '@/lib/op-emissao';
import { calcularDarf, entraDarfDaConfig } from '@/lib/services/darf.service';
import { linhasDescontoDaOp, valoresExtrasDaOp } from '@/lib/impressao-op';
import type { ConfigRetencaoCampoMapeado } from '@/lib/services/config-retencoes.service';

const c = (reais: number) => Math.round(reais * 100);
const pct = (campo: string, rotulo: string, aliquota: number, ordem: number, extra: Partial<ConfigRetencaoCampoMapeado> = {}) => ({
  campo, rotulo, tipo: 'PERCENTUAL', aliquota, calculoAutomatico: true, editavelOperador: false, entraDarf: false, ativo: true, ordem, ...extra,
});
const AMBIENTAL = pct('x_taxa_ambiental', 'Taxa Ambiental', 2, 90, { entraDarf: true });
const CONTRIB: ConfigRetencaoCampoMapeado = {
  campo: 'x_contribuicao', rotulo: 'Contribuição', tipo: 'VALOR_DIGITADO', aliquota: null, calculoAutomatico: false,
  editavelOperador: true, entraDarf: false, ativo: true, ordem: 95,
};
const FIXOS: ConfigRetencaoCampoMapeado[] = [
  pct('irrf', 'IRRF', 1.5, 10), pct('iss', 'ISS', 5, 20), pct('inss', 'INSS', 11, 30, { entraDarf: true }),
  pct('patronal', 'Patronal', 20, 40, { entraDarf: true }), pct('sest_senat', 'SEST/SENAT', 2.5, 50, { entraDarf: true }),
];
const CONFIG = [...FIXOS, AMBIENTAL, CONTRIB];
const REGRAS = { '3.3.90.39': ['irrf', 'iss', 'x_taxa_ambiental'], '3.3.90.30': ['irrf', 'inss'] };

const calcular = (over: Partial<EntradaCalculo> = {}) =>
  calcularRetencoes({ brutoCents: c(1000), elementoCodigo: '3.3.90.39', config: CONFIG, regras: REGRAS, informados: {}, perfil: 'GESTOR', ...over });

describe('identificação e slug', () => {
  test('slug a partir do rótulo', () => {
    expect(slugTaxaExtra('Taxa Ambiental')).toBe('x_taxa_ambiental');
    expect(slugTaxaExtra('  Contribuição (Mun.) ')).toBe('x_contribuicao_mun');
    expect(slugTaxaExtra('???')).toBe('');
    expect(slugTaxaExtra('a'.repeat(60))).toHaveLength(30);
  });
  test('ehTaxaExtra', () => {
    expect(ehTaxaExtra('x_taxa_ambiental')).toBe(true);
    expect(ehTaxaExtra('irrf')).toBe(false);
    expect(ehTaxaExtra('x_')).toBe(false);
    expect(ehTaxaExtra('x_TAXA')).toBe(false);
  });
});

describe('motor', () => {
  test('percentual pela Matriz: 2% de 1.000 = 20 no total e no líquido', () => {
    const r = calcular();
    expect(r.itens.x_taxa_ambiental).toBe(2000);
    expect(r.totalDescontosCents).toBe(1500 + 5000 + 2000);
    expect(r.liquidoCents).toBe(c(1000) - 8500);
    expect(r.snapshot.campos.x_taxa_ambiental).toMatchObject({ rotulo: 'Taxa Ambiental', aliquota: 2, aplica: true, valor: 20 });
  });

  test('fora da Matriz: 0 e aplica=false no snapshot', () => {
    const r = calcular({ elementoCodigo: '3.3.90.30' });
    expect(r.itens.x_taxa_ambiental).toBe(0);
    expect(r.snapshot.campos.x_taxa_ambiental.aplica).toBe(false);
  });

  test('regra própria do subelemento manda', () => {
    const r = calcular({ elementoCodigo: '3.3.90.30', subelementoCodigo: '3.3.90.30.01', regrasSubelemento: { '3.3.90.30.01': ['x_taxa_ambiental'] } });
    expect(r.itens).toMatchObject({ x_taxa_ambiental: 2000, irrf: 0 });
  });

  test('MEI zera a percentual; a digitada fica', () => {
    const r = calcular({ credorMei: true, informados: { x_contribuicao: c(7) } });
    expect(r.itens).toMatchObject({ x_taxa_ambiental: 0, x_contribuicao: 700 });
  });

  test('sobrescrita: ADMIN pode, GESTOR não (se não for editável)', () => {
    expect(calcular({ perfil: 'ADMIN', informados: { x_taxa_ambiental: c(5) } }).itens.x_taxa_ambiental).toBe(500);
    expect(calcular({ informados: { x_taxa_ambiental: c(5) } }).itens.x_taxa_ambiental).toBe(2000);
  });

  test('digitada: entra no total; inativa = 0', () => {
    expect(calcular({ informados: { x_contribuicao: c(7) } }).liquidoCents).toBe(c(1000) - 8500 - 700);
    const inativa = CONFIG.map((x) => (x.campo === 'x_contribuicao' ? { ...x, ativo: false } : x));
    expect(calcular({ config: inativa, informados: { x_contribuicao: c(7) } }).itens.x_contribuicao).toBe(0);
  });

  test('sem nenhuma "x_" na config: resultado idêntico ao de antes', () => {
    const a = calcularRetencoes({ brutoCents: c(1000), elementoCodigo: '3.3.90.39', config: FIXOS, regras: REGRAS, informados: {}, perfil: 'GESTOR' });
    expect(Object.keys(a.itens).some((k) => k.startsWith('x_'))).toBe(false);
    expect(a.totalDescontosCents).toBe(6500);
  });

  test('transporte: a digitada entra; a percentual segue a Matriz do 3.3.90.33', () => {
    const base = {
      brutoCents: c(1000), elementoCodigo: '3.3.90.33', vigencia: '2026-01-01',
      parametros: { base_percentual: 20, inss_percentual: 11, patronal_percentual: 20, sest_percentual: 1.5, senat_percentual: 1,
        irrf_tributavel_percentual: 60, desconto_simplificado: 607.2, redutor_constante: 978.62, redutor_coeficiente: 0.133145 },
      faixas: [{ ordem: 1, limiteAte: null, aliquota: 0, parcelaDeduzir: 0 }], issMunicipio: null, municipioCredor: null, credorMei: false,
      config: CONFIG, informados: { x_contribuicao: c(3) }, perfil: 'GESTOR' as const,
    };
    const sem = calcularTransporteAutonomo(base);
    expect(sem.itens).toMatchObject({ x_contribuicao: 300, x_taxa_ambiental: 0 });
    const com = calcularTransporteAutonomo({ ...base, camposAplicaveis: ['x_taxa_ambiental'] });
    expect(com.itens.x_taxa_ambiental).toBe(2000);
    expect(com.totalDescontosCents).toBe(sem.totalDescontosCents + 2000);
  });
});

describe('schemas e config', () => {
  const linha = (over: object = {}) => ({ ...AMBIENTAL, ...over });
  test('campo x_ válido; inválido recusado', () => {
    expect(configRetencaoCampoSchema.safeParse(linha()).success).toBe(true);
    expect(configRetencaoCampoSchema.safeParse(linha({ campo: 'x_Taxa' })).success).toBe(false);
    expect(configRetencaoCampoSchema.safeParse(linha({ campo: 'qualquer' })).success).toBe(false);
  });
  test('DARF: percentual "x_" pode; digitada não', () => {
    expect(configRetencaoCampoSchema.safeParse(linha({ entraDarf: true })).success).toBe(true);
    expect(configRetencaoCampoSchema.safeParse({ ...CONTRIB, entraDarf: true }).success).toBe(false);
  });
  test('Matriz aceita "x_"', () => {
    expect(configRetencoesSchema.safeParse({ campos: [linha()], regras: { '3.3.90.39': ['irrf', 'x_taxa_ambiental'] } }).success).toBe(true);
    expect(configRetencoesSchema.safeParse({ campos: [linha()], regras: { '3.3.90.39': ['taxa_pix'] } }).success).toBe(false);
  });
  test('camposDoTexto mantém as "x_" depois dos fixos', () => {
    expect(camposDoTexto('x_b, iss, x_a,irrf, lixo')).toEqual(['irrf', 'iss', 'x_b', 'x_a']);
  });
  test('montarInformados lê `extras`', () => {
    expect(montarInformados({ irrf: 1, extras: { x_contribuicao: 7 } })).toEqual({ irrf: 100, x_contribuicao: 700 });
  });
});

describe('tela', () => {
  test('helpers de campo', () => {
    expect(ehCampoRetencao('x_contribuicao')).toBe(true);
    expect(nomeFormDoCampo('x_contribuicao')).toBe('x_contribuicao');
    expect(nomeFormDoCampo('sest_senat')).toBe('sestSenat');
    expect(camposExtrasDaConfig({ campos: CONFIG })).toEqual(['x_taxa_ambiental', 'x_contribuicao']);
    expect(colunasDaMatriz(CONFIG).map((x) => x.campo)).toEqual(['irrf', 'iss', 'inss', 'patronal', 'sest_senat', 'x_taxa_ambiental']);
  });

  test('somarDescontosCents e valoresCalculadosDoForm com "x_"', () => {
    expect(somarDescontosCents({ irrf: '15,00', x_contribuicao: '7,00' })).toBe(2200);
    const v = valoresCalculadosDoForm({ x_taxa_ambiental: 2000 }, [], ['x_taxa_ambiental', 'x_contribuicao']);
    expect(v).toMatchObject({ x_taxa_ambiental: '20,00', x_contribuicao: '' });
    expect(valoresCalculadosDoForm({}, ['x_contribuicao'], ['x_contribuicao'])).not.toHaveProperty('x_contribuicao');
  });

  test('estado: percentual segue a Matriz; digitada editável', () => {
    expect(estadoCampoOp(AMBIENTAL as any, '3.3.90.30', REGRAS, 'GESTOR').dica).toBe('Não se aplica a 3.3.90.30');
    expect(estadoCampoOp(CONTRIB, '3.3.90.30', REGRAS, 'GESTOR').editavel).toBe(true);
    expect(estadoCampoOp(AMBIENTAL as any, '3.3.90.39', REGRAS, 'GESTOR', { credorMei: true, sobrescreverMei: false }).dica).toBe('Isento (MEI)');
  });

  test('lote: "x_" digitadas vão em `extras`', () => {
    const l = { ...linhaDoCredor({ cpfCnpj: '1' }), valorPagamento: '1.000,00', x_contribuicao: '7,00', camposInformados: ['x_contribuicao'] };
    expect(montarPayloadLote({ neCarregada: 'NE', credores: [l] } as any).credores[0]).toMatchObject({ extras: { x_contribuicao: 7 } });
  });
});

describe('DARF e impressão', () => {
  test('DARF inclui a "x_" percentual marcada', () => {
    const campos = entraDarfDaConfig(CONFIG);
    expect(campos).toEqual(['inss', 'patronal', 'sest_senat', 'x_taxa_ambiental']);
    expect(calcularDarf({ inss: 110, patronal: 200, sest_senat: 25, x_taxa_ambiental: 20 }, campos).valorCents).toBe(35500);
  });

  test('via: linha da "x_" pelo snapshot, com alíquota da época', () => {
    const r = calcular({ informados: { x_contribuicao: c(7) } });
    const op = { retencoesSnapshot: r.snapshot };
    const linhas = linhasDescontoDaOp(op);
    expect(linhas.find((l) => l.chave === 'x_taxa_ambiental')?.rotulo).toBe('Taxa Ambiental (2%)');
    expect(linhas.find((l) => l.chave === 'x_contribuicao')?.rotulo).toBe('Contribuição');
    expect(valoresExtrasDaOp(op)).toEqual({ x_taxa_ambiental: '20,00', x_contribuicao: '7,00' });
  });

  test('OP sem "x_": nenhuma linha extra', () => {
    const r = calcularRetencoes({ brutoCents: c(1000), elementoCodigo: '3.3.90.39', config: FIXOS, regras: REGRAS, informados: {}, perfil: 'GESTOR' });
    expect(linhasDescontoDaOp({ retencoesSnapshot: r.snapshot }).some((l) => l.chave.startsWith('x_'))).toBe(false);
    expect(valoresExtrasDaOp({ retencoesSnapshot: r.snapshot })).toEqual({});
  });
});

describe('migration_25', () => {
  const sql = fs.readFileSync(path.join(process.cwd(), 'database', 'migration_25.sql'), 'utf8');
  const ativo = sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');
  test('só CREATE TABLE IF NOT EXISTS; nada alterado ou removido', () => {
    expect(ativo).toMatch(/CREATE TABLE IF NOT EXISTS op_retencoes_extras/);
    expect(ativo).toMatch(/PRIMARY KEY \(ordem_pagamento_id, campo\)/);
    expect(ativo).not.toMatch(/\b(DROP|ALTER|UPDATE|DELETE|TRUNCATE|RENAME)\b/i);
  });
});
