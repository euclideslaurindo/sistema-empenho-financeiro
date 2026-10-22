// Linhas de "Discriminação dos Descontos" da via impressa da OP (T12).
// Lê o snapshot gravado na OP (T10) — nunca a config atual —, pra uma
// reimpressão mostrar exatamente as alíquotas usadas no dia do cálculo.
import { formatarBRL, toCents, totalItemCents } from "@/lib/money";

export interface LinhaDesconto {
  chave: string; // campo do verso (irrf, iss, ..., taxaBancaria, taxaPix)
  rotulo: string;
}

const CAMPOS: Array<{ campo: string; chave: string; rotuloPadrao: string; rotuloHistorico: string }> = [
  { campo: "irrf", chave: "irrf", rotuloPadrao: "IRRF", rotuloHistorico: "IRRF (1,5%)" },
  { campo: "iss", chave: "iss", rotuloPadrao: "ISS", rotuloHistorico: "ISS (5%)" },
  { campo: "inss", chave: "inss", rotuloPadrao: "INSS", rotuloHistorico: "INSS (11%)" },
  { campo: "patronal", chave: "patronal", rotuloPadrao: "PATRONAL", rotuloHistorico: "PATRONAL (20%)" },
  { campo: "sest_senat", chave: "sestSenat", rotuloPadrao: "SEST/SENAT", rotuloHistorico: "SEST/SENAT (2,5%)" },
  { campo: "outros", chave: "outrosDescontos", rotuloPadrao: "OUTROS / IBS-CBS", rotuloHistorico: "OUTROS / IBS-CBS" },
  { campo: "taxa_bancaria", chave: "taxaBancaria", rotuloPadrao: "Taxa bancária (expediente)", rotuloHistorico: "Taxa bancária (expediente)" },
  { campo: "taxa_pix", chave: "taxaPix", rotuloPadrao: "Taxa PIX", rotuloHistorico: "Taxa PIX" },
];

// Documento em branco (NE sem OP, preenchido à mão): sem cálculo, sem alíquota.
export const LINHAS_DOCUMENTO_EM_BRANCO: LinhaDesconto[] = CAMPOS.map((c) => ({ chave: c.chave, rotulo: c.rotuloPadrao }));

// OP gravada antes da T10 (sem snapshot): mesmos rótulos que a via sempre teve.
const LINHAS_OP_ANTIGA: LinhaDesconto[] = CAMPOS.map((c) => ({ chave: c.chave, rotulo: c.rotuloHistorico }));

function lerSnapshot(valor: unknown): { campos?: Record<string, any> } | null {
  if (!valor) return null;
  if (typeof valor === "string") {
    try {
      return JSON.parse(valor);
    } catch {
      return null;
    }
  }
  return typeof valor === "object" ? (valor as any) : null;
}

const TRIBUTARIOS = new Set(["irrf", "iss", "inss", "patronal", "sest_senat"]);
const isentoMei = (snapshot: Record<string, any> | null) => !!snapshot?.mei && !snapshot?.mei_sobrescrito;

/** Nota para a via quando não houve retenção por isenção (T26). */
export function notaDescontosDaOp(op: { retencoesSnapshot?: unknown }): string | null {
  return isentoMei(lerSnapshot(op.retencoesSnapshot)) ? "Isento de retenções (MEI)" : null;
}

export function linhasDescontoDaOp(op: { retencoesSnapshot?: unknown }): LinhaDesconto[] {
  const snapshot = lerSnapshot(op.retencoesSnapshot);
  if (!snapshot?.campos) return LINHAS_OP_ANTIGA;
  const mei = isentoMei(snapshot);

  const linhas: LinhaDesconto[] = [];
  for (const c of CAMPOS) {
    const s = snapshot.campos[c.campo];
    if (!s) continue;
    if (s.ativo === false || s.aplica === false) continue;
    if (mei && TRIBUTARIOS.has(c.campo)) continue; // a nota "Isento (MEI)" substitui as linhas de imposto
    const rotulo = s.rotulo || c.rotuloPadrao;
    const aliquota = !s.automatico || s.aliquota === null || s.aliquota === undefined ? null : Number(s.aliquota);
    // Informativa (patronal): aparece na via, mas não entra no total de descontos.
    const informativa = !!s.informativo && !/informativa/i.test(rotulo);
    const partes = [
      aliquota !== null && Number.isFinite(aliquota) ? `${aliquota.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%` : null,
      informativa ? "informativa" : null,
    ].filter(Boolean);
    linhas.push({ chave: c.chave, rotulo: partes.length > 0 ? `${rotulo} (${partes.join(", ")})` : rotulo });
  }
  return linhas;
}

export function formatarValorOp(valor: string | number | null | undefined): string {
  return formatarBRL(toCents(valor));
}

export interface ItensImpressao {
  especificacao: string;
  unidade: string;
  quantidade: string;
  valorUnitario: string;
  valorTotal: string;
}

/**
 * Itens da OP (itens_json) nas células da via, um por linha. O total de cada
 * item é a mesma conta da OP (lib/money.ts): centavos inteiros, 2 casas
 * (antes 1,5 × 10,33 saía "15,495"). O mysql2 já entrega o JSON como array;
 * texto só é lido se vier serializado de outro lugar.
 */
export function itensParaImpressao(itensJson: string | any[] | null | undefined): ItensImpressao {
  const vazio = { especificacao: "", unidade: "", quantidade: "", valorUnitario: "", valorTotal: "" };
  if (!itensJson) return vazio;
  let itens: any;
  try {
    itens = typeof itensJson === "string" ? JSON.parse(itensJson) : itensJson;
  } catch {
    return vazio;
  }
  if (!Array.isArray(itens) || itens.length === 0) return vazio;
  return {
    especificacao: itens.map((i: any) => i?.especificacao || "").join("\n"),
    unidade: itens.map((i: any) => i?.unidade || "").join("\n"),
    quantidade: itens.map((i: any) => String(i?.quantidade ?? "").replace(".", ",")).join("\n"),
    valorUnitario: itens.map((i: any) => formatarBRL(toCents(i?.valorUnitario))).join("\n"),
    valorTotal: itens.map((i: any) => formatarBRL(totalItemCents(i?.quantidade, i?.valorUnitario))).join("\n"),
  };
}

/** Data 'YYYY-MM-DD' como 'DD/MM/AAAA'; sem data, campo vazio (e não "-") na via. */
export function dataNaVia(data: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(data ?? "").trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/**
 * Datas da frente da via:
 * - "PROVISÃO CONCEDIDA — Data" é a Data de Provisão da NE (antes saía a
 *   data de emissão da OP);
 * - "DEDUZIDO / LIQUIDADO / PAGO — DATA" é a data do pagamento da OP (antes
 *   saía sempre vazia: o campo impresso nunca era preenchido).
 */
export function datasDaVia(
  op: { dataPagamento?: string | null },
  ne: { dataProvisaoConcedida?: string | null } | null | undefined
) {
  const pagamento = dataNaVia(op.dataPagamento);
  return {
    provisaoData: dataNaVia(ne?.dataProvisaoConcedida),
    pagoData: pagamento,
    deduzidoData: pagamento,
    liquidadoData: pagamento,
    pagamentoData: pagamento,
  };
}
