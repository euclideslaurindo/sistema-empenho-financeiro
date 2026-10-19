"use client";
import { useFormContext, useWatch } from "react-hook-form";
import { Wallet } from "lucide-react";
import { formatarBRL, toCents } from "@/lib/money";
import { totaisEmissao, type CredorLinha } from "@/lib/op-emissao";
import { percentualDaBarra } from "@/components/ne-form/FaixaSaldoNe";
import type { SaldoNe } from "@/hooks/use-saldo-ne";

function Item({ rotulo, cents, cor = "text-slate-800" }: { rotulo: string; cents: number; cor?: string }) {
  return (
    <div>
      <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{rotulo}</p>
      <p className={`text-lg font-black ${cor}`}>R$ {formatarBRL(cents)}</p>
    </div>
  );
}

/**
 * "Valor da NE · Já gasto · Nesta emissão · Restante" (T35-B). O restante
 * já desconta o que está sendo emitido agora; abaixo de zero fica vermelho.
 */
export function FaixaSaldoEmissao({ saldo, erro }: { saldo: SaldoNe | null; erro?: string | null }) {
  const { control } = useFormContext<any>();
  const credores: CredorLinha[] = useWatch({ control, name: "credores" }) || [];

  if (erro) {
    return (
      <p role="alert" className="col-span-12 text-sm font-semibold text-red-600">
        {erro}
      </p>
    );
  }
  if (!saldo) return null;

  const valorCents = toCents(saldo.valor);
  const gastoCents = toCents(saldo.gasto);
  const { somaCents, restanteCents } = totaisEmissao(credores, toCents(saldo.restante));
  const negativo = restanteCents < 0;
  const pctGasto = percentualDaBarra(valorCents, gastoCents);
  const pctEmissao = Math.max(0, Math.min(100 - pctGasto, percentualDaBarra(valorCents, gastoCents + somaCents) - pctGasto));

  return (
    <div className="col-span-12 rounded-2xl border border-slate-200 bg-slate-50/60 px-5 py-4" data-testid="faixa-saldo-emissao">
      <div className="flex items-center gap-2 mb-3 text-sm font-bold text-slate-600">
        <Wallet className="w-4 h-4" /> Saldo da NE
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Item rotulo="Valor da NE" cents={valorCents} />
        <Item rotulo="Já gasto" cents={gastoCents} cor="text-slate-700" />
        <Item rotulo="Nesta emissão" cents={somaCents} cor="text-blue-900" />
        <Item rotulo="Restante" cents={restanteCents} cor={negativo ? "text-red-600" : "text-emerald-700"} />
      </div>
      <div
        role="progressbar"
        aria-label="Quanto da NE fica comprometido com esta emissão"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, pctGasto + pctEmissao)}
        className="mt-3 h-2 w-full rounded-full bg-slate-200 overflow-hidden flex"
      >
        <div className="h-full bg-slate-500" style={{ width: `${pctGasto}%` }} />
        <div className={`h-full ${negativo ? "bg-red-500" : "bg-blue-800"}`} style={{ width: `${negativo ? 100 - pctGasto : pctEmissao}%` }} />
      </div>
    </div>
  );
}
