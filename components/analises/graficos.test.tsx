// B3 — componentes de gráfico da aba Análises.
import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import {
  BarrasAgrupadas,
  BarrasEmpilhadas,
  BarrasHorizontais,
  BarrasVerticais,
  CartaoGrafico,
  Cascata,
  ESPACO_TOPO,
  FaixaQuantidade,
  calcularCascata,
  paleta,
  type EtapaCascata,
} from '.';

const alturaDe = (el: HTMLElement) => Number(el.getAttribute('data-altura'));
const k = (v: number) => Math.round(v * ESPACO_TOPO * 100) / 100;

const MESES = [
  { chave: '2026-03', rotulo: 'mar', rotuloLongo: 'Março' },
  { chave: '2026-04', rotulo: 'abr', rotuloLongo: 'Abril' },
];
const SERIES = [
  { chave: 'empenhado', nome: 'Empenhado', fundo: paleta.azulClaro },
  { chave: 'pago', nome: 'Pago', fundo: paleta.azul },
];
const VALORES = { '2026-03': { empenhado: 1000, pago: 400 }, '2026-04': { empenhado: 500, pago: 1500 } };

describe('CartaoGrafico', () => {
  const tabela = { legenda: 'Execução em tabela', colunas: ['Mês', 'Pago'], linhas: [['Março', 'R$ 400,00'], ['Abril', 'R$ 1.500,00']] };

  test('"Ver tabela" troca o gráfico pela tabela com os mesmos números, e volta', () => {
    render(
      <CartaoGrafico id="exec" sobretitulo="Execução mês a mês" titulo="Abril teve o maior pagamento" legenda={[{ nome: 'Empenhado', fundo: 'x' }, { nome: 'Pago', fundo: 'y' }]} tabela={tabela}>
        <p>o gráfico</p>
      </CartaoGrafico>
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Abril teve o maior pagamento' })).toBeInTheDocument();
    expect(screen.getByText('o gráfico')).toBeInTheDocument();
    expect(screen.getByText('Empenhado')).toBeInTheDocument();

    const botao = screen.getByRole('button', { name: 'Ver tabela' });
    expect(botao).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(botao);
    expect(screen.queryByText('o gráfico')).toBeNull();
    const t = screen.getByRole('table', { name: 'Execução em tabela' });
    expect(within(t).getByRole('rowheader', { name: 'Abril' })).toBeInTheDocument();
    expect(within(t).getByText('R$ 1.500,00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver gráfico' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Ver gráfico' }));
    expect(screen.getByText('o gráfico')).toBeInTheDocument();
  });

  test('uma série só: sem legenda; vazio: mensagem e sem "Ver tabela"', () => {
    const { rerender } = render(
      <CartaoGrafico id="a" sobretitulo="s" titulo="t" legenda={[{ nome: 'Pago', fundo: 'x' }]} tabela={tabela}>
        <p>g</p>
      </CartaoGrafico>
    );
    expect(screen.queryByRole('list')).toBeNull();
    rerender(
      <CartaoGrafico id="a" sobretitulo="s" titulo="t" tabela={tabela} vazio>
        <p>g</p>
      </CartaoGrafico>
    );
    expect(screen.getByText('Sem movimento no período.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver tabela' })).toBeNull();
    expect(screen.queryByText('g')).toBeNull();
  });
});

describe('Cascata', () => {
  const etapas = (saldo = 100): EtapaCascata[] => [
    { chave: 'emp', rotulo: 'Empenhado', valor: 1000, tipo: 'total', fundo: paleta.azulClaro },
    { chave: 'canc', rotulo: 'Cancelado', valor: 300, tipo: 'menos', fundo: paleta.hachuraCinza },
    { chave: 'liq', rotulo: 'Líquido pago', valor: 500, tipo: 'menos', fundo: paleta.azul },
    { chave: 'ret', rotulo: 'Retenções', valor: 100, tipo: 'menos', fundo: '#2a78d6' },
    { chave: 'saldo', rotulo: 'Saldo a pagar', valor: saldo, tipo: 'saldo', fundo: paleta.ambar },
  ];

  test('cada etapa começa onde a anterior terminou (com o espaço livre do topo)', () => {
    expect(calcularCascata(etapas())).toEqual([
      { chave: 'emp', base: 0, altura: k(100), topo: k(100) },
      { chave: 'canc', base: k(70), altura: k(30), topo: k(100) },
      { chave: 'liq', base: k(20), altura: k(50), topo: k(70) },
      { chave: 'ret', base: k(10), altura: k(10), topo: k(20) },
      { chave: 'saldo', base: 0, altura: k(10), topo: k(10) },
    ]);
  });

  test('desenha as barras com essa geometria e o valor curto em cima', () => {
    render(<Cascata etapas={etapas()} />);
    const liq = screen.getByTestId('cascata-liq');
    expect(liq.style.bottom).toBe(`${k(20)}%`);
    expect(liq.style.height).toBe(`${k(50)}%`);
    expect(screen.getByText('R$ 1 mil')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Líquido pago: R$ 500,00' })).toBeInTheDocument();
  });

  test('saldo negativo (dado sujo): barra com altura 0 e o rótulo com o sinal', () => {
    render(<Cascata etapas={etapas(-50)} />);
    expect(alturaDe(screen.getByTestId('cascata-saldo'))).toBe(0);
    expect(screen.getByText('−R$ 50,00')).toBeInTheDocument();
  });
});

describe('BarrasAgrupadas', () => {
  test('altura = valor sobre o teto redondo (2.000), com o espaço do topo', () => {
    render(<BarrasAgrupadas categorias={MESES} series={SERIES} valores={VALORES} />);
    expect(alturaDe(screen.getByTestId('barra-2026-04-pago'))).toBe(k(75));
    expect(alturaDe(screen.getByTestId('barra-2026-03-empenhado'))).toBe(k(50));
    expect(screen.getByText('R$ 2 mil')).toBeInTheDocument(); // linha do teto
    expect(screen.getByText('R$ 1 mil')).toBeInTheDocument(); // linha da metade
  });

  test('sem onSelecionar: sem botões; com: o clique manda a chave do mês', () => {
    const { rerender } = render(<BarrasAgrupadas categorias={MESES} series={SERIES} valores={VALORES} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    const onSelecionar = vi.fn();
    rerender(<BarrasAgrupadas categorias={MESES} series={SERIES} valores={VALORES} onSelecionar={onSelecionar} destaque="2026-04" />);
    fireEvent.click(screen.getByRole('button', { name: /^Abril: empenhado R\$ 500,00, pago R\$ 1\.500,00/ }));
    expect(onSelecionar).toHaveBeenCalledWith('2026-04');
    expect(screen.getAllByText('maior')).toHaveLength(1);
  });

  test('dica no mouse e no foco, ligada por aria-describedby; some ao sair e no Esc', () => {
    render(<BarrasAgrupadas categorias={MESES} series={SERIES} valores={VALORES} onSelecionar={() => {}} />);
    const barra = screen.getByRole('button', { name: /^Março/ });
    fireEvent.mouseEnter(barra);
    const dica = screen.getByRole('tooltip');
    expect(dica).toHaveTextContent('Março: empenhado R$ 1.000,00, pago R$ 400,00');
    expect(barra).toHaveAttribute('aria-describedby', dica.id);
    fireEvent.mouseLeave(barra);
    expect(screen.queryByRole('tooltip')).toBeNull();

    fireEvent.focus(barra);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.keyDown(barra, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.focus(barra);
    fireEvent.blur(barra);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  test('tudo zero: sem NaN', () => {
    render(<BarrasAgrupadas categorias={MESES} series={SERIES} valores={{}} />);
    expect(alturaDe(screen.getByTestId('barra-2026-03-pago'))).toBe(0);
  });
});

describe('BarrasVerticais e FaixaQuantidade', () => {
  const itens = [
    { chave: 'a', rotulo: 'A pagar', valor: 200, sub: '1 NE' },
    { chave: 'c', rotulo: 'Cancelada', valor: 300, fundo: paleta.hachuraCinza, sub: '2 NEs' },
  ];

  test('rótulo no topo de todas, cor própria do item e o texto de baixo', () => {
    render(<BarrasVerticais itens={itens} rotulosNoTopo="todos" grade={false} />);
    expect(screen.getByText('R$ 200,00')).toBeInTheDocument();
    expect(screen.getByText('R$ 300,00')).toBeInTheDocument();
    expect(screen.getByTestId('vertical-c').style.background).toContain('repeating-linear-gradient');
    expect(screen.getByText('2 NEs')).toBeInTheDocument();
    expect(alturaDe(screen.getByTestId('vertical-c'))).toBe(k(60)); // 300 / teto 500
  });

  test('só o destaque leva rótulo quando pedido "destaque"', () => {
    render(<BarrasVerticais itens={itens} destaque="c" />);
    expect(screen.queryByText('R$ 200,00')).toBeNull();
    expect(screen.getByText('R$ 300,00')).toBeInTheDocument();
  });

  test('faixa de quantidade: escala própria e contagem visível', () => {
    render(<FaixaQuantidade titulo="Quantidade de OPs" itens={[{ chave: 'mar', valor: 7 }, { chave: 'abr', valor: 14 }]} />);
    expect(alturaDe(screen.getByTestId('faixa-abr'))).toBe(78);
    expect(alturaDe(screen.getByTestId('faixa-mar'))).toBe(39);
    expect(screen.getByText('14')).toBeInTheDocument();
  });
});

describe('BarrasEmpilhadas', () => {
  const series = [
    { chave: 'inss', nome: 'INSS', fundo: '#2a78d6' },
    { chave: 'iss', nome: 'ISS', fundo: '#eb6834' },
    { chave: 'patronal', nome: 'Patronal', fundo: paleta.hachuraPatronal },
  ];

  test('segmento zero não é desenhado; ordem de baixo para cima é a das séries; topo arredondado', () => {
    render(<BarrasEmpilhadas categorias={MESES} series={series} valores={{ '2026-03': { inss: 100, iss: 0, patronal: 50 }, '2026-04': { inss: 0, iss: 0, patronal: 0 } }} />);
    expect(screen.queryByTestId('pilha-2026-03-iss')).toBeNull();
    expect(screen.queryAllByTestId(/^pilha-2026-04/)).toHaveLength(0);
    const coluna = screen.getByTestId('pilha-2026-03-inss').parentElement!;
    expect([...coluna.children].map((c) => c.getAttribute('data-testid'))).toEqual(['pilha-2026-03-inss', 'pilha-2026-03-patronal']);
    expect(screen.getByTestId('pilha-2026-03-patronal').className).toContain('rounded-t');
    expect(screen.getByTestId('pilha-2026-03-inss').className).not.toContain('rounded-t');
  });

  test('a dica lista todas as séries da coluna, inclusive as zeradas', () => {
    render(<BarrasEmpilhadas categorias={MESES} series={series} valores={{ '2026-03': { inss: 100, iss: 0, patronal: 50 } }} />);
    fireEvent.mouseEnter(screen.getByRole('img', { name: /^Março/ }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Março: INSS R$ 100,00, ISS R$ 0,00, Patronal R$ 50,00');
  });
});

describe('BarrasHorizontais', () => {
  test('largura relativa ao maior, valor curto e %; clique com a chave', () => {
    const onSelecionar = vi.fn();
    render(
      <BarrasHorizontais
        onSelecionar={onSelecionar}
        itens={[
          { chave: '3.3.90.33', rotulo: '3.3.90.33', sub: 'Transporte', valor: 600.3, pct: 60 },
          { chave: '3.3.90.36', rotulo: '3.3.90.36', sub: 'Serviços PF', valor: 400, pct: 40 },
        ]}
      />
    );
    expect(Number(screen.getByTestId('horizontal-3.3.90.33').getAttribute('data-largura'))).toBe(100);
    expect(Number(screen.getByTestId('horizontal-3.3.90.36').getAttribute('data-largura'))).toBe(66.63);
    expect(screen.getByText('40%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^3\.3\.90\.36 Serviços PF: R\$ 400,00 \(40%\)/ }));
    expect(onSelecionar).toHaveBeenCalledWith('3.3.90.36');
  });
});

describe('acessibilidade', () => {
  test('nenhuma barra é div clicável: ou é botão, ou imagem focável com nome', () => {
    const { container } = render(
      <>
        <BarrasAgrupadas categorias={MESES} series={SERIES} valores={VALORES} />
        <BarrasVerticais itens={[{ chave: 'x', rotulo: 'x', valor: 1 }]} />
      </>
    );
    for (const el of container.querySelectorAll('[role="img"]')) {
      expect(el.getAttribute('aria-label')).toBeTruthy();
      expect(el.getAttribute('tabindex')).toBe('0');
    }
    expect(container.querySelectorAll('div[onclick]')).toHaveLength(0);
  });
});
