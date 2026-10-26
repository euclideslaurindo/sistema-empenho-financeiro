// A3 (Pessoas físicas no IR) — filtros da tela: busca sem acento, CPF e situação.
import { describe, test, expect } from 'vitest';
import { anosDoSeletor, filtrarPessoas, normalizarBusca } from './filtros-ir';
import type { PessoaFisicaIr } from './tipos-ir';

const pessoa = (nome: string, cpf: string, informado = false): PessoaFisicaIr => ({
  cpf,
  cpfFormatado: cpf,
  nome,
  qtdOps: 1,
  bruto: 100,
  irrf: 0,
  inss: 11,
  iss: 5,
  liquido: 84,
  naturezas: [],
  informado: informado ? { em: '2026-10-26 10:00', porNome: 'Ana', observacao: null } : null,
});

const ALVARO = pessoa('Álvaro Souza', '11122233396', true);
const BRUNO = pessoa('Bruno Lima', '22233344405');
const MARIA = pessoa('MARIA DA CONCEIÇÃO', '20261234567');
const TODAS = [ALVARO, BRUNO, MARIA];
const nomes = (l: PessoaFisicaIr[]) => l.map((p) => p.nome);

describe('normalizarBusca', () => {
  test('tira acento, passa para minúsculas e junta espaços', () => {
    expect(normalizarBusca('  Álvaro   SOUZA ')).toBe('alvaro souza');
    expect(normalizarBusca('Conceição')).toBe('conceicao');
    expect(normalizarBusca('')).toBe('');
  });
});

describe('filtrarPessoas', () => {
  const f = (busca: string, situacao: 'todas' | 'pendentes' | 'informadas' = 'todas') => nomes(filtrarPessoas(TODAS, { busca, situacao }));

  test('nome sem acento e sem diferença de maiúsculas', () => {
    expect(f('alvaro')).toEqual(['Álvaro Souza']);
    expect(f('CONCEICAO')).toEqual(['MARIA DA CONCEIÇÃO']);
    expect(f('lima')).toEqual(['Bruno Lima']);
  });

  test('CPF com ou sem máscara compara só os dígitos', () => {
    expect(f('111.222')).toEqual(['Álvaro Souza']);
    expect(f('222333444-05')).toEqual(['Bruno Lima']);
  });

  test('termo só com dígitos compara só com o CPF, nunca com o nome', () => {
    expect(f('2026')).toEqual(['MARIA DA CONCEIÇÃO']); // o CPF dela começa com 2026
    expect(f('999')).toEqual([]);
  });

  test('busca vazia ou só espaços não filtra', () => {
    expect(f('')).toEqual(nomes(TODAS));
    expect(f('   ')).toEqual(nomes(TODAS));
  });

  test('situação: pendentes e informadas', () => {
    expect(f('', 'pendentes')).toEqual(['Bruno Lima', 'MARIA DA CONCEIÇÃO']);
    expect(f('', 'informadas')).toEqual(['Álvaro Souza']);
  });

  test('busca e situação juntas', () => {
    expect(f('alvaro', 'pendentes')).toEqual([]);
    expect(f('a', 'informadas')).toEqual(['Álvaro Souza']);
  });

  test('não altera a lista original', () => {
    const copia = [...TODAS];
    filtrarPessoas(TODAS, { busca: 'bruno', situacao: 'pendentes' });
    expect(TODAS).toEqual(copia);
  });
});

describe('anosDoSeletor', () => {
  test('junta o ano exibido, sem repetir, do mais recente ao mais antigo', () => {
    expect(anosDoSeletor([2025, 2026], 2024)).toEqual([2026, 2025, 2024]);
    expect(anosDoSeletor([2026, 2025], 2026)).toEqual([2026, 2025]);
  });

  test('sem anos com movimento, sobra o ano exibido', () => {
    expect(anosDoSeletor([], 2026)).toEqual([2026]);
  });
});
