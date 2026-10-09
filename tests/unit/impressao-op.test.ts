import { describe, test, expect } from 'vitest';
import { formatarValorOp, linhasDescontoDaOp, LINHAS_DOCUMENTO_EM_BRANCO } from '@/lib/impressao-op';
import { calcularRetencoes } from '@/lib/retencoes';
import type { ConfigRetencaoCampoMapeado } from '@/lib/services/config-retencoes.service';

const CONFIG: ConfigRetencaoCampoMapeado[] = [
  { campo: 'irrf', rotulo: 'IRRF', tipo: 'PERCENTUAL', aliquota: 1.5, calculoAutomatico: true, editavelOperador: false, entraDarf: false, ativo: true, ordem: 10 },
  { campo: 'iss', rotulo: 'ISS', tipo: 'PERCENTUAL', aliquota: 5, calculoAutomatico: true, editavelOperador: false, entraDarf: false, ativo: true, ordem: 20 },
  { campo: 'inss', rotulo: 'INSS', tipo: 'PERCENTUAL', aliquota: 11, calculoAutomatico: true, editavelOperador: false, entraDarf: true, ativo: true, ordem: 30 },
  { campo: 'patronal', rotulo: 'Patronal', tipo: 'PERCENTUAL', aliquota: 20, calculoAutomatico: true, editavelOperador: false, entraDarf: true, ativo: true, ordem: 40 },
  { campo: 'sest_senat', rotulo: 'SEST/SENAT', tipo: 'PERCENTUAL', aliquota: 2.5, calculoAutomatico: true, editavelOperador: false, entraDarf: true, ativo: true, ordem: 50 },
  { campo: 'outros', rotulo: 'Outros / IBS-CBS', tipo: 'VALOR_DIGITADO', aliquota: null, calculoAutomatico: false, editavelOperador: false, entraDarf: false, ativo: true, ordem: 60 },
  { campo: 'taxa_bancaria', rotulo: 'Taxa bancária (expediente)', tipo: 'VALOR_DIGITADO', aliquota: null, calculoAutomatico: false, editavelOperador: true, entraDarf: false, ativo: true, ordem: 70 },
  { campo: 'taxa_pix', rotulo: 'Taxa PIX', tipo: 'VALOR_DIGITADO', aliquota: null, calculoAutomatico: false, editavelOperador: true, entraDarf: false, ativo: true, ordem: 80 },
];
const REGRAS = {
  '3.3.90.14': [] as string[],
  '3.3.90.30': ['irrf', 'inss', 'patronal', 'sest_senat'],
  '3.3.90.36': ['irrf', 'iss', 'inss', 'patronal', 'sest_senat'],
};

// Snapshot gerado pelo motor real, do jeito que fica gravado na OP.
function snapshot(elemento: string, config = CONFIG) {
  return calcularRetencoes({
    brutoCents: 100000, elementoCodigo: elemento, config, regras: REGRAS, informados: {}, perfil: 'GESTOR',
  }).snapshot;
}
const rotulos = (op: any) => linhasDescontoDaOp(op).map((l) => l.rotulo);

describe('linhasDescontoDaOp', () => {
  test('OP nova no .36: 8 linhas, rótulos do snapshot com a alíquota usada', () => {
    expect(rotulos({ retencoesSnapshot: snapshot('3.3.90.36') })).toEqual([
      'IRRF (1,5%)', 'ISS (5%)', 'INSS (11%)', 'Patronal (20%)', 'SEST/SENAT (2,5%)',
      'Outros / IBS-CBS', 'Taxa bancária (expediente)', 'Taxa PIX',
    ]);
  });

  test('alíquota alterada pelo admin aparece no rótulo (IRRF 2%)', () => {
    const config = CONFIG.map((c) => (c.campo === 'irrf' ? { ...c, aliquota: 2 } : c));
    expect(rotulos({ retencoesSnapshot: snapshot('3.3.90.36', config) })[0]).toBe('IRRF (2%)');
  });

  test('.14: nenhuma linha de imposto, só os descontos', () => {
    expect(rotulos({ retencoesSnapshot: snapshot('3.3.90.14') })).toEqual([
      'Outros / IBS-CBS', 'Taxa bancária (expediente)', 'Taxa PIX',
    ]);
  });

  test('.30: sem ISS', () => {
    expect(rotulos({ retencoesSnapshot: snapshot('3.3.90.30') })).not.toContain('ISS (5%)');
  });

  test('campo inativo não aparece', () => {
    const config = CONFIG.map((c) => (c.campo === 'taxa_pix' ? { ...c, ativo: false } : c));
    expect(rotulos({ retencoesSnapshot: snapshot('3.3.90.36', config) })).not.toContain('Taxa PIX');
  });

  test('imposto percentual não automático (digitado) sai sem %', () => {
    const config = CONFIG.map((c) => (c.campo === 'iss' ? { ...c, calculoAutomatico: false } : c));
    expect(rotulos({ retencoesSnapshot: snapshot('3.3.90.36', config) })[1]).toBe('ISS');
  });

  test('snapshot como string JSON também funciona', () => {
    expect(rotulos({ retencoesSnapshot: JSON.stringify(snapshot('3.3.90.14')) })).toHaveLength(3);
  });

  test('chaves batem com os campos do verso', () => {
    expect(linhasDescontoDaOp({ retencoesSnapshot: snapshot('3.3.90.36') }).map((l) => l.chave)).toEqual([
      'irrf', 'iss', 'inss', 'patronal', 'sestSenat', 'outrosDescontos', 'taxaBancaria', 'taxaPix',
    ]);
  });

  test('OP antiga (sem snapshot): rótulos históricos, 8 linhas', () => {
    expect(rotulos({ retencoesSnapshot: null })).toEqual([
      'IRRF (1,5%)', 'ISS (5%)', 'INSS (11%)', 'PATRONAL (20%)', 'SEST/SENAT (2,5%)',
      'OUTROS / IBS-CBS', 'Taxa bancária (expediente)', 'Taxa PIX',
    ]);
    expect(rotulos({ retencoesSnapshot: 'json quebrado' })).toHaveLength(8);
  });

  test('documento em branco: 8 linhas sem percentual', () => {
    expect(LINHAS_DOCUMENTO_EM_BRANCO).toHaveLength(8);
    expect(LINHAS_DOCUMENTO_EM_BRANCO.some((l) => l.rotulo.includes('%'))).toBe(false);
  });
});

describe('formatarValorOp', () => {
  test('DECIMAL do MySQL (string) vira formato BR com milhar', () => {
    expect(formatarValorOp('1100.00')).toBe('1.100,00');
    expect(formatarValorOp('9.98')).toBe('9,98');
    expect(formatarValorOp(8.5)).toBe('8,50');
  });
  test('vazio vira 0,00', () => {
    expect(formatarValorOp(null)).toBe('0,00');
    expect(formatarValorOp(undefined)).toBe('0,00');
  });
});
