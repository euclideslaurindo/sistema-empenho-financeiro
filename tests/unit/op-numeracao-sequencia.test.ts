import { describe, test, expect, vi } from 'vitest';

// T34-B: no lote, cada OP chama a numeração na MESMA conexão; o INSERT anterior
// já é visível, então os números saem em sequência. Numeração real (sem mock).

vi.mock('@/lib/db', () => ({ query: vi.fn(), withTransaction: vi.fn() }));
vi.mock('@/lib/services/calculo-op.service', () => ({
  calcularRetencoesDaOp: vi.fn(async (_conn: any, e: any) => ({
    resultado: { itens: {}, totalDescontosCents: 0, liquidoCents: e.brutoCents, snapshot: {}, avisos: [] },
    configCampos: [],
  })),
}));
vi.mock('@/lib/services/darf.service', () => ({
  entraDarfDaConfig: vi.fn(() => []),
  removerDarfDaOp: vi.fn(),
  sincronizarDarfDaOp: vi.fn(),
}));

import { criarOpNaTransacao, ordemPagamentoSchema } from '@/lib/services/ordem-pagamento-core';

const ANO = new Date().getFullYear();

/** "Tabela" ordens_pagamento em memória: os MAX enxergam o que já foi inserido. */
function conexaoComTabela(existentes: Array<{ numero_empenho: string; numero_ne: string; sub: string }>) {
  const linhas = [...existentes];
  const seq = (s: string) => Number(s.split('.').pop());
  const conn: any = {
    execute: vi.fn(async (sql: string, params: any[] = []) => {
      if (sql.includes('INSERT INTO ordens_pagamento')) {
        linhas.push({ numero_ne: params[2], numero_empenho: params[3], sub: params[4] });
        return [{ affectedRows: 1 }];
      }
      if (sql.includes('SUBSTRING_INDEX(numero_empenho')) {
        const prefixo = String(params[0]).replace('%', '');
        const max = Math.max(0, ...linhas.filter((l) => l.numero_empenho.startsWith(prefixo)).map((l) => seq(l.numero_empenho)));
        return [max ? [{ seq: max }] : []];
      }
      if (sql.includes('CAST(sub AS UNSIGNED)')) {
        const max = Math.max(0, ...linhas.filter((l) => l.numero_ne === params[0]).map((l) => Number(l.sub)));
        return [max ? [{ seq: max }] : []];
      }
      if (sql.includes('as total_pago')) return [[{ total_pago: 0 }]];
      return [[]];
    }),
  };
  return conn;
}

test('duas OPs na mesma conexão: números e sub em sequência', async () => {
  const conn = conexaoComTabela([
    { numero_empenho: `${ANO}.OP.0011`, numero_ne: 'OUTRA-NE', sub: '01' },
  ]);
  const ctx = { usuarioId: 'u1', perfil: 'GESTOR', neRow: { valor: '1000.00', elemento: '', subelemento: '' }, chequeFormatado: null };
  const dados = (valor: number) => ordemPagamentoSchema.parse({ numeroEmpenho: 'NE-1', credorCpfCnpj: '1', valorPagamento: valor });

  const a = await criarOpNaTransacao(conn, dados(40), ctx);
  const b = await criarOpNaTransacao(conn, dados(50), ctx);
  expect([a.numeroOp, a.sub]).toEqual([`${ANO}.OP.0012`, '01']);
  expect([b.numeroOp, b.sub]).toEqual([`${ANO}.OP.0013`, '02']);
});
