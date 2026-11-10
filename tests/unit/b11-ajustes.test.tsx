// B11 — login pela parte antes do @, via sem "EMPENHO Nº" e com "PAGO EM",
// OP como modelo e a migration_24 (redutor 978,62).
import fs from 'fs';
import path from 'path';
import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { candidatosDoLogin, correspondeAoLogin } from '@/lib/login-usuario';
import { linhaDaOpModelo, camposDaNe } from '@/lib/op-emissao';
import { EmpenhoVia } from '@/components/consulta-impressao/EmpenhoVia';

vi.mock('next/image', () => ({ default: (p: any) => <img alt={p.alt} /> }));

describe('login pela parte antes do @', () => {
  const AMANDA = 'amanda@adm.educacao.pe.gov.br';
  test('"amanda" casa só com amanda@… (exato)', () => {
    expect(correspondeAoLogin(AMANDA, 'amanda')).toBe(true);
    expect(correspondeAoLogin(AMANDA, ' Amanda ')).toBe(true);
    expect(correspondeAoLogin(AMANDA, 'aman')).toBe(false);
    expect(correspondeAoLogin('amanda.souza@adm.educacao.pe.gov.br', 'amanda')).toBe(false);
    expect(correspondeAoLogin(AMANDA, 'amanda@outro.gov.br')).toBe(false);
  });

  test('e-mail completo e nome interno @empenho.local continuam valendo', () => {
    expect(correspondeAoLogin(AMANDA, AMANDA)).toBe(true);
    expect(correspondeAoLogin('joao.silva.abc12345@empenho.local', 'joao silva')).toBe(true);
  });

  test('o e-mail exato vem primeiro; homônimos em domínios diferentes entram os dois (decide a senha)', () => {
    const usuarios = [{ email: 'amanda@outro.gov.br' }, { email: AMANDA }];
    expect(candidatosDoLogin(usuarios, 'amanda').map((u) => u.email)).toEqual(['amanda@outro.gov.br', AMANDA]);
    expect(candidatosDoLogin(usuarios, AMANDA)[0].email).toBe(AMANDA);
  });
});

describe('login — SQL', () => {
  test('busca também "<parte>@%" com % e _ escapados', async () => {
    vi.resetModules();
    const query = vi.fn().mockResolvedValue([]);
    vi.doMock('@/lib/db', () => ({ query }));
    const { POST } = await import('@/app/api/auth/login/route');
    const { NextRequest } = await import('next/server');
    await POST(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'x-forwarded-for': '10.9.9.9' },
        body: JSON.stringify({ email: 'ana_b%', senha: 'x' }),
      })
    );
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('OR email LIKE ? OR email LIKE ?');
    expect(params.at(-1)).toBe('ana\\_b\\%@%');
    vi.doUnmock('@/lib/db');
  });
});

describe('via da NE/OP', () => {
  const base = {
    numeroEmpenho: '2026NE000001', sub: '03', pagoData: '15/10/2026', numeroCheque: '777', provisaoData: '01/10/2026',
  };
  test('sem "EMPENHO Nº", sub só com o número e "PAGO EM" com a data', () => {
    render(<EmpenhoVia data={base} isEditing={false} onChange={vi.fn()} empenhoIndex={0} />);
    expect(screen.queryByText(/EMPENHO Nº/)).toBeNull();
    expect(screen.queryByText(/SUB-EMPENHO/)).toBeNull();
    expect(screen.getByTestId('via-sub')).toHaveTextContent(/^03$/);
    expect(screen.getByText('PAGO EM')).toBeInTheDocument();
    expect(screen.queryByText(/CHEQUE Nº/)).toBeNull();
    expect(screen.getByTestId('via-pago-em')).toHaveTextContent('15/10/2026');
  });

  test('no modo edição o "PAGO EM" edita a data', () => {
    render(<EmpenhoVia data={base} isEditing onChange={vi.fn()} />);
    expect(screen.getByLabelText('Pago em')).toHaveValue('15/10/2026');
  });
});

describe('OP como modelo', () => {
  test('valor e itens da OP; cheque, data e retenções em branco; credor do cadastro', () => {
    const l = linhaDaOpModelo(
      { valorPagamento: '1100.50', itensJson: JSON.stringify([{ especificacao: 'Rota', quantidade: 2, unidade: 'DIA', valorUnitario: 550.25 }]) },
      { cpfCnpj: '1', nome: 'Ana', isMei: 1 }
    );
    expect(l).toMatchObject({ cpfCnpj: '1', nomeCredor: 'Ana', credorMei: true, valorPagamento: '1.100,50', numeroCheque: '', dataPagamento: '', irrf: '', camposInformados: [] });
    expect(l.itens).toEqual([{ especificacao: 'Rota', quantidade: 2, unidade: 'DIA', valorUnitario: '550,25' }]);
  });

  test('itens ausentes ou JSON quebrado: 1 item em branco', () => {
    expect(linhaDaOpModelo({ valorPagamento: 10, itensJson: 'xx' }, { cpfCnpj: '1' }).itens).toEqual([
      { especificacao: '', quantidade: 1, unidade: 'UN', valorUnitario: '' },
    ]);
    expect(linhaDaOpModelo({ valorPagamento: 10 }, { cpfCnpj: '1' }).itens).toHaveLength(1);
  });

  test('camposDaNe', () => {
    expect(camposDaNe({ numero: 'NE-1', elemento: '3.3.90.39 - PJ', historico: 'Obs' })).toMatchObject({
      empenho: 'NE-1', neCarregada: 'NE-1', elemento: '3.3.90.39 - PJ', historicoNe: 'Obs', subelemento: '',
    });
  });
});

describe('migration_24', () => {
  const sql = fs.readFileSync(path.join(process.cwd(), 'database', 'migration_24.sql'), 'utf8');
  const ativo = sql
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');
  test('um UPDATE só na linha exata e se ainda for 978,61; nada removido', () => {
    expect(ativo.match(/\bUPDATE\b/g)).toHaveLength(1);
    expect(ativo).toMatch(
      /SET valor = 978\.62\s+WHERE perfil = 'PESSOA_FISICA'\s+AND chave = 'redutor_constante'\s+AND vigente_de = '2026-01-01'\s+AND valor = 978\.61;/
    );
    expect(ativo).not.toMatch(/\b(DROP|DELETE|ALTER|TRUNCATE)\b/i);
  });
});

describe('via: CPF x CNPJ', () => {
  test('CNPJ vai na linha "CNPJ"; CPF na linha "CPF"', async () => {
    const { pessoaTipoDoDocumento } = await import('@/lib/impressao-op');
    expect(pessoaTipoDoDocumento('11.222.333/0001-81')).toBe('JURIDICA');
    expect(pessoaTipoDoDocumento('138.958.414-39')).toBe('FISICA');
    expect(pessoaTipoDoDocumento('')).toBe('FISICA');
  });

  test('a via mostra o documento na linha certa', () => {
    // Coluna dos valores: 1ª linha = CPF, 2ª linha = CNPJ.
    const linhaDoDoc = (doc: string) => {
      const linha = screen.getByText(doc).closest('div.flex-1.flex')!;
      return Array.from(linha.parentElement!.children).indexOf(linha) === 0 ? 'CPF' : 'CNPJ';
    };
    const { unmount } = render(<EmpenhoVia data={{ credorCpfCnpj: '11.222.333/0001-81', pessoaTipo: 'JURIDICA' }} isEditing={false} onChange={vi.fn()} />);
    expect(linhaDoDoc('11.222.333/0001-81')).toBe('CNPJ');
    unmount();
    render(<EmpenhoVia data={{ credorCpfCnpj: '138.958.414-39', pessoaTipo: 'FISICA' }} isEditing={false} onChange={vi.fn()} />);
    expect(linhaDoDoc('138.958.414-39')).toBe('CPF');
  });
});
