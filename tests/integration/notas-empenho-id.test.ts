import { describe, test, expect, vi, beforeEach } from 'vitest';
import { PUT, DELETE } from '@/app/api/notas-empenho/[id]/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
  unauthorizedResponse: () => ({ status: 401, json: async () => ({ error: 'Não autenticado' }) })
}));

import { getAuthUser } from '@/lib/auth';
import { withTransaction } from '@/lib/db';

/** Colunas e valores do `UPDATE notas_empenho … SET a = ?, b = ? … WHERE id = ?`, por nome. */
function gravadoNoUpdate(chamadas: Array<[string, any[]]>): Record<string, any> {
  const [sql, valores] = chamadas.find(([s]) => s.includes('UPDATE notas_empenho'))!;
  const colunas = sql.match(/SET (.*) WHERE/s)![1].split(',').map((c) => c.replace('= ?', '').trim());
  return Object.fromEntries(colunas.map((c, i) => [c, valores[i]]));
}

describe('Integração API Notas de Empenho [id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PUT — Atualizar Nota de Empenho', () => {
    test('Atualização válida retorna 200', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      (withTransaction as any).mockImplementationOnce(async (cb: any) => {
        const conn = {
          execute: vi.fn().mockImplementation(async (sql: string) => {
            if (sql.includes('FOR UPDATE')) return [[{ numero: 'NE-001', valor: 10000, status: 'EMITIDO' }]];
            if (sql.includes('SELECT id FROM notas_empenho WHERE numero')) return [[]];
            if (sql.includes('SUM(op.valor_pagamento)')) return [[{ total_pago: 3000 }]];
            if (sql.includes('SELECT id FROM usuarios')) return [[{ id: '123' }]];
            if (sql.includes('UPDATE notas_empenho')) return [{ affectedRows: 1 }];
            return [[]];
          }),
        };
        return await cb(conn);
      });

      const req = new NextRequest('http://localhost:3000/api/notas-empenho/ne-123', {
        method: 'PUT',
        body: JSON.stringify({
          numero: 'NE-001',
          valor: 8000, // reduz, mas acima do total já pago
        }),
      });

      const res: any = await PUT(req, { params: Promise.resolve({ id: 'ne-123' }) });
      expect(res.status).toBe(200);
    });

    test('Reduzir valor abaixo do total já pago retorna 409', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      (withTransaction as any).mockImplementationOnce(async (cb: any) => {
        const conn = {
          execute: vi.fn().mockImplementation(async (sql: string) => {
            if (sql.includes('FOR UPDATE')) return [[{ numero: 'NE-001', valor: 10000, status: 'EMITIDO' }]];
            if (sql.includes('SELECT id FROM notas_empenho WHERE numero')) return [[]];
            if (sql.includes('SUM(op.valor_pagamento)')) return [[{ total_pago: 5000 }]];
            if (sql.includes('SELECT id FROM usuarios')) return [[{ id: '123' }]];
            return [[]];
          }),
        };
        return await cb(conn);
      });

      const req = new NextRequest('http://localhost:3000/api/notas-empenho/ne-123', {
        method: 'PUT',
        body: JSON.stringify({
          numero: 'NE-001',
          valor: 4000, // menor que 5k já pago → falha
        }),
      });

      const res: any = await PUT(req, { params: Promise.resolve({ id: 'ne-123' }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain('Não é possível reduzir');
    });

    test('Número duplicado com outro registro retorna 409', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      (withTransaction as any).mockImplementationOnce(async (cb: any) => {
        const conn = {
          execute: vi.fn()
            .mockResolvedValueOnce([[{ numero: 'NE-001', valor: 10000 }]]) // SELECT for UPDATE
            .mockResolvedValueOnce([[{ id: 'ne-999' }]]), // outro registro com este número
        };
        return await cb(conn);
      });

      const req = new NextRequest('http://localhost:3000/api/notas-empenho/ne-123', {
        method: 'PUT',
        body: JSON.stringify({
          numero: 'NE-EXISTENTE', // já usado por outro
          valor: 10000,
        }),
      });

      const res: any = await PUT(req, { params: Promise.resolve({ id: 'ne-123' }) });
      expect(res.status).toBe(409);
    });
  });

  describe('PUT — status da NE (PR 0 da T31)', () => {
    // Antes, a tela mandava sempre status "EMITIDO" e o serviço gravava,
    // reabrindo NE parcial, liquidada e cancelada. Agora vem do saldo.
    function editarCom(ne: { valor: string; status: string }, totalPago: number, body: any = {}) {
      const chamadas: Array<[string, any[]]> = [];
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });
      (withTransaction as any).mockImplementationOnce(async (cb: any) =>
        cb({
          execute: vi.fn(async (sql: string, params: any[] = []) => {
            chamadas.push([sql, params]);
            if (sql.includes('FROM notas_empenho WHERE id = ? FOR UPDATE')) return [[{ id: 'ne-123', numero: 'NE-001', ...ne }]];
            if (sql.includes('SUM(op.valor_pagamento)')) return [[{ total_pago: totalPago }]];
            if (sql.includes('SELECT id FROM usuarios')) return [[{ id: '123' }]];
            return [[]];
          }),
        })
      );
      const req = new NextRequest('http://localhost:3000/api/notas-empenho/ne-123', {
        method: 'PUT',
        body: JSON.stringify({ numero: 'NE-001', valor: Number(ne.valor), ...body }),
      });
      return { chamadas, resposta: PUT(req, { params: Promise.resolve({ id: 'ne-123' }) }) as Promise<any> };
    }
    const statusGravado = (chamadas: Array<[string, any[]]>) => gravadoNoUpdate(chamadas).status;
    const statusAuditado = (chamadas: Array<[string, any[]]>) =>
      JSON.parse(chamadas.find(([sql]) => sql.includes('INSERT INTO auditoria_financeira'))![1][5]).status;

    test('NE parcial editada continua PARCIALMENTE PAGO (a tela mandaria EMITIDO)', async () => {
      const { chamadas, resposta } = editarCom({ valor: '10000.00', status: 'PARCIALMENTE PAGO' }, 3000, { status: 'EMITIDO' });
      expect((await resposta).status).toBe(200);
      expect(statusGravado(chamadas)).toBe('PARCIALMENTE PAGO');
      expect(statusAuditado(chamadas)).toBe('PARCIALMENTE PAGO');
    });

    test('NE liquidada editada sem mudar o valor continua LIQUIDADO', async () => {
      const { chamadas, resposta } = editarCom({ valor: '10000.00', status: 'LIQUIDADO' }, 10000);
      expect((await resposta).status).toBe(200);
      expect(statusGravado(chamadas)).toBe('LIQUIDADO');
    });

    test('NE liquidada com valor aumentado passa a PARCIALMENTE PAGO', async () => {
      const { chamadas, resposta } = editarCom({ valor: '10000.00', status: 'LIQUIDADO' }, 10000, { valor: 12000 });
      expect((await resposta).status).toBe(200);
      expect(statusGravado(chamadas)).toBe('PARCIALMENTE PAGO');
    });

    test('NE cancelada editada continua CANCELADO', async () => {
      const { chamadas, resposta } = editarCom({ valor: '500.00', status: 'CANCELADO' }, 0, { status: 'EMITIDO' });
      expect((await resposta).status).toBe(200);
      expect(statusGravado(chamadas)).toBe('CANCELADO');
    });

    test('status vindo do cliente é ignorado: NE sem OP fica EMITIDO mesmo pedindo CANCELADO', async () => {
      const { chamadas, resposta } = editarCom({ valor: '500.00', status: 'EMITIDO' }, 0, { status: 'CANCELADO' });
      expect((await resposta).status).toBe(200);
      expect(statusGravado(chamadas)).toBe('EMITIDO');
    });
  });

  describe('PUT — datas da NE (T29)', () => {
    function editar(body: any) {
      const chamadas: Array<[string, any[]]> = [];
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });
      (withTransaction as any).mockImplementationOnce(async (cb: any) =>
        cb({
          execute: vi.fn(async (sql: string, params: any[] = []) => {
            chamadas.push([sql, params]);
            if (sql.includes('FROM notas_empenho WHERE id = ? FOR UPDATE')) {
              return [[{ id: 'ne-123', numero: 'NE-001', valor: '100.00', status: 'EMITIDO', data_pagamento: '2026-03-10', data_emissao: '2026-03-01' }]];
            }
            if (sql.includes('SUM(op.valor_pagamento)')) return [[{ total_pago: 0 }]];
            if (sql.includes('SELECT id FROM usuarios')) return [[{ id: '123' }]];
            return [[]];
          }),
        })
      );
      const resposta = PUT(
        new NextRequest('http://localhost:3000/api/notas-empenho/ne-123', {
          method: 'PUT',
          body: JSON.stringify({ numero: 'NE-001', valor: 100, ...body }),
        }),
        { params: Promise.resolve({ id: 'ne-123' }) }
      ) as Promise<any>;
      return { chamadas, resposta };
    }

    test('sem dataPagamento/dataEmissao no payload, o UPDATE não toca nessas colunas (NE antiga mantém as datas)', async () => {
      const { chamadas, resposta } = editar({ dataProvisaoConcedida: '2026-02-01', historico: 'Obs' });
      expect((await resposta).status).toBe(200);
      const gravado = gravadoNoUpdate(chamadas);
      expect(gravado).not.toHaveProperty('data_pagamento');
      expect(gravado).not.toHaveProperty('data_emissao');
      expect(gravado.data_provisao_concedida).toBe('2026-02-01');
      expect(gravado).not.toHaveProperty('exercicio');
    });

    test.each([
      ['100.00', 100], // formato em que o banco devolve: antes gravava 10000
      ['1234.50', 1234.5],
      ['1.234,50', 1234.5],
      [100, 100],
    ])('valor %s no PUT é gravado como %s (nunca ×100)', async (valor: string | number, gravadoEsperado: number) => {
      const { chamadas, resposta } = editar({ valor });
      expect((await resposta).status).toBe(200);
      expect(Number(gravadoNoUpdate(chamadas).valor)).toBe(gravadoEsperado);
    });

    test('valor inválido no PUT -> 400 e nada gravado', async () => {
      const { chamadas, resposta } = editar({ valor: 'abc' });
      expect((await resposta).status).toBe(400);
      expect(chamadas.some(([sql]) => sql.startsWith('UPDATE notas_empenho'))).toBe(false);
      // a validação recusa antes da transação: descarta o mock "uma vez" que sobrou
      (withTransaction as any).mockReset();
    });

    test('com as chaves no payload (compatibilidade), grava as datas', async () => {
      const { chamadas, resposta } = editar({ dataPagamento: '2026-05-05', dataEmissao: null });
      expect((await resposta).status).toBe(200);
      const gravado = gravadoNoUpdate(chamadas);
      expect(gravado.data_pagamento).toBe('2026-05-05');
      expect(gravado.data_emissao).toBeNull();
    });
  });

  describe('PUT — NE sem credor (T30)', () => {
    function editar(ne: Record<string, unknown>, body: Record<string, unknown>) {
      const chamadas: Array<[string, any[]]> = [];
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });
      (withTransaction as any).mockImplementationOnce(async (cb: any) =>
        cb({
          execute: vi.fn(async (sql: string, params: any[] = []) => {
            chamadas.push([sql, params]);
            if (sql.includes('FROM notas_empenho WHERE id = ? FOR UPDATE')) return [[{ id: 'ne-123', numero: 'NE-001', valor: '10000.00', status: 'EMITIDO', ...ne }]];
            if (sql.includes('SELECT id FROM notas_empenho WHERE numero')) return [[]];
            if (sql.includes('SUM(op.valor_pagamento)')) return [[{ total_pago: 0 }]];
            if (sql.includes('FROM ne_credores')) return [[{ credor_cpf_cnpj: '222.222.222-22', credor_nome: 'José', valor_bruto: '10000.00' }]];
            if (sql.includes('SELECT id FROM usuarios')) return [[{ id: '123' }]];
            return [{ affectedRows: 1 }];
          }),
        })
      );
      const resposta = PUT(
        new NextRequest('http://localhost:3000/api/notas-empenho/ne-123', { method: 'PUT', body: JSON.stringify({ numero: 'NE-001', valor: 10000, ...body }) }),
        { params: Promise.resolve({ id: 'ne-123' }) }
      ) as Promise<any>;
      return { chamadas, resposta };
    }

    test('editar uma NE antiga não toca em ne_credores nem em credor_nome/cpf_cnpj', async () => {
      const { chamadas, resposta } = editar(
        { credor_nome: 'José', cpf_cnpj: '222.222.222-22' },
        { historico: 'Obs nova' }
      );
      expect((await resposta).status).toBe(200);
      expect(chamadas.some(([sql]) => sql.includes('ne_credores'))).toBe(false);
      const gravado = gravadoNoUpdate(chamadas);
      expect(gravado).not.toHaveProperty('credor_nome');
      expect(gravado).not.toHaveProperty('cpf_cnpj');
      expect(gravado.historico).toBe('Obs nova');
    });

    test('credores/credorNome/cpfCnpj no payload (cliente antigo) são ignorados, mesmo com soma que não fecha', async () => {
      const { chamadas, resposta } = editar({}, {
        credorNome: 'Outro',
        cpfCnpj: '999.999.999-99',
        credores: [{ cpfCnpj: '11111111000111', valorBruto: 1 }],
      });
      expect((await resposta).status).toBe(200);
      expect(chamadas.some(([sql]) => sql.includes('ne_credores'))).toBe(false);
      expect(gravadoNoUpdate(chamadas)).not.toHaveProperty('cpf_cnpj');
    });

    test('renomear a NE não mexe em ne_credores (a tabela fica sem uso)', async () => {
      const { chamadas, resposta } = editar({}, { numero: 'NE-001-NOVO' });
      expect((await resposta).status).toBe(200);
      expect(gravadoNoUpdate(chamadas).numero).toBe('NE-001-NOVO');
      expect(chamadas.some(([sql]) => sql.includes('ne_credores'))).toBe(false);
    });

    test('auditoria UPDATE sem lista de credores', async () => {
      const { chamadas, resposta } = editar({}, {});
      expect((await resposta).status).toBe(200);
      const audit = chamadas.find(([sql]) => sql.includes('INSERT INTO auditoria_financeira'))!;
      expect(audit[1][3]).toBe('UPDATE');
      expect(JSON.parse(audit[1][5])).not.toHaveProperty('credores');
    });
  });

  describe('DELETE — Cancelar Nota de Empenho', () => {
    test('Cancelar NE sem OPs vinculadas retorna 200', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      (withTransaction as any).mockImplementationOnce(async (cb: any) => {
        const conn = {
          execute: vi.fn()
            .mockResolvedValueOnce([[{ numero: 'NE-001' }]]) // SELECT for UPDATE
            .mockResolvedValueOnce([[{ total_pago: 0 }]]) // nenhuma OP
            .mockResolvedValueOnce([{ affectedRows: 1 }]), // UPDATE status = CANCELADO
        };
        return await cb(conn);
      });

      const req = new NextRequest('http://localhost:3000/api/notas-empenho/ne-123', {
        method: 'DELETE',
      });

      const res: any = await DELETE(req, { params: Promise.resolve({ id: 'ne-123' }) });
      expect(res.status).toBe(200);
    });

    test('Cancelar NE com OPs vinculadas retorna 409', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      (withTransaction as any).mockImplementationOnce(async (cb: any) => {
        const conn = {
          execute: vi.fn()
            .mockResolvedValueOnce([[{ numero: 'NE-001' }]]) // SELECT for UPDATE
            .mockResolvedValueOnce([[{ total: 3 }]]), // 3 OPs vinculadas
        };
        return await cb(conn);
      });

      const req = new NextRequest('http://localhost:3000/api/notas-empenho/ne-123', {
        method: 'DELETE',
      });

      const res: any = await DELETE(req, { params: Promise.resolve({ id: 'ne-123' }) });
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain('3'); // menciona a contagem de OPs
    });

    test('Cancelar NE inexistente retorna 404', async () => {
      (getAuthUser as any).mockResolvedValue({ id: '123', perfil: 'ADMIN' });

      (withTransaction as any).mockImplementationOnce(async (cb: any) => {
        const conn = {
          execute: vi.fn().mockResolvedValueOnce([[]]), // não encontrada
        };
        return await cb(conn);
      });

      const req = new NextRequest('http://localhost:3000/api/notas-empenho/ne-inexistente', {
        method: 'DELETE',
      });

      const res: any = await DELETE(req, { params: Promise.resolve({ id: 'ne-inexistente' }) });
      expect(res.status).toBe(404);
    });
  });
});

describe('revisão da aba 3 (Notas de Empenho)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getAuthUser as any).mockResolvedValue({ id: 'u1', perfil: 'GESTOR' });
  });

  /** Conexão simulada pelo texto do SQL; guarda todas as chamadas. */
  const conexao = (resp: { ne?: any; gasto?: number; ops?: number } = {}) => {
    const chamadas: Array<[string, any[]]> = [];
    const execute = vi.fn(async (sql: string, params: any[] = []) => {
      chamadas.push([sql, params]);
      if (sql.includes('FOR UPDATE')) return [resp.ne ? [resp.ne] : []];
      if (sql.includes('SUM(op.valor_pagamento)')) return [[{ total_pago: resp.gasto ?? 0 }]];
      if (sql.includes('COUNT(*)')) return [[{ total: resp.ops ?? 0 }]];
      if (sql.includes('SELECT id FROM usuarios')) return [[{ id: 'u1' }]];
      if (sql.includes('SELECT id FROM notas_empenho WHERE numero')) return [[]];
      return [{ affectedRows: 1 }];
    });
    (withTransaction as any).mockImplementationOnce(async (cb: any) => cb({ execute }));
    return chamadas;
  };
  const put = (body: any) =>
    PUT(new NextRequest('http://localhost:3000/api/notas-empenho/ne-1', { method: 'PUT', body: JSON.stringify(body) }), { params: Promise.resolve({ id: 'ne-1' }) }) as any;
  const del = () =>
    DELETE(new NextRequest('http://localhost:3000/api/notas-empenho/ne-1', { method: 'DELETE' }), { params: Promise.resolve({ id: 'ne-1' }) }) as any;

  test('N1: cancelar registra na auditoria quem cancelou e o status antes/depois', async () => {
    const chamadas = conexao({ ne: { numero: '2026NE000001', valor: '100.00', status: 'EMITIDO' } });
    expect((await del()).status).toBe(200);
    const [sql, params] = chamadas.find(([s]) => s.includes('INSERT INTO auditoria_financeira'))!;
    expect(sql).toContain('auditoria_financeira');
    expect(params[1]).toBe('notas_empenho');
    expect(params[2]).toBe('ne-1');
    expect(params[3]).toBe('UPDATE');
    expect(JSON.parse(params[4]).status).toBe('EMITIDO');
    expect(JSON.parse(params[5]).status).toBe('CANCELADO');
    expect(params[6]).toBe('u1');
  });

  test('N1: cancelar uma NE já cancelada dá 409 e não grava nada', async () => {
    const chamadas = conexao({ ne: { numero: '2026NE000001', valor: '100.00', status: 'CANCELADO' } });
    const res = await del();
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain('já está cancelada');
    expect(chamadas.some(([s]) => s.startsWith('UPDATE') || s.includes('INSERT'))).toBe(false);
  });

  test('N6: trocar o número da NE leva a troca para o acompanhamento de DARF', async () => {
    const chamadas = conexao({ ne: { id: 'ne-1', numero: '2026NE000001', valor: '100.00', status: 'PARCIALMENTE PAGO' }, gasto: 40 });
    expect((await put({ numero: '2026NE000099', valor: 100 })).status).toBe(200);
    const darf = chamadas.find(([s]) => s.includes('UPDATE darf_acompanhamento'));
    expect(darf).toBeDefined();
    expect(darf![1]).toEqual(['2026NE000099', '2026NE000001']);
  });

  test('N6: sem trocar o número, o DARF não é tocado', async () => {
    const chamadas = conexao({ ne: { id: 'ne-1', numero: '2026NE000001', valor: '100.00', status: 'EMITIDO' } });
    expect((await put({ numero: '2026NE000001', valor: 150 })).status).toBe(200);
    expect(chamadas.some(([s]) => s.includes('darf_acompanhamento'))).toBe(false);
  });

  test.each([undefined, '', '   '])('N10: PUT sem número (%s) -> 400 e nada gravado', async (numero: any) => {
    const res = await put({ numero, valor: 100 });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Número da NE é obrigatório.');
    expect(withTransaction).not.toHaveBeenCalled();
  });

  test('N11: mensagem de redução com valores no formato brasileiro', async () => {
    conexao({ ne: { id: 'ne-1', numero: '2026NE000001', valor: '5000.00', status: 'PARCIALMENTE PAGO' }, gasto: 1234.5 });
    const res = await put({ numero: '2026NE000001', valor: 1000 });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe(
      'Não é possível reduzir o valor da NE para R$ 1.000,00 pois já foram geradas OPs no valor total de R$ 1.234,50.'
    );
  });
});
