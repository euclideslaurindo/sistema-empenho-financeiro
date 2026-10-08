import React from "react";
import { describe, test, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useForm, FormProvider } from "react-hook-form";
import RetencoesCamposTable from "./RetencoesCamposTable";

const defaultValues = {
  campos: [
    {
      campo: "irrf",
      rotulo: "IRRF",
      tipo: "PERCENTUAL",
      aliquota: "1,5",
      calculoAutomatico: true,
      editavelOperador: false,
      entraDarf: false,
      ativo: true,
      ordem: 10,
    },
    {
      campo: "outros",
      rotulo: "Outros",
      tipo: "VALOR_DIGITADO",
      aliquota: "",
      calculoAutomatico: false,
      editavelOperador: false,
      entraDarf: false,
      ativo: true,
      ordem: 60,
    },
  ],
};

function renderWithForm(options?: { aliquotaErro?: string }) {
  function Wrapper() {
    const methods = useForm({ defaultValues });
    React.useEffect(() => {
      if (options?.aliquotaErro) {
        methods.setError("campos.0.aliquota" as any, { message: options.aliquotaErro });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
      <FormProvider {...methods}>
        <RetencoesCamposTable />
      </FormProvider>
    );
  }
  return render(<Wrapper />);
}

describe("RetencoesCamposTable", () => {
  test("renderiza uma linha por campo com o rótulo", () => {
    renderWithForm();
    expect(screen.getByDisplayValue("IRRF")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Outros")).toBeInTheDocument();
  });

  test("alíquota do campo PERCENTUAL com cálculo automático fica habilitada", () => {
    renderWithForm();
    expect(screen.getByLabelText("Alíquota de IRRF")).not.toBeDisabled();
  });

  test("alíquota do campo VALOR_DIGITADO fica desabilitada", () => {
    renderWithForm();
    expect(screen.getByLabelText("Alíquota de Outros")).toBeDisabled();
  });

  test("'Entra na DARF' fica desabilitado para campo não-tributário (outros)", () => {
    renderWithForm();
    expect(screen.getByLabelText("Outros — Entra na DARF")).toBeDisabled();
  });

  test("'Entra na DARF' fica habilitado para campo tributário (irrf)", () => {
    renderWithForm();
    expect(screen.getByLabelText("IRRF — Entra na DARF")).not.toBeDisabled();
  });

  test("digitar na alíquota remove caracteres inválidos (só dígitos e vírgula)", () => {
    renderWithForm();
    const aliquotaIrrf = screen.getByLabelText("Alíquota de IRRF") as HTMLInputElement;
    fireEvent.change(aliquotaIrrf, { target: { value: "2abc,5" } });
    expect(aliquotaIrrf.value).toBe("2,5");
  });

  test("exibe erro de validação inline junto ao campo de alíquota", async () => {
    renderWithForm({ aliquotaErro: "Alíquota não pode passar de 100." });
    expect(await screen.findByText("Alíquota não pode passar de 100.")).toBeInTheDocument();
  });
});
