// Rate limiter simples em memória para proteger endpoints críticos.
// Adequado para uso local/single-instance. Para produção multi-instância, use Redis.

interface AttemptRecord {
  count: number;
  firstAttempt: number;
}

const store = new Map<string, AttemptRecord>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const MAX_ATTEMPTS = 10; // tentativas por janela (generoso para uso local)

function cleanup() {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (now - record.firstAttempt > WINDOW_MS) {
      store.delete(key);
    }
  }
}

/**
 * Verifica se o IP ultrapassou o limite de tentativas.
 * Retorna { allowed: true } se permitido, { allowed: false, retryAfterMs } se bloqueado.
 */
export function checkRateLimit(ip: string): { allowed: boolean; retryAfterMs?: number } {
  cleanup();

  const now = Date.now();
  const record = store.get(ip);

  if (!record) {
    store.set(ip, { count: 1, firstAttempt: now });
    return { allowed: true };
  }

  const elapsed = now - record.firstAttempt;

  if (elapsed > WINDOW_MS) {
    // Janela expirada — resetar
    store.set(ip, { count: 1, firstAttempt: now });
    return { allowed: true };
  }

  if (record.count >= MAX_ATTEMPTS) {
    const retryAfterMs = WINDOW_MS - elapsed;
    return { allowed: false, retryAfterMs };
  }

  record.count += 1;
  return { allowed: true };
}

/** Limpa o registro de tentativas de um IP (ex: após login bem-sucedido). */
export function resetRateLimit(ip: string): void {
  store.delete(ip);
}
