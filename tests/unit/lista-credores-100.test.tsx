import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { useForm, FormProvider, useFieldArray } from 'react-hook-form';
import { CredoresOpLista } from '@/components/op-form/CredoresOpLista';
import { BarraTotaisEmissao } from '@/components/op-form/BarraTotaisEmissao';
import { linhaDoCredor, montarPayloadLote, type CredorLinha } from '@/lib/op-emissao';
import type { ConfigRetencoes } from '@/hooks/use-retencoes-config';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn(async () => ({ credores: [] })), post: vi.fn() } }));

// T35-B (rodada 3): emissão com 100 credores (o máximo do lote) continua usável.
// Painéis fechados por padrão; cada linha só observa a própria linha.

const CONFIG: ConfigRetencoes = {
  campos: [{ campo: 'irrf', rotulo: 'IRRF', tipo: 'PERCENTUAL', aliquota: 1.5, calculoAutomatico: true, editavelOperador: false, entraDarf: false, ativo: true, ordem: 10 }],
  regras: { '3.3.90.36': ['irrf'] },
  versao: 'x',
};

const CEM: CredorLinha[] = Array.from({ length: 100 }, (_, i) => ({
  ...linhaDoCredor({ cpfCnpj: String(i).padStart(11, '0'), nome: `Motorista ${i + 1}` }, 'Transporte', 'NE-1'),
  valorPagamento: '10,00',
}));

function Tela() {
  const methods = useForm<any>({ defaultValues: { neCarregada: 'NE-1', elemento: '3.3.90.36 - Serviços', dataEmissao: '2026-10-19', credores: CEM } });
  const { fields, remove } = useFieldArray({ control: methods.control, name: 'credores' });
  return (
    <FormProvider {...methods}>
      <CredoresOpLista
        chaves={fields.map((f: any) => f.chave)}
        neCarregada="NE-1"
        numeros={null}
        config={CONFIG}
        erroConfig={null}
        perfil="GESTOR"
        abertos={new Set()}
        errosLinhas={{}}
        onAdicionar={vi.fn()}
        onRemover={remove}
        onAlternar={vi.fn()}
        onLimparErros={vi.fn()}
      />
      <BarraTotaisEmissao saldoRestanteCents={150000} emitindo={false} podeEmitir onEmitir={vi.fn()} onLimpar={vi.fn()} />
    </FormProvider>
  );
}

describe('lista com 100 credores', () => {
  test('renderiza as 100 linhas com painéis fechados, totais certos e edição de uma linha só', async () => {
    const inicio = performance.now();
    render(<Tela />);
    const tempoRender = performance.now() - inicio;

    expect(screen.getAllByRole('group')).toHaveLength(100);
    expect(screen.queryAllByText('Dados do cadastro (somente leitura)')).toHaveLength(0); // nenhum painel aberto
    const barra = () => within(screen.getByTestId('barra-totais-emissao'));
    expect(barra().getByRole('button', { name: /Emitir 100 ordens de pagamento/ })).toBeEnabled();
    expect(barra().getByText('R$ 1.000,00')).toBeInTheDocument(); // soma
    expect(barra().getByText('R$ 500,00')).toBeInTheDocument(); // restante
    // limite folgado (jsdom é bem mais lento que o navegador): pega regressão grosseira, não mede o navegador
    expect(tempoRender).toBeLessThan(15000);

    // cálculo local de todas as linhas, mesmo com os painéis fechados
    await waitFor(() => expect(screen.getByTestId('liquido-linha-99')).toHaveTextContent('R$ 9,85'), { timeout: 5000 });

    const linha50 = within(screen.getByTestId('linha-credor-49'));
    fireEvent.change(linha50.getByLabelText('Valor a Pagar R$'), { target: { value: '2000' } });
    await waitFor(() => expect(barra().getByText('R$ 1.010,00')).toBeInTheDocument());
    expect(barra().getByText('R$ 490,00')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('liquido-linha-49')).toHaveTextContent('R$ 19,70'));
    expect(screen.getByTestId('liquido-linha-48')).toHaveTextContent('R$ 9,85');
  }, 30000);

  test('payload do lote com 100 credores, na ordem', () => {
    const p = montarPayloadLote({ neCarregada: 'NE-1', dataEmissao: '2026-10-19', credores: CEM });
    expect(p.credores).toHaveLength(100);
    expect(p.credores[0].credorCpfCnpj).toBe('00000000000');
    expect(p.credores[99].credorCpfCnpj).toBe('00000000099');
  });
});
