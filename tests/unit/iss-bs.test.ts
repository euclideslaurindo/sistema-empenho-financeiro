// B10 — ISS editável pelo GESTOR (config) e o campo ISS-BS (2º ISS, valor livre).
import fs from 'fs';
import path from 'path';
import { describe, test, expect } from 'vitest';
import { calcularRetencoes, CAMPOS_DESCONTO, type EntradaCalculo } from '@/lib/retencoes';
import { montarInformados } from '@/lib/services/ordem-pagamento-core';
import { montarPayloadLote, linhaDoCredor } from '@/lib/op-emissao';
import { simularRetencoes } from '@/lib/retencoes-simulador';
import { CAMPO_FORM, estadoCampoOp } from '@/lib/retencoes-form';
import type { ConfigRetencaoCampoMapeado } from '@/lib/services/config-retencoes.service';

const c = (reais: number) => Math.round(reais * 100);
const pct = (campo: string, rotulo: string, aliquota: number, ordem: number, extra: Partial<ConfigRetencaoCampoMapeado> = {}) => ({
  campo, rotulo, tipo: 'PERCENTUAL', aliquota, calculoAutomatico: true, editavelOperador: false, entraDarf: false, ativo: true, ordem, ...extra,
});
const ISS_BS: ConfigRetencaoCampoMapeado = {
  campo: 'iss_bs', rotulo: 'ISS-BS', tipo: 'VALOR_DIGITADO', aliquota: null, calculoAutomatico: false, editavelOperador: true,
  entraDarf: false, ativo: true, ordem: 25,
};
const CONFIG: ConfigRetencaoCampoMapeado[] = [
  pct('irrf', 'IRRF', 1.5, 10), pct('iss', 'ISS', 5, 20), ISS_BS, pct('inss', 'INSS', 11, 30, { entraDarf: true }),
  pct('patronal', 'Patronal', 20, 40, { entraDarf: true }), pct('sest_senat', 'SEST/SENAT', 2.5, 50, { entraDarf: true }),
];
const TODOS = ['irrf', 'iss', 'inss', 'patronal', 'sest_senat'];

function calcular(over: Partial<EntradaCalculo> = {}) {
  return calcularRetencoes({
    brutoCents: c(1000),
    elementoCodigo: '3.3.90.39',
    config: CONFIG,
    regras: { '3.3.90.39': ['irrf', 'iss'], '3.3.90.30': TODOS },
    informados: {},
    perfil: 'GESTOR',
    ...over,
  });
}

describe('ISS-BS no motor', () => {
  test('é um desconto livre', () => {
    expect(CAMPOS_DESCONTO).toContain('iss_bs');
    expect(CAMPO_FORM.iss_bs).toBe('issBs');
  });

  test('GESTOR digita 20,00: entra no total e no líquido; tributários não mudam', () => {
    const sem = calcular();
    const com = calcular({ informados: { iss_bs: c(20) } });
    expect(com.itens.iss_bs).toBe(2000);
    expect(com.itens.irrf).toBe(sem.itens.irrf);
    expect(com.itens.iss).toBe(sem.itens.iss);
    expect(com.totalDescontosCents).toBe(sem.totalDescontosCents + 2000);
    expect(com.liquidoCents).toBe(sem.liquidoCents - 2000);
    expect(com.snapshot.campos.iss_bs).toMatchObject({ rotulo: 'ISS-BS', aliquota: null, automatico: false, valor: 20 });
  });

  test('sem valor = 0', () => {
    expect(calcular().itens.iss_bs).toBe(0);
  });

  test('credor MEI: tributários zerados, o ISS-BS digitado fica (como as taxas)', () => {
    const r = calcular({ credorMei: true, informados: { iss_bs: c(20) } });
    expect(r.itens).toMatchObject({ irrf: 0, iss: 0, iss_bs: 2000 });
    expect(r.liquidoCents).toBe(c(980));
  });

  test('desativado pelo admin: 0 mesmo digitado', () => {
    const config = CONFIG.map((x) => (x.campo === 'iss_bs' ? { ...x, ativo: false } : x));
    expect(calcular({ config, informados: { iss_bs: c(20) } }).itens.iss_bs).toBe(0);
  });

  test('maior que o bruto: 422', () => {
    expect(() => calcular({ informados: { iss_bs: c(2000) } })).toThrow();
  });
});

describe('ISS editável pelo GESTOR (Configurações → "Editável pelo operador")', () => {
  const issEditavel = CONFIG.map((x) => (x.campo === 'iss' ? { ...x, editavelOperador: true } : x));

  test('com a opção: o GESTOR troca 50,00 por 30,00 e vale 30,00', () => {
    const r = calcular({ config: issEditavel, informados: { iss: c(30) } });
    expect(r.itens.iss).toBe(3000);
    expect(estadoCampoOp(issEditavel[1], '3.3.90.39', { '3.3.90.39': ['irrf', 'iss'] }, 'GESTOR').editavel).toBe(true);
  });

  test('sem a opção (hoje): o valor do GESTOR é ignorado; o ADMIN pode', () => {
    expect(calcular({ informados: { iss: c(30) } }).itens.iss).toBe(5000);
    expect(calcular({ perfil: 'ADMIN', informados: { iss: c(30) } }).itens.iss).toBe(3000);
    expect(estadoCampoOp(CONFIG[1], '3.3.90.39', { '3.3.90.39': ['irrf', 'iss'] }, 'GESTOR').editavel).toBe(false);
  });

  test('sem nada digitado continua 5%', () => {
    expect(calcular({ config: issEditavel }).itens.iss).toBe(5000);
  });
});

describe('payloads', () => {
  test('montarInformados mapeia issBs → iss_bs só se veio', () => {
    expect(montarInformados({ issBs: 20 })).toEqual({ iss_bs: 2000 });
    expect(montarInformados({})).toEqual({});
  });

  test('lote: o ISS-BS digitado vai por linha', () => {
    const linha = { ...linhaDoCredor({ cpfCnpj: '1' }, '', 'NE'), valorPagamento: '1.000,00', issBs: '20,00', camposInformados: ['iss_bs'] };
    const outra = { ...linhaDoCredor({ cpfCnpj: '2' }, '', 'NE'), valorPagamento: '500,00' };
    const p = montarPayloadLote({ neCarregada: 'NE', credores: [linha, outra] } as any);
    expect(p.credores[0]).toMatchObject({ issBs: 20 });
    expect(p.credores[1]).not.toHaveProperty('issBs');
  });

  test('simulador: ISS-BS entra no total', () => {
    const campos = CONFIG.filter((x) => x.tipo === 'PERCENTUAL').map((x) => ({ ...x, aliquota: String(x.aliquota).replace('.', ',') }));
    const r = simularRetencoes({ brutoReais: 1000, regrasElemento: ['irrf', 'iss'], camposConfig: campos as any, issBsReais: 20 });
    expect(r.issBsCents).toBe(2000);
    expect(r.liquidoCents).toBe(c(1000 - 15 - 50 - 20));
  });
});

describe('migration_23', () => {
  const sql = fs.readFileSync(path.join(process.cwd(), 'database', 'migration_23.sql'), 'utf8');
  const ativo = sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');

  test('ADD COLUMN protegido + INSERT IGNORE do campo; nada removido', () => {
    expect(ativo).toMatch(/COLUMN_NAME = 'iss_bs'/);
    expect(ativo).toMatch(/IF\(@tem = 0,\s*'ALTER TABLE ordens_pagamento ADD COLUMN iss_bs DECIMAL\(10,2\) NOT NULL DEFAULT 0'/);
    expect(ativo).toMatch(/INSERT IGNORE INTO config_retencoes/);
    expect(ativo).toMatch(/\('iss_bs', 'ISS-BS', 'VALOR_DIGITADO', NULL, 0, 1, 0, 1, 25\)/);
    expect(ativo).not.toMatch(/\b(DROP|TRUNCATE|UPDATE|DELETE|RENAME)\b/i);
    expect(ativo.match(/ALTER TABLE/g)).toHaveLength(1);
  });
});
