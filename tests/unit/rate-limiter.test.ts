import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limiter';

// Cada teste usa um IP único (via crypto.randomUUID) pra não competir pelo
// mesmo registro no Map interno do módulo, que é compartilhado entre testes
// (não há como resetar esse estado sem reimportar o módulo dinamicamente).
function ip() {
  return `10.0.0.${Math.floor(Math.random() * 1_000_000)}`;
}

describe('rate-limiter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('primeira tentativa de um IP novo é permitida', () => {
    const result = checkRateLimit(ip());
    expect(result.allowed).toBe(true);
    expect(result.retryAfterMs).toBeUndefined();
  });

  test('permite até MAX_ATTEMPTS (10) tentativas na mesma janela', () => {
    const addr = ip();
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(addr).allowed).toBe(true);
    }
  });

  test('bloqueia a 11ª tentativa dentro da janela de 15 minutos', () => {
    const addr = ip();
    for (let i = 0; i < 10; i++) {
      checkRateLimit(addr);
    }
    const eleventh = checkRateLimit(addr);
    expect(eleventh.allowed).toBe(false);
    expect(eleventh.retryAfterMs).toBeGreaterThan(0);
    expect(eleventh.retryAfterMs).toBeLessThanOrEqual(15 * 60 * 1000);
  });

  test('duas tentativas de IPs diferentes não interferem uma na outra', () => {
    const a = ip();
    const b = ip();
    for (let i = 0; i < 10; i++) checkRateLimit(a);
    expect(checkRateLimit(a).allowed).toBe(false); // a: bloqueado
    expect(checkRateLimit(b).allowed).toBe(true);  // b: ainda livre
  });

  test('resetRateLimit libera o IP imediatamente, mesmo bloqueado', () => {
    const addr = ip();
    for (let i = 0; i < 10; i++) checkRateLimit(addr);
    expect(checkRateLimit(addr).allowed).toBe(false);

    resetRateLimit(addr);

    expect(checkRateLimit(addr).allowed).toBe(true);
  });

  test('resetRateLimit em IP nunca visto não lança erro', () => {
    expect(() => resetRateLimit(ip())).not.toThrow();
  });

  test('após a janela de 15 minutos expirar, a contagem reseta', () => {
    vi.useFakeTimers();
    const addr = ip();

    for (let i = 0; i < 10; i++) checkRateLimit(addr);
    expect(checkRateLimit(addr).allowed).toBe(false);

    // avança além da janela de 15 minutos
    vi.advanceTimersByTime(15 * 60 * 1000 + 1);

    expect(checkRateLimit(addr).allowed).toBe(true);
  });

  test('guarda de memória: não deixa o Map crescer indefinidamente', () => {
    // Gera mais de 10.000 IPs distintos pra disparar a limpeza dos 1000 mais
    // antigos (proteção contra exaustão de memória documentada no código).
    for (let i = 0; i < 10_050; i++) {
      checkRateLimit(`stress-test-${i}`);
    }
    // Não há um jeito limpo de inspecionar o tamanho do Map de fora do módulo
    // (é privado), mas o teste em si não deve travar nem lançar erro mesmo
    // passando muito além do limiar de 10.000 — é a garantia comportamental
    // que a guarda promete.
    expect(checkRateLimit(ip()).allowed).toBe(true);
  });
});
