export type StatusDarf = "PENDENTE" | "PAGA";
export type Agrupamento = "op" | "credor";

export interface DarfItemOp {
  id: string;
  ordemPagamentoId: string;
  numeroNe: string;
  numeroOp: string | null;
  sub: string | null;
  credorCpfCnpj: string;
  credorNome: string | null;
  municipio: string;
  competencia: string;
  valorDarf: number;
  detalhe: Record<string, number> | string | null;
  status: StatusDarf;
  dataPagamento: string | null;
  observacao: string | null;
}

export interface DarfItemCredor {
  credorCpfCnpj: string;
  credorNome: string | null;
  municipio: string;
  qtd: number;
  total: number;
  totalPendente: number;
}

export interface TotalStatus {
  qtd: number;
  valor: number;
  credores: number;
}

export interface DarfResposta {
  agrupar: Agrupamento;
  itens: Array<DarfItemOp | DarfItemCredor>;
  totais: { pendente: TotalStatus; paga: TotalStatus };
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface FiltrosTela {
  competencia: string;
  status: "" | StatusDarf;
  busca: string;
  agrupar: Agrupamento;
}

const isoLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const hojeIso = (agora: Date = new Date()) => isoLocal(agora);
export const mesAtual = (agora: Date = new Date()) => isoLocal(agora).slice(0, 7);

export function montarUrlDarf(f: FiltrosTela, page: number, limit: number): string {
  const p = new URLSearchParams();
  if (f.competencia) p.set("competencia", f.competencia);
  if (f.status) p.set("status", f.status);
  if (f.busca.trim()) p.set("busca", f.busca.trim());
  p.set("agrupar", f.agrupar);
  p.set("page", String(page));
  p.set("limit", String(limit));
  return `/api/darf?${p.toString()}`;
}

export function detalheDaDarf(detalhe: DarfItemOp["detalhe"]): Record<string, number> {
  if (!detalhe) return {};
  if (typeof detalhe === "string") {
    try {
      return JSON.parse(detalhe);
    } catch {
      return {};
    }
  }
  return detalhe;
}

export const dataBR = (iso: string | null | undefined) => {
  if (!iso) return "-";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

export const competenciaBR = (c: string) => (c ? `${c.slice(5, 7)}/${c.slice(0, 4)}` : "-");
