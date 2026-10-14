"use client";
import { formatarBRL } from "@/lib/money";

/** Percentual gasto (0–100, para a barra) a partir de centavos. */
export const percentualDaBarra = (valorCents: number, gastoCents: number) =>
  valorCents > 0 ? Math.min(100, Math.max(0, Math.round((gastoCents * 100) / valorCents))) : 0;

/**
 * Faixa "Valor da NE · Gasto · Restante" (T31). Em NE nova o gasto é 0 e o
 * restante acompanha o valor digitado; editando, mostra o efeito do valor novo.
 */
export function FaixaSaldoNe({ valorCents, gastoCents }: { valorCents: number; gastoCents: number }) {
  const restanteCents = valorCents - gastoCents;
  const negativo = restanteCents < 0;
  const pct = percentualDaBarra(valorCents, gastoCents);

  return (
    <div className="md:col-span-4 rounded-2xl border border-slate-200 bg-slate-50/60 px-5 py-4" data-testid="faixa-saldo-ne">
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Valor da NE</p>
          <p className="text-base font-black text-slate-800">R$ {formatarBRL(valorCents)}</p>
        </div>
        <div>
          <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Gasto</p>
          <p className="text-base font-black text-slate-700">R$ {formatarBRL(gastoCents)}</p>
        </div>
        <div>
          <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Restante</p>
          <p className={`text-base font-black ${negativo ? "text-red-600" : "text-emerald-700"}`}>R$ {formatarBRL(restanteCents)}</p>
        </div>
      </div>
      <div
        role="progressbar"
        aria-label="Quanto da NE já foi gasto"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${pct}% gasto`}
        className="mt-3 h-2 w-full rounded-full bg-slate-200 overflow-hidden"
      >
        <div className={`h-full ${negativo ? "bg-red-500" : "bg-blue-800"}`} style={{ width: `${pct}%` }} />
      </div>
      {negativo && (
        <p role="alert" className="mt-2 text-xs font-bold text-red-600">
          NE com gasto acima do valor.
        </p>
      )}
    </div>
  );
}
