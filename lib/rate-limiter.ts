// rate limiter em memoria pra nao deixar alguem ficar tentando login infinitamente
// otimizado com lazy/timeout delete para evitar O(N) cleanup
//
// LIMITAÇÃO CONHECIDA: o Map abaixo é local ao processo Node. Se a aplicação
// rodar em múltiplas instâncias simultâneas (vários pods, serverless com
// concorrência, etc.), cada instância tem seu próprio contador e o limite
// real efetivo passa a ser (MAX_ATTEMPTS × número de instâncias). Para
// single-instance (um VPS/container único) isso não é um problema. Se o
// deploy migrar para multi-instância, trocar este Map por um store
// compartilhado (Redis/Upstash) antes de depender do rate limit para
// segurança real.

interface AttemptRecord {
  count: number;
  firstAttempt: number;
  timeoutId?: NodeJS.Timeout;
}

const store = new Map<string, AttemptRecord>();

const WINDOW_MS = 15 * 60 * 1000; // janela de 15 minutos
const MAX_ATTEMPTS = 10; // limite de tentativas por janela

/**
 * Verifica se o IP ultrapassou o limite de tentativas.
 * Retorna { allowed: true } se permitido, { allowed: false, retryAfterMs } se bloqueado.
 */
export function checkRateLimit(ip: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const record = store.get(ip);

  if (!record) {
    // Segurança contra exaustão de memória (DoS)
    if (store.size > 10000) {
      // Limpa os primeiros 1000 iteradores (os mais antigos devido a ordem de inserção do Map)
      let i = 0;
      for (const k of store.keys()) {
        store.delete(k);
        if (++i > 1000) break;
      }
    }

    const timeoutId = setTimeout(() => store.delete(ip), WINDOW_MS);
    timeoutId.unref?.(); // Evita bloquear o encerramento do Node.js
    store.set(ip, { count: 1, firstAttempt: now, timeoutId });
    return { allowed: true };
  }

  const elapsed = now - record.firstAttempt;

  if (elapsed > WINDOW_MS) {
    // janela expirou, reseta a contagem
    if (record.timeoutId) clearTimeout(record.timeoutId);
    const timeoutId = setTimeout(() => store.delete(ip), WINDOW_MS);
    timeoutId.unref?.();
    store.set(ip, { count: 1, firstAttempt: now, timeoutId });
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
  const record = store.get(ip);
  if (record?.timeoutId) {
    clearTimeout(record.timeoutId);
  }
  store.delete(ip);
}
