// B13 — justificativa de sobra de recurso da NE: textos, validação e a
// migration_26.
import fs from 'fs';
import path from 'path';
import { describe, test, expect } from 'vitest';
import {
  MOTIVOS_PADRAO,
  TEXTO_DEVOLUCAO_PADRAO,
  montarJustificativa,
  textosDaFolha,
  validarJustificativa,
  valorPorExtenso,
} from '@/lib/justificativa-saldo';

const NE = { numero: '2026NE000007', exercicio: '2026', historico: 'Transporte escolar - rota rural' };

describe('montarJustificativa', () => {
  test('sem salva: objeto = Observação da NE, atualizado = saldo, devolução do modelo, sem motivos', () => {
    const d = montarJustificativa(NE, 500);
    expect(d).toEqual({
      numeroNe: '2026NE000007', exercicio: '2026', objeto: 'Transporte escolar - rota rural', valorSaldo: 500, valorAtualizado: 500,
      motivos: [], outros: '', textoDevolucao: TEXTO_DEVOLUCAO_PADRAO,
    });
  });

  test('com salva: volta o que foi salvo; o saldo é sempre o atual', () => {
    const d = montarJustificativa(NE, 400, { objeto: 'Outro', valorAtualizado: 512.3, motivos: [MOTIVOS_PADRAO[0]], outros: 'x' });
    expect(d).toMatchObject({ objeto: 'Outro', valorSaldo: 400, valorAtualizado: 512.3, motivos: [MOTIVOS_PADRAO[0]], outros: 'x' });
  });

  test('exercício: o da NE; sem ele, o ano do número', () => {
    expect(montarJustificativa({ numero: '2025NE000001' }, 1).exercicio).toBe('2025');
  });
});

describe('valor por extenso', () => {
  test.each([
    [500, 'quinhentos reais'],
    [1500.5, 'um mil e quinhentos reais e cinquenta centavos'],
    [2000, 'dois mil reais'],
    [0.01, 'um centavo'],
  ])('%s → %s', (v: number, esperado: string) => {
    expect(valorPorExtenso(v)).toBe(esperado);
  });
});

describe('textosDaFolha', () => {
  const base = montarJustificativa(NE, 500);

  test('só os motivos marcados; "Outros" só se preenchido', () => {
    expect(textosDaFolha({ ...base, motivos: [MOTIVOS_PADRAO[2]] }).motivos).toEqual([MOTIVOS_PADRAO[2].texto]);
    expect(textosDaFolha({ ...base, motivos: [MOTIVOS_PADRAO[0]], outros: '  Obra embargada ' }).motivos).toEqual([
      MOTIVOS_PADRAO[0].texto,
      'Outros fatores: Obra embargada',
    ]);
  });

  test('título, abertura com valor e extenso, valor atualizado', () => {
    const t = textosDaFolha({ ...base, motivos: [MOTIVOS_PADRAO[0]], valorAtualizado: 512.3 });
    expect(t.titulo).toBe('JUSTIFICATIVA DE NÃO UTILIZAÇÃO TOTAL DO RECURSO DA NE Nº 2026NE000007');
    expect(t.abertura).toContain('NOTA DE EMPENHO Nº 2026NE000007, EXERCÍCIO 2026, no valor de R$ 500,00 (quinhentos reais)');
    expect(t.valorAtualizado).toContain('R$ 512,30');
    expect(t.objeto).toBe('Objeto do Recurso: Transporte escolar - rota rural');
    expect(t.assinatura[0]).toBe('CGAF – Coordenação Geral de Administração e Finanças');
  });

  test('as instruções do modelo ("DEIXAR ESSAS OPÇÕES…") não vão para a folha', () => {
    const t = textosDaFolha({ ...base, motivos: MOTIVOS_PADRAO });
    expect(JSON.stringify(t)).not.toMatch(/DEIXAR|EDITÁVEL|SITEMA/);
  });
});

describe('validarJustificativa', () => {
  const base = montarJustificativa(NE, 500);
  test('precisa de ao menos um motivo (ou "Outros")', () => {
    expect(validarJustificativa(base)).toEqual(['Marque ao menos um motivo (ou preencha "Outros fatores").']);
    expect(validarJustificativa({ ...base, outros: 'algo' })).toEqual([]);
    expect(validarJustificativa({ ...base, motivos: [MOTIVOS_PADRAO[1]] })).toEqual([]);
    expect(validarJustificativa({ ...base, motivos: [{ codigo: 'parcial', texto: '   ' }] })).toHaveLength(1);
  });
  test('valor negativo e texto longo', () => {
    expect(validarJustificativa({ ...base, outros: 'x', valorAtualizado: -1 })).toContain('Saldo atualizado inválido.');
    expect(validarJustificativa({ ...base, outros: 'x'.repeat(2001) }).join(' ')).toMatch(/no máximo 2000/);
  });
});

describe('migration_26', () => {
  test('só CREATE TABLE IF NOT EXISTS, uma por NE', () => {
    const sql = fs.readFileSync(path.join(process.cwd(), 'database', 'migration_26.sql'), 'utf8');
    const ativo = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
    expect(ativo).toMatch(/CREATE TABLE IF NOT EXISTS justificativas_saldo/);
    expect(ativo).toMatch(/UNIQUE KEY uq_justificativa_ne \(numero_ne\)/);
    expect(ativo.replace(/ON UPDATE CURRENT_TIMESTAMP/g, '')).not.toMatch(/\b(DROP|ALTER|UPDATE|DELETE|TRUNCATE)\b/i);
  });
});
