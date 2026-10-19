import React from "react";
import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { SubelementoCampo, SUBELEMENTO_MAX } from "./SubelementoCampo";
import type { SubelementoOption } from "@/hooks/use-elementos";

const LISTA_14: SubelementoOption[] = [
  { codigo: "3.3.90.14.01", descricao: "Diárias no país", valor: "3.3.90.14.01 - Diárias no país" },
  { codigo: "3.3.90.14.03", descricao: "Ajuda de custo", valor: "3.3.90.14.03 - Ajuda de custo" },
];

function montar(subelementos: SubelementoOption[], subelemento = "") {
  function Wrapper() {
    const methods = useForm({ defaultValues: { subelemento } });
    return (
      <FormProvider {...methods}>
        <SubelementoCampo subelementos={subelementos} />
      </FormProvider>
    );
  }
  return render(<Wrapper />);
}

describe("SubelementoCampo (T29)", () => {
  test("elemento com subelementos cadastrados: lista com as opções", () => {
    montar(LISTA_14);
    const campo = screen.getByLabelText("Subelemento");
    expect(campo.tagName).toBe("SELECT");
    expect(screen.getByRole("option", { name: "3.3.90.14.01 - Diárias no país" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "3.3.90.14.03 - Ajuda de custo" })).toBeInTheDocument();
  });

  test("valor antigo fora da lista aparece como (legado) e continua selecionado", () => {
    montar(LISTA_14, "3.3.90.14.99 - Antigo");
    expect(screen.getByRole("option", { name: "(legado) 3.3.90.14.99 - Antigo" })).toBeInTheDocument();
    expect((screen.getByLabelText("Subelemento") as HTMLSelectElement).value).toBe("3.3.90.14.99 - Antigo");
  });

  test("elemento sem lista (ou nenhum elemento): texto livre, opcional, até 250 caracteres", () => {
    montar([]);
    const campo = screen.getByLabelText("Subelemento") as HTMLInputElement;
    expect(campo.tagName).toBe("INPUT");
    expect(campo.type).toBe("text");
    expect(campo.maxLength).toBe(SUBELEMENTO_MAX);
    expect(campo).not.toBeRequired();
    expect(campo).toHaveAttribute("placeholder", "Subelemento (opcional)");
  });

  test("texto livre mostra o valor já gravado", () => {
    montar([], "Locação de veículo");
    expect((screen.getByLabelText("Subelemento") as HTMLInputElement).value).toBe("Locação de veículo");
  });
});
