"use client";
import { formatarBRL, toCents } from "@/lib/money";
import type { DarfResposta } from "./tipos";

const brl = (v: number) => `R$ ${formatarBRL(toCents(v))}`;
const credoresTxt = (n: number) => `${n} ${n === 1 ? "credor" : "credores"}`;

export function DarfResumo({ totais }: { totais: DarfResposta["totais"] | null }) {
  const pendente = totais?.pendente ?? { qtd: 0, valor: 0, credores: 0 };
  const paga = totais?.paga ?? { qtd: 0, valor: 0, credores: 0 };
  const totalCents = toCents(pendente.valor) + toCents(paga.valor);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4" aria-live="polite">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5" data-testid="resumo-pendentes">
        <p className="text-xs font-black uppercase tracking-widest text-amber-700">Pendentes</p>
        <p className="mt-1 text-2xl font-black text-amber-900">{brl(pendente.valor)}</p>
        <p className="text-sm font-semibold text-amber-800">
          {credoresTxt(pendente.credores)} · {pendente.qtd} OP(s)
        </p>
      </div>
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5" data-testid="resumo-pagas">
        <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Pagas</p>
        <p className="mt-1 text-2xl font-black text-emerald-900">{brl(paga.valor)}</p>
        <p className="text-sm font-semibold text-emerald-800">
          {credoresTxt(paga.credores)} · {paga.qtd} OP(s)
        </p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5" data-testid="resumo-total">
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">Total do mês</p>
        <p className="mt-1 text-2xl font-black text-slate-800">R$ {formatarBRL(totalCents)}</p>
        <p className="text-sm font-semibold text-slate-500">{pendente.qtd + paga.qtd} OP(s)</p>
      </div>
    </div>
  );
}
