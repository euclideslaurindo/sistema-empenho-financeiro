// Linhas de "Discriminação dos Descontos" da via impressa da OP (T12).
// Lê o snapshot gravado na OP (T10) — nunca a config atual —, pra uma
// reimpressão mostrar exatamente as alíquotas usadas no dia do cálculo.
import { formatarBRL, toCents } from "@/lib/money";

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

export function linhasDescontoDaOp(op: { retencoesSnapshot?: unknown }): LinhaDesconto[] {
  const snapshot = lerSnapshot(op.retencoesSnapshot);
  if (!snapshot?.campos) return LINHAS_OP_ANTIGA;

  const linhas: LinhaDesconto[] = [];
  for (const c of CAMPOS) {
    const s = snapshot.campos[c.campo];
    if (!s) continue;
    if (s.ativo === false || s.aplica === false) continue;
    const rotulo = s.rotulo || c.rotuloPadrao;
    const aliquota = !s.automatico || s.aliquota === null || s.aliquota === undefined ? null : Number(s.aliquota);
    linhas.push({
      chave: c.chave,
      rotulo:
        aliquota !== null && Number.isFinite(aliquota)
          ? `${rotulo} (${aliquota.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%)`
          : rotulo,
    });
  }
  return linhas;
}

export function formatarValorOp(valor: string | number | null | undefined): string {
  return formatarBRL(toCents(valor));
}
