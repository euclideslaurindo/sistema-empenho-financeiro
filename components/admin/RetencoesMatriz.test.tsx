import React from "react";
import { describe, test, expect } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { useForm, FormProvider } from "react-hook-form";
import RetencoesMatriz from "./RetencoesMatriz";

const defaultValues = {
  elementos: [
    {
      codigo: "3.3.90.14",
      descricao: "Diárias - Civil",
      legado: false,
      campos: { irrf: false, iss: false, inss: false, patronal: false, sest_senat: false },
    },
    {
      codigo: "3.3.90.36",
      descricao: "Outros Serviços de Terceiros - Pessoa Física",
      legado: false,
      campos: { irrf: true, iss: true, inss: true, patronal: true, sest_senat: true },
    },
    {
      codigo: "3.3.90.32",
      descricao: "Material de Distribuição Gratuita",
      legado: true,
      campos: { irrf: true, iss: true, inss: true, patronal: true, sest_senat: true },
    },
  ],
};

function renderWithForm() {
  function Wrapper() {
    const methods = useForm({ defaultValues });
    return (
      <FormProvider {...methods}>
        <RetencoesMatriz />
      </FormProvider>
    );
  }
  return render(<Wrapper />);
}

describe("RetencoesMatriz", () => {
  test("renderiza uma linha por elemento", () => {
    renderWithForm();
    expect(screen.getByText(/3\.3\.90\.14/)).toBeInTheDocument();
    expect(screen.getByText(/3\.3\.90\.36/)).toBeInTheDocument();
  });

  test("elemento .14 aparece sem nenhum checkbox marcado", () => {
    renderWithForm();
    expect(screen.getByLabelText("3.3.90.14 aplica IRRF")).not.toBeChecked();
    expect(screen.getByLabelText("3.3.90.14 aplica ISS")).not.toBeChecked();
  });

  test("elemento legado mostra o selo 'legado'", () => {
    renderWithForm();
    expect(screen.getByText("legado")).toBeInTheDocument();
  });

  test("checkbox tem aria-label no formato '<codigo> aplica <Imposto>'", () => {
    renderWithForm();
    expect(screen.getByLabelText("3.3.90.36 aplica IRRF")).toBeChecked();
  });

  test("botão 'Limpar' da linha desmarca todos os campos tributários daquela linha", () => {
    renderWithForm();
    const linha36 = screen.getByText(/3\.3\.90\.36/).closest("tr")!;
    const botaoLimpar = within(linha36).getByText("Limpar");
    fireEvent.click(botaoLimpar);
    expect(screen.getByLabelText("3.3.90.36 aplica IRRF")).not.toBeChecked();
    expect(screen.getByLabelText("3.3.90.36 aplica ISS")).not.toBeChecked();
  });

  test("atalho 'todos' da coluna IRRF marca IRRF em todos os elementos", () => {
    renderWithForm();
    const botaoTodosIrrf = screen.getByLabelText("Marcar IRRF em todos os elementos");
    fireEvent.click(botaoTodosIrrf);
    expect(screen.getByLabelText("3.3.90.14 aplica IRRF")).toBeChecked();
  });
});
