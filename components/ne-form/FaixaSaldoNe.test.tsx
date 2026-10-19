import React from "react";
import { describe, test, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { FaixaSaldoNe, percentualDaBarra } from "./FaixaSaldoNe";

describe("FaixaSaldoNe (T31)", () => {
  test("NE de R$ 100,00 com R$ 90,00 gastos: restante R$ 10,00 e barra em 90%", () => {
    render(<FaixaSaldoNe valorCents={10000} gastoCents={9000} />);
    const faixa = screen.getByTestId("faixa-saldo-ne");
    expect(within(faixa).getByText("R$ 100,00")).toBeInTheDocument();
    expect(within(faixa).getByText("R$ 90,00")).toBeInTheDocument();
    expect(within(faixa).getByText("R$ 10,00")).toBeInTheDocument();
    const barra = screen.getByRole("progressbar");
    expect(barra).toHaveAttribute("aria-valuenow", "90");
    expect(barra).toHaveAttribute("aria-valuemin", "0");
    expect(barra).toHaveAttribute("aria-valuemax", "100");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("NE nova: gasto zero e restante igual ao valor digitado", () => {
    render(<FaixaSaldoNe valorCents={50000} gastoCents={0} />);
    expect(screen.getAllByText("R$ 500,00")).toHaveLength(2); // valor e restante
    expect(screen.getByText("R$ 0,00")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  test("gasto acima do valor: restante negativo em vermelho e aviso", () => {
    render(<FaixaSaldoNe valorCents={10000} gastoCents={12050} />);
    expect(screen.getByText("R$ -20,50")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("NE com gasto acima do valor");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
  });

  test("percentualDaBarra limita entre 0 e 100", () => {
    expect(percentualDaBarra(0, 100)).toBe(0);
    expect(percentualDaBarra(10000, 2500)).toBe(25);
    expect(percentualDaBarra(10000, 99999)).toBe(100);
  });
});
