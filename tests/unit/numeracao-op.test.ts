import { describe, test, expect, vi } from 'vitest';
import { calcularProximoNumeroOp, calcularProximosNumerosOp } from '@/lib/services/numeracao-op';

vi.mock('@/lib/db', () => ({ query: vi.fn(), withTransaction: vi.fn() }));

// T34-B: vários números previstos de uma vez, um por linha da emissão.
const execCom = (maxOp: number | null, maxSub: number | null) =>
  vi.fn(async (sql: string) => {
    if (sql.includes('SUBSTRING_INDEX(numero_empenho')) return maxOp === null ? [] : [{ seq: maxOp }];
    return maxSub === null ? [] : [{ seq: maxSub }];
  });

describe('calcularProximosNumerosOp', () => {
  test('3 números em sequência a partir do MAX, com só 2 consultas', async () => {
    const exec = execCom(11, null);
    expect(await calcularProximosNumerosOp(exec, 'NE-1', 3, { travar: false }, 2026)).toEqual([
      { numeroOp: '2026.OP.0012', sub: '01' },
      { numeroOp: '2026.OP.0013', sub: '02' },
      { numeroOp: '2026.OP.0014', sub: '03' },
    ]);
    expect(exec).toHaveBeenCalledTimes(2);
  });

  test('NE sem OPs começa em 0001/01; sub segue a sequência da NE', async () => {
    expect(await calcularProximosNumerosOp(execCom(null, null), 'NE-1', 1, { travar: false }, 2026)).toEqual([
      { numeroOp: '2026.OP.0001', sub: '01' },
    ]);
    const subs = (await calcularProximosNumerosOp(execCom(30, 4), 'NE-1', 2, { travar: false }, 2026)).map((n) => n.sub);
    expect(subs).toEqual(['05', '06']);
  });

  test('travar liga/desliga o FOR UPDATE', async () => {
    const travado = execCom(1, 1);
    await calcularProximosNumerosOp(travado, 'NE-1', 5, { travar: true }, 2026);
    for (const [sql] of travado.mock.calls) expect(sql).toContain('FOR UPDATE');
    const livre = execCom(1, 1);
    await calcularProximosNumerosOp(livre, 'NE-1', 5, { travar: false }, 2026);
    for (const [sql] of livre.mock.calls) expect(sql).not.toContain('FOR UPDATE');
  });

  test.each([0, 101, 1.5, NaN, -1])('quantidade %s -> erro, sem consultar o banco', async (q: number) => {
    const exec = execCom(1, 1);
    await expect(calcularProximosNumerosOp(exec, 'NE-1', q, { travar: false })).rejects.toThrow('Quantidade de OPs inválida');
    expect(exec).not.toHaveBeenCalled();
  });

  test('calcularProximoNumeroOp é o primeiro da lista, com o mesmo SQL', async () => {
    const a = execCom(7, 2);
    const b = execCom(7, 2);
    const um = await calcularProximoNumeroOp(a, 'NE-1', { travar: true }, 2026);
    const [primeiro] = await calcularProximosNumerosOp(b, 'NE-1', 1, { travar: true }, 2026);
    expect(um).toEqual(primeiro);
    expect(a.mock.calls).toEqual(b.mock.calls);
  });
});
