// B8 — aba "Pessoa Física (3.3.90.36)": parâmetros por vigência e simulador
// com o mesmo motor da OP.
import React from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/api-client", () => ({ apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { apiClient } from "@/lib/api-client";
import PessoaFisicaConfig from "./PessoaFisicaConfig";
import PessoaFisicaSimulador from "./PessoaFisicaSimulador";
import type { ConfigRetencaoCampoMapeado } from "@/lib/services/config-retencoes.service";
import type { ListaIrrf, ListaParametros } from "./transporte-tipos";
import { FAIXAS_IRRF_2026, PARAMETROS_PF_2026 } from "../../tests/fixtures/pessoa-fisica-2026";

const LISTA_PF: ListaParametros = {
  hoje: "2026-10-09",
  atual: "2026-01-01",
  vigencias: [{ vigenteDe: "2026-01-01", parametros: { ...PARAMETROS_PF_2026 } as Record<string, string>, emUso: false, editavel: false }],
};
const LISTA_IRRF: ListaIrrf = {
  hoje: "2026-10-09",
  atual: "2026-01-01",
  vigencias: [{ vigenteDe: "2026-01-01", faixas: FAIXAS_IRRF_2026, emUso: true, editavel: false }],
};
const CONFIG: ConfigRetencaoCampoMapeado[] = [
  ["irrf", "IRRF", 1.5], ["iss", "ISS", 5], ["inss", "INSS", 11], ["patronal", "Patronal", 20], ["sest_senat", "SEST/SENAT", 2.5],
].map(([campo, rotulo, aliquota], i) => ({
  campo: campo as string, rotulo: rotulo as string, tipo: "PERCENTUAL", aliquota: aliquota as number, calculoAutomatico: true,
  editavelOperador: false, entraDarf: false, ativo: true, ordem: i,
}));
const REGRAS = { "3.3.90.36": ["irrf", "iss", "inss", "patronal", "sest_senat"] };

const valor = (rotulo: string) => document.querySelector(`[data-rotulo="${rotulo}"]`)?.textContent;

beforeEach(() => vi.clearAllMocks());

describe("PessoaFisicaSimulador — mesmo cálculo da OP", () => {
  test("R$ 5.200,00: INSS 572, dedução 607,20, IRRF 71,63", () => {
    render(<PessoaFisicaSimulador parametros={LISTA_PF} irrf={LISTA_IRRF} config={CONFIG} regras={REGRAS} />);
    fireEvent.change(screen.getByLabelText("Valor bruto"), { target: { value: "5.200,00" } });
    expect(valor("INSS")).toBe("572,00");
    expect(valor("Dedução do IR (maior entre INSS e desconto simplificado)")).toBe("607,20");
    expect(valor("Base de cálculo do IRRF")).toBe("4.592,80");
    expect(valor("IRRF pela tabela")).toBe("357,89");
    expect(valor("Redutor")).toBe("286,26");
    expect(valor("IRRF")).toBe("71,63");
    expect(screen.getByTestId("simpf-liquido").textContent).toBe("4.166,37");
  });

  test("R$ 4.000,00: IRRF isento", () => {
    render(<PessoaFisicaSimulador parametros={LISTA_PF} irrf={LISTA_IRRF} config={CONFIG} regras={REGRAS} />);
    fireEvent.change(screen.getByLabelText("Valor bruto"), { target: { value: "4.000,00" } });
    expect(valor("IRRF (isento)")).toBe("0,00");
    expect(valor("INSS")).toBe("440,00");
  });

  test("data sem vigência: avisa", () => {
    render(<PessoaFisicaSimulador parametros={LISTA_PF} irrf={LISTA_IRRF} config={CONFIG} regras={REGRAS} />);
    fireEvent.change(screen.getByLabelText("Valor bruto"), { target: { value: "5.200,00" } });
    fireEvent.change(screen.getByLabelText("Data do pagamento"), { target: { value: "2025-06-01" } });
    expect(screen.getByRole("alert").textContent).toContain("Não há parâmetros ou tabela do IRRF vigentes em 01/06/2025");
  });
});

describe("PessoaFisicaConfig", () => {
  test("carrega da rota da pessoa física e mostra os rótulos dela", async () => {
    (apiClient.get as any).mockImplementation(async (url: string) =>
      url.includes("calculo-pessoa-fisica") ? LISTA_PF : LISTA_IRRF
    );
    render(<PessoaFisicaConfig config={CONFIG} regras={REGRAS} onDirtyChange={vi.fn()} />);
    expect(await screen.findByLabelText("Redutor — constante (R$)")).toHaveValue("978,61");
    expect(screen.getByLabelText("Isento de IRRF até o bruto de (R$)")).toHaveValue("5000");
    expect(screen.getByLabelText("Teto do INSS retido (R$)")).toHaveValue("932,31");
    expect(apiClient.get).toHaveBeenCalledWith("/api/configuracoes/calculo-pessoa-fisica");
    expect(screen.getByText(/A tabela do IRRF é a mesma do transporte/)).toBeInTheDocument();
  });

  test("nova vigência grava na rota da pessoa física", async () => {
    (apiClient.get as any).mockImplementation(async (url: string) =>
      url.includes("calculo-pessoa-fisica") ? LISTA_PF : LISTA_IRRF
    );
    (apiClient.put as any).mockResolvedValue({ success: true });
    render(<PessoaFisicaConfig config={CONFIG} regras={REGRAS} onDirtyChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Nova vigência/ }));
    fireEvent.change(screen.getByLabelText("Vale a partir de"), { target: { value: "2027-01-01" } });
    fireEvent.change(screen.getByLabelText("Isento de IRRF até o bruto de (R$)"), { target: { value: "5500" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar parâmetros/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Confirmar/ }));
    await waitFor(() => expect(apiClient.put).toHaveBeenCalled());
    const [url, corpo] = (apiClient.put as any).mock.calls[0];
    expect(url).toBe("/api/configuracoes/calculo-pessoa-fisica");
    expect(corpo).toEqual({
      vigenteDe: "2027-01-01",
      parametros: {
        inss_teto: 932.31, desconto_simplificado: 607.2, isencao_ate: 5500, redutor_ate: 7350, redutor_constante: 978.61,
        redutor_coeficiente: 0.133145,
      },
    });
  });

  test("sem parâmetros no banco: pede para rodar a migration_21", async () => {
    (apiClient.get as any).mockImplementation(async (url: string) =>
      url.includes("calculo-pessoa-fisica") ? { hoje: "2026-10-09", atual: null, vigencias: [] } : LISTA_IRRF
    );
    render(<PessoaFisicaConfig config={CONFIG} regras={REGRAS} onDirtyChange={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("rode a migration_21.sql");
  });
});
