import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useForm, FormProvider, type UseFormReturn } from 'react-hook-form';
import { NeCredoresField, BotaoSalvarNe } from './NeCredoresField';
import type { CredorFormulario } from '@/lib/ne-credores';

vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }));
import { apiClient } from '@/lib/api-client';

const CADASTRO = [
  { id: 'c1', cpfCnpj: '11.111.111/0001-11', nome: 'Maria Cavalcanti ME', cidade: 'Garanhuns', uf: 'PE', isMei: 1 },
  { id: 'c2', cpfCnpj: '222.222.222-22', nome: 'José Silva', cidade: null, uf: null, isMei: 0 },
  { id: 'c3', cpfCnpj: '333.333.333-33', nome: 'Ana Souza', cidade: 'Recife', uf: 'PE', isMei: 0 },
];

const linha = (over: Partial<CredorFormulario>): CredorFormulario => ({
  cpfCnpj: '222.222.222-22', nome: 'José Silva', valorBruto: '', valorPago: 0, doCadastro: false, ...over,
});

function renderCampo(valorNE = '10.000,00', credores: CredorFormulario[] = []) {
  const ref: { methods?: UseFormReturn<any> } = {};
  const onSalvar = vi.fn();
  function Wrapper() {
    const methods = useForm<any>({ defaultValues: { valorNE, credores } });
    ref.methods = methods;
    return (
      <FormProvider {...methods}>
        <NeCredoresField />
        <BotaoSalvarNe onClick={onSalvar} />
      </FormProvider>
    );
  }
  render(<Wrapper />);
  return { methods: () => ref.methods!, onSalvar };
}

const salvar = () => screen.getByRole('button', { name: /salvar/i }) as HTMLButtonElement;
const diferenca = () => screen.getByTestId('diferenca-brutos').textContent;
const bruto = (i: number) => document.getElementById(`ne-credor-bruto-${i}`) as HTMLInputElement;
const digitarBruto = (i: number, digitos: string) => fireEvent.change(bruto(i), { target: { value: digitos } });

async function adicionarPelaBusca(termo: string, nome: string) {
  fireEvent.change(screen.getByRole('combobox'), { target: { value: termo } });
  fireEvent.click(await screen.findByText(nome));
}

describe('NeCredoresField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.get as any).mockImplementation(async (url: string) => {
      const termo = decodeURIComponent(url.split('busca=')[1].split('&')[0]).toLowerCase();
      return {
        credores: CADASTRO.filter(
          (c) => c.nome.toLowerCase().includes(termo) || c.cpfCnpj.replace(/\D/g, '').includes(termo.replace(/\D/g, '') || '§')
        ),
      };
    });
  });

  test('lista vazia: mensagem e Salvar desabilitado', () => {
    renderCampo();
    expect(screen.getAllByText('Adicione ao menos um credor.').length).toBeGreaterThan(0);
    expect(salvar().disabled).toBe(true);
  });

  test('3 credores pela busca somando o valor da NE habilitam o Salvar; selo MEI e município aparecem', async () => {
    renderCampo('10.000,00');
    await adicionarPelaBusca('Maria', 'Maria Cavalcanti ME');
    await adicionarPelaBusca('José', 'José Silva');
    await adicionarPelaBusca('Ana', 'Ana Souza');
    expect(screen.getByText('MEI')).toBeInTheDocument();
    expect(screen.getByText(/Garanhuns\/PE/)).toBeInTheDocument();

    digitarBruto(0, '500000');
    digitarBruto(1, '300000');
    digitarBruto(2, '199999');
    await waitFor(() => expect(diferenca()).toBe('Falta R$ 0,01'));
    expect(salvar().disabled).toBe(true);

    digitarBruto(2, '200000');
    await waitFor(() => expect(diferenca()).toBe('Soma confere'));
    expect(salvar().disabled).toBe(false);
  });

  test('sobra de 1 centavo também bloqueia', async () => {
    renderCampo('100,00', [linha({ valorBruto: '100,01' })]);
    await waitFor(() => expect(diferenca()).toBe('Sobra R$ 0,01'));
    expect(salvar().disabled).toBe(true);
  });

  test('remover credor atualiza a soma e devolve o foco', async () => {
    renderCampo('100,00', [
      linha({ cpfCnpj: '1', nome: 'A', valorBruto: '60,00' }),
      linha({ cpfCnpj: '2', nome: 'B', valorBruto: '40,00' }),
    ]);
    await waitFor(() => expect(diferenca()).toBe('Soma confere'));
    fireEvent.click(screen.getByRole('button', { name: 'Remover B' }));
    await waitFor(() => expect(diferenca()).toBe('Falta R$ 40,00'));
    await waitFor(() => expect(document.activeElement).toBe(bruto(0)));
  });

  test('não adiciona o mesmo credor duas vezes (mesmo com máscara diferente)', async () => {
    renderCampo('100,00', [linha({ cpfCnpj: '22222222222' })]);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'José' } });
    const opcao = await screen.findByRole('option');
    expect(opcao).toHaveAttribute('aria-disabled', 'true');
    expect(opcao).toHaveTextContent('já adicionado');
    fireEvent.click(opcao);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  test('credor que já recebeu OP não pode ser removido e mostra o mínimo', () => {
    renderCampo('100,00', [linha({ valorBruto: '100,00', valorPago: 30 })]);
    expect((screen.getByRole('button', { name: 'Remover José Silva' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Já recebeu R\$ 30,00 em OP \(mín\. R\$ 30,00\)/)).toBeInTheDocument();
  });

  test('credor legado mostra aviso de não verificado', () => {
    renderCampo('100,00', [linha({ legado: true })]);
    expect(screen.getByText(/não verificado no cadastro/i)).toBeInTheDocument();
  });

  test('dividir igualmente: 100,00 em 3 -> 33,33 / 33,33 / 33,34', async () => {
    renderCampo('100,00', [linha({ cpfCnpj: '1', nome: 'A' }), linha({ cpfCnpj: '2', nome: 'B' }), linha({ cpfCnpj: '3', nome: 'C' })]);
    fireEvent.click(screen.getByRole('button', { name: /dividir igualmente/i }));
    await waitFor(() => expect(diferenca()).toBe('Soma confere'));
    expect([bruto(0).value, bruto(1).value, bruto(2).value]).toEqual(['33,33', '33,33', '33,34']);
  });

  test('mudar o valor da NE recalcula a diferença na hora', async () => {
    const { methods } = renderCampo('100,00', [linha({ valorBruto: '100,00' })]);
    await waitFor(() => expect(diferenca()).toBe('Soma confere'));
    act(() => methods().setValue('valorNE', '150,00'));
    await waitFor(() => expect(diferenca()).toBe('Falta R$ 50,00'));
  });

  test('teclado: setas + Enter no autocomplete adicionam o credor', async () => {
    renderCampo();
    const busca = screen.getByRole('combobox');
    fireEvent.change(busca, { target: { value: 'Ana' } });
    await screen.findByRole('option');
    fireEvent.keyDown(busca, { key: 'ArrowDown' });
    expect(busca).toHaveAttribute('aria-activedescendant', 'ne-credor-opcao-0');
    fireEvent.keyDown(busca, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText('Ana Souza')).toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(bruto(0)));
  });

  test('40 credores: digitar um bruto atualiza a conferência', async () => {
    const muitos = Array.from({ length: 40 }, (_, i) => linha({ cpfCnpj: String(i + 1), nome: `C${i + 1}`, valorBruto: '1,00' }));
    renderCampo('41,00', muitos);
    await waitFor(() => expect(diferenca()).toBe('Falta R$ 1,00'));
    digitarBruto(39, '200');
    await waitFor(() => expect(diferenca()).toBe('Soma confere'));
  });
});
