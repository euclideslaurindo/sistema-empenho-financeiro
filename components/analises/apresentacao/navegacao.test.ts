// B6 — navegação, escala do palco e frases da abertura (puro).
import { describe, test, expect } from 'vitest';
import { respostaExemplo } from '@/tests/fixtures/analises-resposta';
import { acaoDaTecla, escalaDoPalco, frasesDeAbertura, proximoSlide, slideDoHash } from './navegacao';

describe('acaoDaTecla', () => {
  test.each([
    ['ArrowRight', 'proximo'],
    ['PageDown', 'proximo'],
    [' ', 'proximo'],
    ['ArrowLeft', 'anterior'],
    ['PageUp', 'anterior'],
    ['Home', 'primeiro'],
    ['End', 'ultimo'],
    ['Escape', 'sair'],
    ['f', 'tela-cheia'],
    ['F', 'tela-cheia'],
    ['a', null],
    ['Enter', null],
    ['Tab', null],
  ])('%j → %s', (tecla: string, acao: string | null) => {
    expect(acaoDaTecla(tecla)).toBe(acao);
  });
});

describe('proximoSlide', () => {
  test('não dá a volta nos limites', () => {
    expect(proximoSlide(3, 'proximo')).toBe(3);
    expect(proximoSlide(1, 'anterior')).toBe(1);
    expect(proximoSlide(1, 'proximo')).toBe(2);
    expect(proximoSlide(3, 'anterior')).toBe(2);
  });
  test('Home e End', () => {
    expect(proximoSlide(2, 'primeiro')).toBe(1);
    expect(proximoSlide(1, 'ultimo')).toBe(3);
  });
});

describe('escalaDoPalco', () => {
  test('Full HD, 5:4, celular e TV 4K', () => {
    expect(escalaDoPalco(1920, 1080)).toBe(1.47);
    expect(escalaDoPalco(1280, 1024)).toBe(0.98); // limitada pela largura
    const cel = escalaDoPalco(390, 844);
    expect(cel).toBeGreaterThan(0);
    expect(cel).toBeLessThan(0.31);
    expect(escalaDoPalco(3840, 2160)).toBe(2); // nunca passa de 2
  });
  test('tamanho inválido → 1', () => {
    expect(escalaDoPalco(0, 720)).toBe(1);
    expect(escalaDoPalco(Number.NaN, 720)).toBe(1);
  });
});

describe('slideDoHash', () => {
  test.each([
    ['#2', 2],
    ['#3', 3],
    ['#0', 1],
    ['#4', 1],
    ['#x', 1],
    ['', 1],
  ])('%j → %s', (hash: string, n: number) => {
    expect(slideDoHash(hash)).toBe(n);
  });
});

describe('frasesDeAbertura', () => {
  const r = respostaExemplo();

  test('variação positiva, com a frase de apoio', () => {
    expect(frasesDeAbertura(r)).toEqual({
      principal: 'R$ 307 mil pagos a 2 credores, 25% a mais que em jan–out/2025',
      apoio: '53% das NEs do período já foi pago. Restam R$ 799,90 a pagar.',
    });
  });

  test('variação negativa, nula e sem base', () => {
    expect(frasesDeAbertura({ ...r, kpis: { ...r.kpis, varPago: -3.2 } }).principal).toContain('3,2% a menos que em jan–out/2025');
    expect(frasesDeAbertura({ ...r, kpis: { ...r.kpis, varPago: 0 } }).principal).toContain('o mesmo que em jan–out/2025');
    expect(frasesDeAbertura({ ...r, kpis: { ...r.kpis, varPago: null } }).principal).toContain('sem base de comparação com jan–out/2025');
    expect(frasesDeAbertura({ ...r, qtdCredores: 1 }).principal).toContain('a 1 credor,');
  });

  test('sem movimento: a frase da API, sem apoio e sem NaN', () => {
    const f = frasesDeAbertura({ ...r, vazio: true, qtdOps: 0, resumo: [{ t: 'Nenhuma NE ou OP em 2026 (até 27/10).', forte: false }] });
    expect(f).toEqual({ principal: 'Nenhuma NE ou OP em 2026 (até 27/10).', apoio: '' });
  });
});
