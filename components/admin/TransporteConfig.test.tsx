import React from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

vi.mock("@/lib/api-client", () => ({ apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { apiClient } from "@/lib/api-client";
import TransporteSimulador from "./TransporteSimulador";
import TransporteParametros from "./TransporteParametros";
import IrrfFaixasEditor from "./IrrfFaixasEditor";
import IssMunicipiosTable from "./IssMunicipiosTable";
import type { ConfigRetencaoCampoMapeado } from "@/lib/services/config-retencoes.service";
import type { IssMunicipioAdmin, ListaIrrf, ListaParametros } from "./transporte-tipos";

// Seed da T24, como as APIs devolvem (DECIMAL em texto).
const PARAMETROS: Record<string, string> = {
  base_percentual: "20.000000",
  inss_percentual: "11.000000",
  patronal_percentual: "20.000000",
  sest_percentual: "1.500000",
  senat_percentual: "1.000000",
  irrf_tributavel_percentual: "60.000000",
  desconto_simplificado: "607.200000",
  redutor_constante: "978.620000",
  redutor_coeficiente: "0.133145",
};
const FAIXAS = [
  { ordem: 1, limiteAte: "2428.80", aliquota: "0.0000", parcelaDeduzir: "0.00" },
  { ordem: 2, limiteAte: "2826.65", aliquota: "7.5000", parcelaDeduzir: "182.16" },
  { ordem: 3, limiteAte: "3751.05", aliquota: "15.0000", parcelaDeduzir: "394.16" },
  { ordem: 4, limiteAte: "4664.68", aliquota: "22.5000", parcelaDeduzir: "675.49" },
  { ordem: 5, limiteAte: null, aliquota: "27.5000", parcelaDeduzir: "908.73" },
];
const LISTA_PARAMETROS: ListaParametros = {
  hoje: "2026-10-09",
  atual: "2026-01-01",
  vigencias: [{ vigenteDe: "2026-01-01", parametros: PARAMETROS, emUso: true, editavel: false }],
};
const LISTA_IRRF: ListaIrrf = {
  hoje: "2026-10-09",
  atual: "2026-01-01",
  vigencias: [{ vigenteDe: "2026-01-01", faixas: FAIXAS, emUso: true, editavel: false }],
};
const mun = (chave: string, nome: string, taxa: string): IssMunicipioAdmin => ({
  chave,
  nome,
  uf: "PE",
  aliquota: "5.0000",
  taxaExpediente: taxa,
  apelidos: null,
  ativo: true,
});
const MUNICIPIOS = [mun("aguas belas", "Águas Belas", "0.00"), mun("bom conselho", "Bom Conselho", "0.00"), mun("canhotinho", "Canhotinho", "15.20")];
const CONFIG: ConfigRetencaoCampoMapeado[] = ["irrf", "iss", "inss", "patronal", "sest_senat", "outros", "taxa_bancaria", "taxa_pix"].map(
  (campo, i) => ({
    campo,
    rotulo: campo,
    tipo: i < 5 ? "PERCENTUAL" : "VALOR_DIGITADO",
    aliquota: null,
    calculoAutomatico: i < 5,
    editavelOperador: false,
    entraDarf: false,
    ativo: true,
    ordem: i,
  })
);

beforeEach(() => vi.clearAllMocks());

describe("TransporteSimulador — mesmo cálculo da OP", () => {
  function simular(municipio: string, bruto: string) {
    const { container } = render(
      <TransporteSimulador parametros={LISTA_PARAMETROS} irrf={LISTA_IRRF} municipios={MUNICIPIOS} config={CONFIG} />
    );
    fireEvent.change(screen.getByLabelText("Município do credor"), { target: { value: municipio } });
    fireEvent.change(screen.getByLabelText("Valor bruto"), { target: { value: bruto } });
    // Rótulo exato; o do ISS traz a alíquota no texto, então cai no prefixo.
    const linha = (rotulo: string) =>
      (container.querySelector(`[data-rotulo="${rotulo}"]`) ?? container.querySelector(`[data-rotulo^="${rotulo} "]`))?.textContent;
    return { linha, liquido: () => screen.getByTestId("simt-liquido").textContent };
  }

  test("Caso G: 11.970,00 em Águas Belas", () => {
    const { linha, liquido } = simular("aguas belas", "11.970,00");
    expect(linha("IRRF")).toBe("899,34");
    expect(linha("ISS")).toBe("598,50");
    expect(linha("INSS")).toBe("263,34");
    expect(linha("SEST")).toBe("35,91");
    expect(linha("SENAT")).toBe("23,94");
    expect(linha("Patronal (informativa, fora do total)")).toBe("478,80");
    expect(liquido()).toBe("10.148,97");
  });

  test("Caso H: 6.317,50 em Canhotinho (expediente 15,20)", () => {
    const { linha, liquido } = simular("canhotinho", "6.317,50");
    expect(linha("IRRF")).toBe("0,00");
    expect(linha("ISS")).toBe("331,08");
    expect(liquido()).toBe("5.815,84");
  });

  test("Bartolomeu: 6.288,30 em Bom Conselho — redutor zera o IRRF", () => {
    const { linha } = simular("bom conselho", "6.288,30");
    expect(linha("IRRF pela tabela")).toBe("80,71");
    expect(linha("Desconto adicional (redutor)")).toBe("141,36");
    expect(linha("IRRF")).toBe("0,00");
  });

  test("data sem vigência cadastrada avisa em vez de calcular", () => {
    simular("aguas belas", "1000");
    fireEvent.change(screen.getByLabelText("Data do pagamento"), { target: { value: "2025-06-01" } });
    expect(screen.getByRole("alert").textContent).toMatch(/Não há parâmetros/);
  });
});

describe("TransporteParametros", () => {
  const FUTURA: ListaParametros = {
    ...LISTA_PARAMETROS,
    vigencias: [...LISTA_PARAMETROS.vigencias, { vigenteDe: "2027-01-01", parametros: PARAMETROS, emUso: false, editavel: true }],
  };

  test("vigência em uso fica só leitura", () => {
    render(<TransporteParametros dados={LISTA_PARAMETROS} onSalvo={vi.fn()} onDirtyChange={vi.fn()} />);
    expect(screen.getByText(/Já usada por OP/)).toBeTruthy();
    expect((screen.getByLabelText("INSS (% da base)") as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByText("Salvar parâmetros")).toBeNull();
  });

  test("mostra o diff antes do PUT e só grava ao confirmar", async () => {
    (apiClient.put as any).mockResolvedValue({ success: true });
    const onSalvo = vi.fn();
    const onDirty = vi.fn();
    render(<TransporteParametros dados={FUTURA} onSalvo={onSalvo} onDirtyChange={onDirty} />);
    fireEvent.change(screen.getByLabelText("Vigência"), { target: { value: "2027-01-01" } });
    fireEvent.change(screen.getByLabelText("INSS (% da base)"), { target: { value: "12" } });
    expect(onDirty).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByText("Salvar parâmetros"));
    const dialogo = await screen.findByRole("alertdialog");
    expect(within(dialogo).getByText("INSS (% da base): 11 → 12")).toBeTruthy();
    expect(apiClient.put).not.toHaveBeenCalled();

    fireEvent.click(within(dialogo).getByText("Confirmar e salvar"));
    await waitFor(() => expect(onSalvo).toHaveBeenCalled());
    expect(apiClient.put).toHaveBeenCalledWith("/api/configuracoes/calculo-transporte", {
      vigenteDe: "2027-01-01",
      parametros: expect.objectContaining({ inss_percentual: 12, redutor_coeficiente: 0.133145 }),
    });
  });

  test("nova vigência copia a atual e começa hoje", async () => {
    render(<TransporteParametros dados={LISTA_PARAMETROS} onSalvo={vi.fn()} onDirtyChange={vi.fn()} />);
    fireEvent.click(screen.getByText("Nova vigência"));
    expect((screen.getByLabelText("Vale a partir de") as HTMLInputElement).value).toBe("2026-10-09");
    expect((screen.getByLabelText("Desconto simplificado (R$)") as HTMLInputElement).value).toBe("607,2");
    fireEvent.click(screen.getByText("Salvar parâmetros"));
    expect(await screen.findByText("Nova vigência a partir de 09/10/2026")).toBeTruthy();
  });
});

describe("IrrfFaixasEditor", () => {
  const EDITAVEL: ListaIrrf = { ...LISTA_IRRF, vigencias: [{ ...LISTA_IRRF.vigencias[0], vigenteDe: "2027-01-01", emUso: false, editavel: true }], atual: null };

  test("faixa inválida mostra o erro e bloqueia salvar", () => {
    render(<IrrfFaixasEditor dados={EDITAVEL} onSalvo={vi.fn()} onDirtyChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Limite da faixa 3"), { target: { value: "2000" } });
    expect(screen.getByRole("alert").textContent).toContain("Faixa 3: o limite deve ser maior que o da faixa 2.");
    expect((screen.getByText("Salvar tabela").closest("button") as HTMLButtonElement).disabled).toBe(true);
  });

  test("diff da alíquota e PUT com a última faixa sem limite", async () => {
    (apiClient.put as any).mockResolvedValue({ success: true });
    const onSalvo = vi.fn();
    render(<IrrfFaixasEditor dados={EDITAVEL} onSalvo={onSalvo} onDirtyChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Alíquota da faixa 3"), { target: { value: "16" } });
    fireEvent.click(screen.getByText("Salvar tabela"));
    const dialogo = await screen.findByRole("alertdialog");
    expect(within(dialogo).getByText("Faixa 3: 15% → 16%")).toBeTruthy();
    fireEvent.click(within(dialogo).getByText("Confirmar e salvar"));
    await waitFor(() => expect(onSalvo).toHaveBeenCalled());
    const corpo = (apiClient.put as any).mock.calls[0][1];
    expect(corpo.faixas[2]).toEqual({ limiteAte: 3751.05, aliquota: 16, parcelaDeduzir: 394.16 });
    expect(corpo.faixas[4].limiteAte).toBeNull();
  });

  test("incluir faixa entra antes da última (acima de)", () => {
    render(<IrrfFaixasEditor dados={EDITAVEL} onSalvo={vi.fn()} onDirtyChange={vi.fn()} />);
    fireEvent.click(screen.getByText("Incluir faixa"));
    expect((screen.getByLabelText("Limite da faixa 5") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Alíquota da faixa 6") as HTMLInputElement).value).toBe("27,5");
    expect(screen.queryByLabelText("Limite da faixa 6")).toBeNull();
  });

  test("tabela em uso: só leitura", () => {
    render(<IrrfFaixasEditor dados={LISTA_IRRF} onSalvo={vi.fn()} onDirtyChange={vi.fn()} />);
    expect((screen.getByLabelText("Alíquota da faixa 1") as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByText("Salvar tabela")).toBeNull();
  });
});

describe("IssMunicipiosTable", () => {
  test("Canhotinho 15,20 → 16,00: diff e PUT", async () => {
    (apiClient.put as any).mockResolvedValue({ success: true });
    const onSalvo = vi.fn();
    render(<IssMunicipiosTable municipios={MUNICIPIOS} onSalvo={onSalvo} onDirtyChange={vi.fn()} />);
    const salvar = screen.getByLabelText("Salvar Canhotinho") as HTMLButtonElement;
    expect(salvar.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Expediente de Canhotinho"), { target: { value: "16,00" } });
    expect(salvar.disabled).toBe(false);
    fireEvent.click(salvar);
    const dialogo = await screen.findByRole("alertdialog");
    expect(within(dialogo).getByText("Canhotinho: taxa de expediente 15,2 → 16")).toBeTruthy();
    fireEvent.click(within(dialogo).getByText("Confirmar e salvar"));
    await waitFor(() => expect(onSalvo).toHaveBeenCalled());
    expect(apiClient.put).toHaveBeenCalledWith(
      "/api/configuracoes/iss-municipios",
      expect.objectContaining({ chave: "canhotinho", taxaExpediente: 16, aliquota: 5 })
    );
  });

  test("incluir município faz POST", async () => {
    (apiClient.post as any).mockResolvedValue({ success: true, chave: "jupi" });
    render(<IssMunicipiosTable municipios={MUNICIPIOS} onSalvo={vi.fn()} onDirtyChange={vi.fn()} />);
    fireEvent.click(screen.getByText("Incluir município"));
    fireEvent.change(screen.getByLabelText("Nome do novo município"), { target: { value: "Jupi" } });
    fireEvent.change(screen.getByLabelText("Expediente do novo município"), { target: { value: "6,76" } });
    fireEvent.click(screen.getByText("Incluir"));
    const dialogo = await screen.findByRole("alertdialog");
    expect(within(dialogo).getByText("Novo município: Jupi/PE · ISS 5% · expediente 6,76")).toBeTruthy();
    fireEvent.click(within(dialogo).getByText("Confirmar e salvar"));
    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/configuracoes/iss-municipios",
        expect.objectContaining({ nome: "Jupi", uf: "PE", aliquota: 5, taxaExpediente: 6.76 })
      )
    );
  });
});
