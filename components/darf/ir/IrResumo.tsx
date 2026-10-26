"use client";
import { formatarBRL, toCents } from "@/lib/money";
import type { TotaisIr } from "./tipos-ir";

const brl = (v: number) => `R$ ${formatarBRL(toCents(v))}`;

/** Cartões do ano inteiro (não mudam com a busca da tabela). */
export function IrResumo({ totais, ano }: { totais: TotaisIr | null; ano: number | null }) {
  const t = totais ?? { pessoas: 0, informadas: 0, pendentes: 0, qtdOps: 0, bruto: 0, irrf: 0, inss: 0, iss: 0, liquido: 0 };
  const percentual = t.pessoas > 0 ? Math.round((t.informadas / t.pessoas) * 100) : 0;
  const cartao = "rounded-2xl border border-slate-200 bg-white p-5";
  const titulo = "text-xs font-black uppercase tracking-widest text-slate-500";
  const valor = "mt-1 text-2xl font-black text-slate-800";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" aria-live="polite">
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5" data-testid="ir-resumo-pessoas">
        <p className="text-xs font-black uppercase tracking-widest text-blue-900">Pessoas{ano ? ` em ${ano}` : ""}</p>
        <p className="mt-1 text-2xl font-black text-blue-950">{t.pessoas}</p>
        <p className="text-sm font-semibold text-blue-900">
          {t.informadas} {t.informadas === 1 ? "informada" : "informadas"} · {t.pendentes}{" "}
          {t.pendentes === 1 ? "pendente" : "pendentes"}
        </p>
        <div
          className="mt-3 h-2 rounded-full bg-blue-100 overflow-hidden"
          role="progressbar"
          aria-label="Pessoas já informadas no IR"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentual}
        >
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percentual}%` }} />
        </div>
      </div>
      <div className={cartao} data-testid="ir-resumo-bruto">
        <p className={titulo}>Rendimento bruto</p>
        <p className={valor}>{brl(t.bruto)}</p>
        <p className="text-sm font-semibold text-slate-500">{t.qtdOps} OP(s)</p>
      </div>
      <div className={cartao} data-testid="ir-resumo-irrf">
        <p className={titulo}>IRRF retido</p>
        <p className={valor}>{brl(t.irrf)}</p>
      </div>
      <div className={cartao} data-testid="ir-resumo-inss">
        <p className={titulo}>INSS retido</p>
        <p className={valor}>{brl(t.inss)}</p>
      </div>
      <div className={cartao} data-testid="ir-resumo-iss">
        <p className={titulo}>ISS retido</p>
        <p className={valor}>{brl(t.iss)}</p>
      </div>
    </div>
  );
}
