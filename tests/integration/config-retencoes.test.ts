import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mesmo padrão da T04: `query` é a mesma função usada tanto para chamadas
// diretas quanto como `conn.execute` dentro de withTransaction.
vi.mock('@/lib/db', () => {
  const query = vi.fn();
  return {
    query,
    withTransaction: vi.fn(async (fn: any) => fn({ execute: query })),
  };
});

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(),
  unauthorizedResponse: () => ({ status: 401, json: async () => ({ error: 'Nao autenticado' }) }),
  forbiddenResponse: () => ({ status: 403, json: async () => ({ error: 'Acesso negado' }) }),
}));

import { query } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { GET, PUT } from '@/app/api/configuracoes/retencoes/route';

const campoValido = {
  campo: 'irrf',
  rotulo: 'IRRF',
  tipo: 'PERCENTUAL',
  aliquota: 1.5,
  calculoAutomatico: true,
  editavelOperador: false,
  entraDarf: false,
  ativo: true,
  ordem: 10,
};

describe('Integração API Configurações de Retenções', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/configuracoes/retencoes', () => {
    test('sem autenticação retorna 401', async () => {
      (getAuthUser as any).mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/configuracoes/retencoes', { method: 'GET' });
      const res: any = await GET(req);

      expect(res.status).toBe(401);
    });

    test('devolve campos, regras e versão, com Cache-Control: no-store', async () => {
      (getAuthUser as any).mockResolvedValue({ id: 'user-1', perfil: 'GESTOR' });
      (query as any)
        .mockResolvedValueOnce([{ ...campoValido, calculo_automatico: 1, editavel_operador: 0, entra_darf: 0, ativo: 1 }])
        .mockResolvedValueOnce([{ codigo: '3.3.90.14' }])
        .mockResolvedValueOnce([{ elemento_codigo: '3.3.90.14', campo: 'irrf' }])
        .mockResolvedValueOnce([{ versao: '2026-01-01T00:00:00.000Z' }]);

      const req = new NextRequest('http://localhost:3000/api/configuracoes/retencoes', { method: 'GET' });
      const res: any = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe('no-store');
      expect(data.campos).toHaveLength(1);
      expect(data.campos[0].calculoAutomatico).toBe(true);
      expect(data.regras['3.3.90.14']).toEqual(['irrf']);
      expect(data.versao).toBe('2026-01-01T00:00:00.000Z');
    });
  });

  describe('PUT /api/configuracoes/retencoes — permissões', () => {
    test('sem autenticação retorna 401', async () => {
      (getAuthUser as any).mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/configuracoes/retencoes', {
        method: 'PUT',
        body: JSON.stringify({ campos: [campoValido], regras: {} }),
      });
      const res: any = await PUT(req);

      expect(res.status).toBe(401);
    });

    test('GESTOR não pode alterar (403)', async () => {
      (getAuthUser as any).mockResolvedValue({ id: 'user-1', perfil: 'GESTOR' });

      const req = new NextRequest('http://localhost:3000/api/configuracoes/retencoes', {
        method: 'PUT',
        body: JSON.stringify({ campos: [campoValido], regras: {} }),
      });
      const res: any = await PUT(req);

      expect(res.status).toBe(403);
    });

    test('CONSULTA não pode alterar (403)', async () => {
      (getAuthUser as any).mockResolvedValue({ id: 'user-1', perfil: 'CONSULTA' });

      const req = new NextRequest('http://localhost:3000/api/configuracoes/retencoes', {
        method: 'PUT',
        body: JSON.stringify({ campos: [campoValido], regras: {} }),
      });
      const res: any = await PUT(req);

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/configuracoes/retencoes — validação', () => {
    beforeEach(() => {
      (getAuthUser as any).mockResolvedValue({ id: 'admin-1', perfil: 'ADMIN' });
    });

    test('alíquota acima de 100 retorna 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/configuracoes/retencoes', {
        method: 'PUT',
        body: JSON.stringify({ campos: [{ ...campoValido, aliquota: 101 }], regras: {} }),
      });
      const res: any = await PUT(req);
      expect(res.status).toBe(400);
    });

    test('alíquota com 5 casas decimais retorna 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/configuracoes/retencoes', {
        method: 'PUT',
        body: JSON.stringify({ campos: [{ ...campoValido, aliquota: 1.23456 }], regras: {} }),
      });
      const res: any = await PUT(req);
      expect(res.status).toBe(400);
    });

    test('taxa_bancaria com tipo PERCENTUAL retorna 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/configuracoes/retencoes', {
        method: 'PUT',
        body: JSON.stringify({
          campos: [
            {
              campo: 'taxa_bancaria',
              rotulo: 'Taxa bancária',
              tipo: 'PERCENTUAL',
              aliquota: 1,
              calculoAutomatico: false,
              editavelOperador: true,
              entraDarf: false,
              ativo: true,
              ordem: 70,
            },
          ],
          regras: {},
        }),
      });
      const res: any = await PUT(req);
      expect(res.status).toBe(400);
    });

    test('entraDarf=true em campo não-tributário (outros) retorna 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/configuracoes/retencoes', {
        method: 'PUT',
        body: JSON.stringify({
          campos: [
            {
              campo: 'outros',
              rotulo: 'Outros',
              tipo: 'VALOR_DIGITADO',
              aliquota: null,
              calculoAutomatico: false,
              editavelOperador: false,
              entraDarf: true,
              ativo: true,
              ordem: 60,
            },
          ],
          regras: {},
        }),
      });
      const res: any = await PUT(req);
      expect(res.status).toBe(400);
    });

    test('elemento inexistente em regras retorna 400', async () => {
      (query as any)
        .mockResolvedValueOnce([[{ campo: 'irrf', updated_at: '2026-01-01T00:00:00.000Z' }]]) // SELECT FOR UPDATE
        .mockResolvedValueOnce([[{ codigo: '3.3.90.14' }]]); // elementos existentes (não inclui 9.9.99.99)

      const req = new NextRequest('http://localhost:3000/api/configuracoes/retencoes', {
        method: 'PUT',
        body: JSON.stringify({ campos: [campoValido], regras: { '9.9.99.99': ['irrf'] } }),
      });
      const res: any = await PUT(req);
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/configuracoes/retencoes — concorrência e sucesso', () => {
    beforeEach(() => {
      (getAuthUser as any).mockResolvedValue({ id: 'admin-1', perfil: 'ADMIN' });
    });

    test('versaoBase desatualizada retorna 409', async () => {
      (query as any).mockResolvedValueOnce([[{ campo: 'irrf', updated_at: '2026-01-01T00:00:00.000Z' }]]);

      const req = new NextRequest('http://localhost:3000/api/configuracoes/retencoes', {
        method: 'PUT',
        body: JSON.stringify({
          campos: [campoValido],
          regras: {},
          versaoBase: '2020-01-01T00:00:00.000Z',
        }),
      });
      const res: any = await PUT(req);
      expect(res.status).toBe(409);
    });

    test('PUT válido retorna 200 e registra auditoria com antes/depois', async () => {
      (query as any)
        .mockResolvedValueOnce([[{ campo: 'irrf', updated_at: '2026-01-01T00:00:00.000Z' }]]) // SELECT FOR UPDATE
        .mockResolvedValueOnce([[{ codigo: '3.3.90.14' }]]) // elementos existentes
        .mockResolvedValue([[]]); // fallback pras demais chamadas (updates/deletes/inserts/selects sem conteúdo relevante)

      const req = new NextRequest('http://localhost:3000/api/configuracoes/retencoes', {
        method: 'PUT',
        body: JSON.stringify({ campos: [campoValido], regras: { '3.3.90.14': ['irrf'] } }),
      });
      const res: any = await PUT(req);

      expect(res.status).toBe(200);

      const auditCall = (query as any).mock.calls.find(
        (call: any[]) => typeof call[0] === 'string' && call[0].includes('auditoria_financeira')
      );
      expect(auditCall).toBeDefined();
      const values = auditCall[1];
      expect(values[1]).toBe('config_retencoes'); // entidade
      expect(values[3]).toBe('UPDATE'); // acao
      expect(values[4]).not.toBeNull(); // dados_anteriores
      expect(values[5]).not.toBeNull(); // dados_novos
      expect(values[6]).toBe('admin-1'); // usuario_id
    });
  });
});
