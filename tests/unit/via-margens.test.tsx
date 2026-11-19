// Margens da via impressa: frente e verso com a mesma margem (10 mm), e o
// quadro do verso ocupando a folha toda menos as margens (297 − 2×10 mm).
import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmpenhoVia } from '@/components/consulta-impressao/EmpenhoVia';
import { ReciboVia } from '@/components/consulta-impressao/ReciboVia';

vi.mock('next/image', () => ({ default: () => null }));

const margem = (el: HTMLElement) => el.className.match(/(?:^|\s)p-\[(\d+)mm\]/)?.[1];

describe('margens da via', () => {
  test('frente e verso com 10 mm', () => {
    render(
      <>
        <EmpenhoVia data={{}} isEditing={false} onChange={vi.fn()} />
        <ReciboVia data={{}} frente={{}} isEditing={false} onChange={vi.fn()} />
      </>
    );
    const frente = screen.getByTestId('via-frente');
    const verso = screen.getByTestId('via-verso');
    expect(margem(frente)).toBe('10');
    expect(margem(verso)).toBe(margem(frente));
    // a frente não soma outra margem por dentro
    expect((frente.firstElementChild as HTMLElement).className).not.toMatch(/(?:^|\s)p-\[/);
    // o quadro do verso cabe exatamente na folha: 297 − 2×10 = 277 mm
    expect((verso.firstElementChild as HTMLElement).className).toContain('h-[277mm]');
  });

  test('nenhum dado sai da via: os campos continuam lá', () => {
    render(
      <>
        <EmpenhoVia data={{ credorNome: 'ANA LIMA', especificacao: 'Rota rural' }} isEditing={false} onChange={vi.fn()} />
        <ReciboVia data={{ valorRecibo: '1.234,56' }} frente={{}} isEditing={false} onChange={vi.fn()} />
      </>
    );
    expect(screen.getByText(/ANA LIMA/)).toBeInTheDocument();
    expect(screen.getByText('Rota rural')).toBeInTheDocument();
    expect(screen.getAllByText(/1\.234,56/).length).toBeGreaterThan(0);
  });
});
