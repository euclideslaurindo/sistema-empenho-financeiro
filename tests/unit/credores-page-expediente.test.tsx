import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
import { apiClient } from '@/lib/api-client';
import Credores from '@/app/credores/page';

const MUNICIPIOS = [
  { chave: 'canhotinho', nome: 'Canhotinho', uf: 'PE', apelidos: null, ativo: true },
  { chave: 'sao bento do una', nome: 'São Bento do Una', uf: 'PE', apelidos: 'sbu', ativo: true },
  { chave: 'jupi', nome: 'Jupi', uf: 'PE', apelidos: null, ativo: false },
];

describe('Cadastro de credores — Município (Expediente) (T33)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = vi.fn() as any; // a tela rola ao abrir um credor; o jsdom não implementa
    (apiClient.get as any).mockImplementation(async (url: string) =>
      url.includes('iss-municipios')
        ? { municipios: MUNICIPIOS }
        : {
            credores: [
              { id: 'c1', nome: 'Maria Cavalcanti ME', cpfCnpj: '11.111.111/0001-11', cidade: 'Garanhuns', uf: 'PE', municipioExpediente: 'Canhotinho' },
              { id: 'c2', nome: 'José Silva', cpfCnpj: '222.222.222-22', cidade: 'Garanhuns', uf: 'PE', municipioExpediente: null },
            ],
            pagination: { totalPages: 1, total: 2 },
          }
    );
  });

  test('campo opcional com ajuda e sugestões só dos municípios ativos', async () => {
    const { container } = render(<Credores />);
    const campo = await screen.findByLabelText('Município (Expediente)');
    expect(campo).not.toBeRequired();
    expect(screen.getByText(/Preencha só se este credor tiver taxa de expediente/)).toBeInTheDocument();
    await waitFor(() => expect(container.querySelectorAll('#credor-municipios-iss option')).toHaveLength(2));
    const sugestoes = [...container.querySelectorAll('#credor-municipios-iss option')].map((o) => o.getAttribute('value'));
    expect(sugestoes).toEqual(['Canhotinho', 'São Bento do Una']);
    expect(campo).toHaveAttribute('list', 'credor-municipios-iss');
  });

  test('aviso não bloqueante só quando o município não tem cadastro de ISS', async () => {
    render(<Credores />);
    const campo = await screen.findByLabelText('Município (Expediente)');
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/configuracoes/iss-municipios'));

    fireEvent.change(campo, { target: { value: 'Recife' } });
    expect(await screen.findByText(/Município sem cadastro de ISS; a taxa de expediente será R\$ 0,00/)).toBeInTheDocument();

    fireEvent.change(campo, { target: { value: 'SBU' } }); // apelido
    await waitFor(() => expect(screen.queryByText(/Município sem cadastro de ISS/)).toBeNull());

    fireEvent.change(campo, { target: { value: '' } });
    expect(screen.queryByText(/Município sem cadastro de ISS/)).toBeNull();
  });

  test('a lista mostra o município de expediente só de quem tem', async () => {
    render(<Credores />);
    const maria = (await screen.findByText('Maria Cavalcanti ME')).closest('tr')!;
    expect(within(maria).getByText('expediente: Canhotinho')).toBeInTheDocument();
    const jose = screen.getByText('José Silva').closest('tr')!;
    expect(within(jose).queryByText(/expediente:/)).toBeNull();
  });

  test('salvar envia municipioExpediente', async () => {
    (apiClient.put as any).mockResolvedValue({ success: true });
    render(<Credores />);
    fireEvent.click(await screen.findByText('Maria Cavalcanti ME'));
    const campo = screen.getByLabelText('Município (Expediente)') as HTMLInputElement;
    expect(campo.value).toBe('Canhotinho');
    fireEvent.change(campo, { target: { value: 'Jupi' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
    await waitFor(() => expect(apiClient.put).toHaveBeenCalled());
    expect((apiClient.put as any).mock.calls[0][1]).toMatchObject({ municipioExpediente: 'Jupi' });
  });
});
