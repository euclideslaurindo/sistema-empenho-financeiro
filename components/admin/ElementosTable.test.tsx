import React from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ElementosTable from "./ElementosTable";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock("@/hooks/use-elementos", () => ({
  invalidateElementosCache: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { apiClient } from "@/lib/api-client";

const elementosMock = [
  { codigo: "3.3.90.14", descricao: "Diárias - Civil", legado: false, ativo: true, ordem: 10, retencoes: [] },
  { codigo: "3.3.90.36", descricao: "Outros Serviços de Terceiros - Pessoa Física", legado: false, ativo: true, ordem: 40, retencoes: ["irrf"] },
];
const subelementosMock = [
  { codigo: "3.3.90.14.01", elementoCodigo: "3.3.90.14", descricao: "Diárias Pessoal Civil", ativo: true, ordem: 1 },
];

describe("ElementosTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiClient.get as any).mockImplementation((url: string) => {
      if (url.includes("/api/elementos")) return Promise.resolve({ elementos: elementosMock });
      if (url.includes("/api/subelementos")) return Promise.resolve({ subelementos: subelementosMock });
      return Promise.resolve({});
    });
  });

  test("carrega e lista os elementos", async () => {
    render(<ElementosTable />);
    expect(await screen.findByText("3.3.90.14")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Outros Serviços de Terceiros - Pessoa Física")).toBeInTheDocument();
  });

  test("busca filtra a lista por código ou descrição", async () => {
    render(<ElementosTable />);
    await screen.findByText("3.3.90.14");

    fireEvent.change(screen.getByPlaceholderText("Buscar..."), { target: { value: "civil" } });

    expect(screen.getByDisplayValue("Diárias - Civil")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Outros Serviços de Terceiros - Pessoa Física")).not.toBeInTheDocument();
  });

  test("expandir elemento mostra seus subelementos", async () => {
    render(<ElementosTable />);
    await screen.findByText("3.3.90.14");

    fireEvent.click(screen.getByText("3.3.90.14"));

    expect(await screen.findByText("3.3.90.14.01")).toBeInTheDocument();
  });

  test("desativar elemento chama PUT com ativo=false", async () => {
    (apiClient.put as any).mockResolvedValue({ success: true });
    render(<ElementosTable />);
    await screen.findByText("3.3.90.14");

    fireEvent.click(screen.getByLabelText("3.3.90.14 ativo"));

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith("/api/elementos/3.3.90.14", { ativo: false });
    });
  });

  test("criar elemento com código duplicado mostra erro amigável", async () => {
    (apiClient.post as any).mockRejectedValue(Object.assign(new Error("Código já cadastrado."), { status: 409 }));
    const { toast } = await import("sonner");

    render(<ElementosTable />);
    await screen.findByText("3.3.90.14");

    fireEvent.click(screen.getByText("Novo Elemento"));
    fireEvent.change(screen.getByLabelText("Código"), { target: { value: "3.3.90.14" } });
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Repetido" } });
    fireEvent.click(screen.getByText("Criar elemento"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Código já cadastrado.");
    });
  });
});
