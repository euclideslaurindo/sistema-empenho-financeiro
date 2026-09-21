import { vi } from 'vitest';

/**
 * Factory para criar um mock consistente de @/lib/db.
 * Usado por testes de integração para evitar duplicação de boilerplate.
 */
export function createDbMock() {
  return {
    query: vi.fn(),
    withTransaction: vi.fn(async (callback: any) => {
      const conn = {
        execute: vi.fn(),
      };
      return await callback(conn);
    }),
  };
}
