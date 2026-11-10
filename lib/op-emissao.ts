// Emissão de OPs em lote pela tela (T35-B): regras puras da lista de credores.
// A tela só monta, valida e mostra; quem decide o valor gravado é o servidor
// (POST /api/ordens-pagamento/lote, T34-C), com o mesmo motor de retenções.
import { toCents, formatarBRL, itensBatemComValor, totalItemCents as totalItemCentsDaMoeda } from "@/lib/money";
import { extrairCodigoElemento } from "@/lib/elementos";
import { ehTaxaExtra } from "@/lib/retencoes";
import {
  CAMPO_FORM,
  camposInformativos,
  ehCampoRetencao,
  estadoCampoOp,
  somarDescontosCents,
  type Perfil,
} from "@/lib/retencoes-form";
import { somenteDigitos } from "@/lib/ne-credores";
import type { ConfigRetencoes } from "@/hooks/use-retencoes-config";

export interface ItemOp {
  especificacao: string;
  quantidade: number | string;
  unidade: string;
  valorUnitario: number | string;
}

/** Uma linha da lista = uma OP. Nomes iguais aos da T35-A (basePath). */
export interface CredorLinha {
  chave: string;
  cpfCnpj: string;
  nomeCredor: string;
  credorMei: boolean;
  /** B9: optante pelo Simples Nacional (sem retenção de IR). Ausente = não. */
  credorSimples?: boolean;
  municipioExpediente: string;
  rg: string;
  endereco: string;
  banco: string;
  agencia: string;
  contaCorrente: string;
  pix: string;
  valorPagamento: string;
  numeroCheque: string;
  dataPagamento: string;
  itens: ItemOp[];
  irrf: string;
  iss: string;
  inss: string;
  sestSenat: string;
  patronal: string;
  outrosDescontos: string;
  taxaBancaria: string;
  taxaPix: string;
  /** B10: 2º ISS, valor livre. */
  issBs?: string;
  camposInformados: string[];
  sobrescreverMei: boolean;
  previaAvisos: string[];
}

export interface EmissaoValores {
  empenho?: string;
  neCarregada?: string;
  elemento?: string;
  dataEmissao?: string;
  credores?: CredorLinha[];
}

/** Credor como vem de GET /api/credores. */
export interface CredorApi {
  cpfCnpj?: string;
  cpf_cnpj?: string;
  nome?: string;
  isMei?: number | boolean | null;
  is_mei?: number | boolean | null;
  isSimples?: number | boolean | null;
  is_simples?: number | boolean | null;
  municipioExpediente?: string | null;
  rg?: string | null;
  endereco?: string | null;
  banco?: string | null;
  agencia?: string | null;
  contaCorrente?: string | null;
  pix?: string | null;
}

let contadorChave = 0;
const novaChave = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `linha-${Date.now()}-${++contadorChave}`;

/** Campos do topo da emissão que vêm da NE (mesmos do "Carregar dados da NE"). */
export function camposDaNe(ne: any): Record<string, string> {
  return {
    empenho: ne?.numero || "",
    neCarregada: ne?.numero || "",
    historicoNe: ne?.historico || "",
    unidadeOrcamentaria: ne?.unidadeOrcamentaria || "",
    gestao: ne?.gestao || "",
    elemento: ne?.elemento || "",
    subelemento: ne?.subelemento || "",
  };
}

/** "1100.5" | 1100.5 → "1.100,50" (formato dos campos de valor do formulário). */
const valorNoForm = (v: unknown) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? formatarBRL(toCents(n)) : "";
};

/**
 * B11: linha da emissão a partir de uma OP já emitida (modelo das "Ordens
 * Recentes"): credor do cadastro atual + valor e itens da OP. Cheque e data de
 * pagamento em branco; as retenções são recalculadas (nada é copiado).
 */
export function linhaDaOpModelo(op: { valorPagamento?: unknown; itensJson?: unknown }, credor: CredorApi): CredorLinha {
  const linha = linhaDoCredor(credor);
  let itens: any[] = [];
  try {
    itens = typeof op.itensJson === "string" ? JSON.parse(op.itensJson) : Array.isArray(op.itensJson) ? (op.itensJson as any[]) : [];
  } catch {
    itens = [];
  }
  const copiados: ItemOp[] = (Array.isArray(itens) ? itens : [])
    .filter((i) => i && typeof i === "object")
    .map((i) => ({
      especificacao: String(i.especificacao ?? ""),
      quantidade: Number(i.quantidade) > 0 ? Number(i.quantidade) : 1,
      unidade: String(i.unidade || "UN"),
      valorUnitario: valorNoForm(i.valorUnitario),
    }));
  return {
    ...linha,
    valorPagamento: valorNoForm(op.valorPagamento),
    itens: copiados.length > 0 ? copiados : linha.itens,
  };
}

/**
 * Linha nova a partir do cadastro, já com 1 item em branco: a especificação é
 * o usuário quem escreve (B11 — antes vinha a Observação da NE).
 */
export function linhaDoCredor(credor: CredorApi, _historicoNe?: string | null, _numeroNe?: string): CredorLinha {
  return {
    chave: novaChave(),
    cpfCnpj: credor.cpfCnpj || credor.cpf_cnpj || "",
    nomeCredor: credor.nome || "",
    credorMei: !!Number(credor.isMei ?? credor.is_mei ?? 0),
    credorSimples: !!Number(credor.isSimples ?? credor.is_simples ?? 0),
    municipioExpediente: credor.municipioExpediente || "",
    rg: credor.rg || "",
    endereco: credor.endereco || "",
    banco: credor.banco || "",
    agencia: credor.agencia || "",
    contaCorrente: credor.contaCorrente || "",
    pix: credor.pix || "",
    valorPagamento: "",
    numeroCheque: "",
    dataPagamento: "",
    itens: [{ especificacao: "", quantidade: 1, unidade: "UN", valorUnitario: "" }],
    irrf: "", iss: "", inss: "", sestSenat: "", patronal: "", outrosDescontos: "", taxaBancaria: "", taxaPix: "", issBs: "",
    camposInformados: [],
    sobrescreverMei: false,
    previaAvisos: [],
  };
}

/** Já está na lista? (compara só os dígitos) */
export function credorNaLista(credores: Array<Pick<CredorLinha, "cpfCnpj">>, cpfCnpj: unknown): boolean {
  const alvo = somenteDigitos(cpfCnpj);
  return !!alvo && credores.some((c) => somenteDigitos(c.cpfCnpj) === alvo);
}

/** Mesma conta da tela e do servidor (lib/money.ts). */
export const totalItemCents = (item: Partial<ItemOp>) => totalItemCentsDaMoeda(item?.quantidade, item?.valorUnitario);

/** Itens com valor (total > 0). Itens zerados não vão para a OP. */
export function itensValorizados(itens: ItemOp[] | undefined): ItemOp[] {
  return (itens || []).filter((i) => totalItemCents(i) > 0);
}

export function somaItensCents(itens: ItemOp[] | undefined): number {
  return itensValorizados(itens).reduce((t, i) => t + totalItemCents(i), 0);
}

/** Resumo do painel fechado: "2 itens · R$ 120,00". */
export function resumoItens(itens: ItemOp[] | undefined): string {
  const validos = itensValorizados(itens);
  if (validos.length === 0) return "Sem itens — usa as Observações da NE";
  return `${validos.length} ${validos.length === 1 ? "item" : "itens"} · R$ ${formatarBRL(somaItensCents(validos))}`;
}

export interface TotaisEmissao {
  somaCents: number;
  /** Restante da NE depois desta emissão (pode ser negativo). */
  restanteCents: number;
  /** Quanto a soma passa do saldo (0 se couber). */
  excedeCents: number;
}

/** `saldoRestanteCents` = restante da NE antes desta emissão. */
export function totaisEmissao(credores: Array<Pick<CredorLinha, "valorPagamento">> | undefined, saldoRestanteCents: number): TotaisEmissao {
  const somaCents = (credores || []).reduce((t, c) => t + toCents(c.valorPagamento), 0);
  const restanteCents = saldoRestanteCents - somaCents;
  return { somaCents, restanteCents, excedeCents: Math.max(0, -restanteCents) };
}

export const liquidoLinhaCents = (linha: Partial<CredorLinha>, elemento: string | null | undefined) =>
  toCents(linha.valorPagamento) -
  somarDescontosCents(linha as Record<string, unknown>, camposInformativos(extrairCodigoElemento(elemento)));

export type CampoLinha = "valorPagamento" | "numeroCheque" | "itens" | "retencoes" | "linha";

export interface ErrosEmissao {
  /** Erros da emissão (NE, data, lista vazia, saldo). */
  gerais: string[];
  /** Por índice da linha, por campo. */
  linhas: Record<number, Partial<Record<CampoLinha, string>>>;
}

export const temErros = (e: ErrosEmissao) => e.gerais.length > 0 || Object.keys(e.linhas).length > 0;

/**
 * Valida a emissão antes de enviar. Espelha as regras do servidor (T34-C) para
 * apontar a linha antes do POST; o servidor confere tudo de novo.
 */
export function validarEmissao(
  valores: EmissaoValores,
  ctx: { config?: ConfigRetencoes | null; perfil: Perfil; saldoRestanteCents?: number | null }
): ErrosEmissao {
  const erros: ErrosEmissao = { gerais: [], linhas: {} };
  const marcar = (i: number, campo: CampoLinha, msg: string) => {
    erros.linhas[i] = { ...erros.linhas[i], [campo]: erros.linhas[i]?.[campo] ?? msg };
  };
  const credores = valores.credores || [];

  if (!valores.neCarregada) erros.gerais.push("Carregue a Nota de Empenho.");
  if (!valores.dataEmissao) erros.gerais.push("Informe a data de emissão da OP.");
  if (credores.length === 0) erros.gerais.push("Adicione ao menos um credor.");

  const elementoCodigo = extrairCodigoElemento(valores.elemento);
  const informativos = camposInformativos(elementoCodigo);
  const cheques = new Map<string, number[]>();

  credores.forEach((c, i) => {
    const brutoCents = toCents(c.valorPagamento);
    if (brutoCents <= 0) marcar(i, "valorPagamento", "Informe o valor a pagar.");

    const cheque = String(c.numeroCheque ?? "").trim();
    if (cheque) cheques.set(cheque, [...(cheques.get(cheque) || []), i]);

    const somaItens = somaItensCents(c.itens);
    if (somaItens > 0 && !itensBatemComValor(somaItens, brutoCents)) {
      marcar(i, "itens", `A soma dos itens (R$ ${formatarBRL(somaItens)}) deve ser igual ao valor a pagar.`);
    }

    if (ctx.config) {
      const pendentes = ctx.config.campos.filter(
        (cfg) =>
          cfg.ativo &&
          ehCampoRetencao(cfg.campo) &&
          estadoCampoOp(cfg as any, elementoCodigo, ctx.config!.regras, ctx.perfil, {
            credorMei: !!c.credorMei,
            sobrescreverMei: !!c.sobrescreverMei,
            credorSimples: !!c.credorSimples,
          }).obrigatorio &&
          !(c.camposInformados || []).includes(cfg.campo)
      );
      if (pendentes.length > 0) marcar(i, "retencoes", `Informe o valor de: ${pendentes.map((p) => p.rotulo).join(", ")}.`);
    }

    if (somarDescontosCents(c as unknown as Record<string, unknown>, informativos) > brutoCents && brutoCents > 0) {
      marcar(i, "retencoes", "Total de descontos maior que o valor a pagar.");
    }
  });

  for (const [cheque, linhas] of cheques) {
    if (linhas.length > 1) linhas.forEach((i) => marcar(i, "numeroCheque", `O cheque nº "${cheque}" está repetido nesta emissão.`));
  }

  if (ctx.saldoRestanteCents !== null && ctx.saldoRestanteCents !== undefined) {
    const { excedeCents } = totaisEmissao(credores, ctx.saldoRestanteCents);
    if (excedeCents > 0) erros.gerais.push(`A soma passa do saldo da NE em R$ ${formatarBRL(excedeCents)}.`);
  }
  return erros;
}

/** Payload do POST /api/ordens-pagamento/lote, na ordem da lista. */
export function montarPayloadLote(valores: EmissaoValores) {
  return {
    numeroNe: valores.neCarregada || valores.empenho || "",
    dataEmissao: valores.dataEmissao || null,
    credores: (valores.credores || []).map((c) => {
      // Só o que o operador digitou vai como retenção: chave ausente = cálculo do servidor (T10).
      const informadas: Record<string, number> = {};
      const extras: Record<string, number> = {};
      for (const campo of c.camposInformados || []) {
        if (!ehCampoRetencao(campo)) continue;
        // B12: taxas "x_" vão em `extras`.
        if (ehTaxaExtra(campo)) extras[campo] = toCents((c as any)[campo]) / 100;
        else informadas[CAMPO_FORM[campo as keyof typeof CAMPO_FORM]] = toCents((c as any)[CAMPO_FORM[campo as keyof typeof CAMPO_FORM]]) / 100;
      }
      return {
        credorCpfCnpj: c.cpfCnpj,
        valorPagamento: toCents(c.valorPagamento) / 100,
        numeroCheque: String(c.numeroCheque ?? "").trim() || null,
        dataPagamento: c.dataPagamento || null,
        itens: itensValorizados(c.itens).map((i) => ({
          especificacao: String(i.especificacao ?? "").trim(),
          unidade: i.unidade || "UN",
          quantidade: Number(i.quantidade) || 0,
          valorUnitario: toCents(i.valorUnitario) / 100,
        })),
        ...informadas,
        ...(Object.keys(extras).length > 0 ? { extras } : {}),
        ...(c.credorMei && c.sobrescreverMei ? { sobrescreverMei: true } : {}),
      };
    }),
  };
}

/** "credores[3]: …" do servidor → linha 3. Outra mensagem → null. */
export function linhaDoErroServidor(mensagem: unknown): { indice: number; mensagem: string } | null {
  const m = /^credores\[(\d+)\]:\s*(.*)$/s.exec(String(mensagem ?? ""));
  return m ? { indice: Number(m[1]), mensagem: m[2] } : null;
}

export interface NumeroPrevisto {
  numeroOp: string;
  sub: string;
  rotulo: string;
}

/** O número vem da POSIÇÃO da linha (1ª linha = 1º número), nunca fica preso a ela. */
export function numeroPrevistoDaLinha(numeros: NumeroPrevisto[] | null | undefined, indice: number): NumeroPrevisto | null {
  return numeros?.[indice] ?? null;
}

/** Linhas cujo número gravado difere do previsto (outra OP foi salva antes). */
export function numerosQueMudaram(
  previstos: NumeroPrevisto[] | null | undefined,
  ops: Array<{ numeroOp: string; sub: string }>
): Array<{ indice: number; previsto: NumeroPrevisto; gravado: { numeroOp: string; sub: string } }> {
  if (!previstos) return [];
  return ops.flatMap((op, indice) => {
    const previsto = previstos[indice];
    return previsto && (previsto.numeroOp !== op.numeroOp || previsto.sub !== op.sub) ? [{ indice, previsto, gravado: op }] : [];
  });
}
