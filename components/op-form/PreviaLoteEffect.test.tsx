import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { useForm, FormProvider, useFieldArray, type UseFormReturn } from 'react-hook-form';
import { PreviaLoteEffect } from './PreviaLoteEffect';
import { linhaDoCredor, type CredorLinha } from '@/lib/op-emissao';
import type { ConfigRetencoes } from '@/hooks/use-retencoes-config';

vi.mock('@/lib/api-client', () => ({ apiClient: { post: vi.fn(), get: vi.fn() } }));
import { apiClient } from '@/lib/api-client';

// T35-B (D43): no 3.3.90.33 a prévia vem do servidor, só das linhas que mudaram,
// e o resultado volta para a linha certa pela chave.

const CONFIG: ConfigRetencoes = {
  campos: ['irrf', 'iss', 'inss', 'patronal', 'sest_senat'].map((campo, i) => ({
    campo, rotulo: campo.toUpperCase(), tipo: 'PERCENTUAL' as const, aliquota: 1, calculoAutomatico: true,
    editavelOperador: false, entraDarf: false, ativo: true, ordem: i,
  })),
  regras: { '3.3.90.33': ['irrf', 'iss', 'inss', 'patronal', 'sest_senat'], '3.3.90.36': ['irrf'] },
  versao: 'x',
};

const linha = (cpf: string, valor: string): CredorLinha => ({
  ...linhaDoCredor({ cpfCnpj: cpf, nome: cpf }, 'Obs', 'NE-1'),
  valorPagamento: valor,
});

function renderLista(credores: CredorLinha[], elemento = '3.3.90.33 - Transporte') {
  const ref: { methods?: UseFormReturn<any>; remover?: (i: number) => void } = {};
  function Wrapper() {
    const methods = useForm<any>({ defaultValues: { elemento, neCarregada: 'NE-1', dataEmissao: '2026-10-19', credores } });
    const { remove } = useFieldArray({ control: methods.control, name: 'credores', keyName: 'idCampo' });
    ref.methods = methods;
    ref.remover = remove;
    return (
      <FormProvider {...methods}>
        <PreviaLoteEffect config={CONFIG} perfil="GESTOR" atraso={10} />
      </FormProvider>
    );
  }
  render(<Wrapper />);
  return ref as Required<typeof ref>;
}

const enviados = (chamada = 0) => (apiClient.post as any).mock.calls[chamada][1].credores.map((c: any) => [c.indice, c.credorCpfCnpj]);

describe('PreviaLoteEffect', () => {
  beforeEach(() => vi.clearAllMocks());

  test('.33: pede a prévia das linhas e grava o resultado de cada uma', async () => {
    (apiClient.post as any).mockResolvedValue({
      linhas: [
        { indice: 0, itens: { irrf: 10, iss: 5 }, avisos: [] },
        { indice: 1, itens: { irrf: 20 }, avisos: ['Município de expediente sem cadastro de ISS: X'] },
      ],
    });
    const f = renderLista([linha('111', '100,00'), linha('222', '200,00')]);
    await waitFor(() => expect(f.methods.getValues('credores.1.irrf')).toBe('20,00'));
    expect((apiClient.post as any).mock.calls[0][0]).toBe('/api/ordens-pagamento/previa-lote');
    expect(enviados()).toEqual([[0, '111'], [1, '222']]);
    expect(f.methods.getValues('credores.0.iss')).toBe('5,00');
    expect(f.methods.getValues('credores.1.previaAvisos')).toEqual(['Município de expediente sem cadastro de ISS: X']);
  });

  test('depois, só a linha que mudou vai de novo', async () => {
    (apiClient.post as any).mockImplementation(async (_url: string, body: any) => ({
      linhas: body.credores.map((c: any) => ({ indice: c.indice, itens: { irrf: 1 }, avisos: [] })),
    }));
    const f = renderLista([linha('111', '100,00'), linha('222', '200,00'), linha('333', '300,00')]);
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(f.methods.getValues('credores.2.irrf')).toBe('1,00'));
    act(() => f.methods.setValue('credores.1.valorPagamento', '250,00'));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(2));
    expect(enviados(1)).toEqual([[1, '222']]);
  });

  test('outro elemento: não chama o servidor (cálculo local)', async () => {
    renderLista([linha('111', '100,00')], '3.3.90.36 - Serviços');
    await new Promise((r) => setTimeout(r, 40));
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  test('linha sem valor: não vai na prévia e recebe o aviso', async () => {
    (apiClient.post as any).mockResolvedValue({ linhas: [{ indice: 0, itens: {}, avisos: [] }] });
    const f = renderLista([linha('111', '100,00'), linha('222', '')]);
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    expect(enviados()).toEqual([[0, '111']]);
    expect(f.methods.getValues('credores.1.previaAvisos')).toEqual(['Informe o valor a pagar para calcular o transporte.']);
  });

  test('removeram a linha do meio enquanto a prévia estava em voo: resultado vai para a linha certa pela chave', async () => {
    let responder!: (v: any) => void;
    (apiClient.post as any).mockImplementationOnce(() => new Promise((r) => (responder = r)));
    (apiClient.post as any).mockResolvedValue({ linhas: [] });
    const f = renderLista([linha('111', '100,00'), linha('222', '200,00'), linha('333', '300,00')]);
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));
    act(() => f.remover(1)); // a linha '333' passa a ser a 2ª
    await act(async () =>
      responder({
        linhas: [
          { indice: 0, itens: { irrf: 11 }, avisos: [] },
          { indice: 1, itens: { irrf: 22 }, avisos: [] },
          { indice: 2, itens: { irrf: 33 }, avisos: [] },
        ],
      })
    );
    await waitFor(() => expect(f.methods.getValues('credores.1.irrf')).toBe('33,00'));
    expect(f.methods.getValues('credores.1.cpfCnpj')).toBe('333');
    expect(f.methods.getValues('credores.0.irrf')).toBe('11,00');
  });

  test('a linha mudou de novo antes da resposta: resultado antigo descartado', async () => {
    let responder!: (v: any) => void;
    (apiClient.post as any).mockImplementationOnce(() => new Promise((r) => (responder = r)));
    (apiClient.post as any).mockImplementation(async () => ({ linhas: [{ indice: 0, itens: { irrf: 2 }, avisos: [] }] }));
    const f = renderLista([linha('111', '100,00')]);
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1));
    act(() => f.methods.setValue('credores.0.valorPagamento', '200,00'));
    await act(async () => responder({ linhas: [{ indice: 0, itens: { irrf: 1 }, avisos: [] }] }));
    await waitFor(() => expect(f.methods.getValues('credores.0.irrf')).toBe('2,00'));
  });

  test('erro de uma linha fica só nela', async () => {
    (apiClient.post as any).mockResolvedValue({
      linhas: [
        { indice: 0, erro: 'Sem parâmetros vigentes do transporte em 20/10/2026.' },
        { indice: 1, itens: { irrf: 3 }, avisos: [] },
      ],
    });
    const f = renderLista([linha('111', '100,00'), linha('222', '200,00')]);
    await waitFor(() => expect(f.methods.getValues('credores.1.irrf')).toBe('3,00'));
    expect(f.methods.getValues('credores.0.previaAvisos')).toEqual(['Sem parâmetros vigentes do transporte em 20/10/2026.']);
    expect(f.methods.getValues('credores.0.irrf')).toBe('');
  });

  test('falha da requisição: avisa nas linhas e tenta de novo na próxima mudança', async () => {
    (apiClient.post as any).mockRejectedValueOnce(new Error('Erro de conexão com o servidor.'));
    (apiClient.post as any).mockResolvedValue({ linhas: [{ indice: 0, itens: { irrf: 4 }, avisos: [] }] });
    const f = renderLista([linha('111', '100,00')]);
    await waitFor(() => expect(f.methods.getValues('credores.0.previaAvisos')).toEqual(['Erro de conexão com o servidor.']));
    act(() => f.methods.setValue('credores.0.dataPagamento', '2026-10-21'));
    await waitFor(() => expect(f.methods.getValues('credores.0.irrf')).toBe('4,00'));
  });
});
