"use client";
import { Hash } from "lucide-react";
import type { NumeroPrevisto } from "@/lib/op-emissao";

// Previsão, não reserva: o número definitivo só existe depois de emitir
// (outra OP salva antes pode "pegar" este número).
export function NumeroPrevistoSelo({ numero }: { numero: NumeroPrevisto | null }) {
  if (!numero) {
    return <span className="text-xs font-semibold text-slate-400">Nº da OP: gerado ao emitir</span>;
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-900"
      title="Número previsto: o definitivo sai ao emitir"
    >
      <Hash className="w-3 h-3" aria-hidden="true" />
      {numero.rotulo} · {numero.numeroOp}
      <span className="font-semibold text-blue-700">(previsto)</span>
    </span>
  );
}
