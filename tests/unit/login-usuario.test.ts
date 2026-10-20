import { describe, test, expect } from 'vitest';
import { candidatosDoLogin, correspondeAoLogin, normalizarNomeUsuario } from '@/lib/login-usuario';

describe('login por e-mail ou nome de usuário', () => {
  test('normaliza como o cadastro (minúsculas, espaços viram ponto)', () => {
    expect(normalizarNomeUsuario('  João  Silva ')).toBe('joão.silva');
  });

  test.each([
    ['john@example.com', 'John@Example.com', true], // e-mail exato, sem diferenciar maiúsculas
    ['joao.abc12345@empenho.local', 'joao', true], // nome + sufixo do cadastro
    ['joao@empenho.local', 'joao', true], // formato antigo, sem sufixo
    ['joao.silva.abc12345@empenho.local', 'Joao  Silva', true], // espaços viram ponto
    ['joão.silva.abc12345@empenho.local', 'João Silva', true], // o cadastro mantém o acento
    ['joao.silva.abc12345@empenho.local', 'joao', false], // o bug: "joao" não é "joao.silva"
    ['joao.abc1234@empenho.local', 'joao', false], // sufixo com 7 caracteres
    ['joao.xyz12345@empenho.local', 'joao', false], // sufixo não hexadecimal
    ['joaoxabc12345@empenho.local', 'joao', false],
    ['a.b@empenho.local', 'a.b', true],
    ['axb@empenho.local', 'a.b', false], // o ponto do nome não vale como coringa
  ])('%s × "%s" → %s', (emailBanco: string, digitado: string, esperado: boolean) => {
    expect(correspondeAoLogin(emailBanco, digitado)).toBe(esperado);
  });

  test('candidatos: só os exatos, e o e-mail exato vem primeiro', () => {
    const lista = [
      { email: 'joao.silva.abc12345@empenho.local' },
      { email: 'joao.aaaa1111@empenho.local' },
      { email: 'joao@empenho.local' },
    ];
    expect(candidatosDoLogin(lista, 'joao').map((u) => u.email)).toEqual(['joao.aaaa1111@empenho.local', 'joao@empenho.local']);
    expect(candidatosDoLogin(lista, 'joao@empenho.local')[0].email).toBe('joao@empenho.local');
  });
});
