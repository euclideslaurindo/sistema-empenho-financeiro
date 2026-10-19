"use client";
import { useFormContext, useWatch } from "react-hook-form";
import { Send, Eraser } from "lucide-react";
import { formatarBRL } from "@/lib/money";
import { totaisEmissao, type CredorLinha } from "@/lib/op-emissao";

/**
 * Barra fixa do rodapé da emissão: soma, restante da NE e o botão Emitir.
 * Soma acima do saldo deixa a barra em alerta e o Emitir desabilitado.
 */
export function BarraTotaisEmissao({
  saldoRestanteCents,
  emitindo,
  podeEmitir,
  onEmitir,
  onLimpar,
}: {
  saldoRestanteCents: number | null;
  emitindo: boolean;
  podeEmitir: boolean;
  onEmitir: () => void;
  onLimpar: () => void;
}) {
  const { control } = useFormContext<any>();
  const credores: CredorLinha[] = useWatch({ control, name: "credores" }) || [];
  const quantidade = credores.length;
  const conhecido = saldoRestanteCents !== null;
  const { somaCents, restanteCents, excedeCents } = totaisEmissao(credores, saldoRestanteCents ?? 0);
  const excedeu = conhecido && excedeCents > 0;
  const desabilitado = !podeEmitir || emitindo || quantidade === 0 || excedeu;
  const rotulo = emitindo
    ? "Emitindo..."
    : `Emitir ${quantidade || ""} ${quantidade === 1 ? "ordem de pagamento" : "ordens de pagamento"}`.replace("  ", " ");

  return (
    <div className="sticky bottom-4 z-40">
      <div
        className={`backdrop-blur-md rounded-2xl shadow-2xl border px-4 md:px-6 py-4 flex flex-wrap items-center justify-between gap-4 ${
          excedeu ? "bg-red-900/95 border-red-300/30" : "bg-slate-900/95 border-white/10"
        }`}
        data-testid="barra-totais-emissao"
      >
        <div className="text-white">
          <p className="text-sm font-bold">
            Soma desta emissão <span className="font-black">R$ {formatarBRL(somaCents)}</span>
            {conhecido && (
              <>
                {" "}
                · Restante da NE <span className="font-black">R$ {formatarBRL(restanteCents)}</span>
              </>
            )}
          </p>
          {excedeu && (
            <p role="alert" className="text-xs font-black text-red-200">
              A soma passa do saldo da NE em R$ {formatarBRL(excedeCents)}
            </p>
          )}
        </div>
        <div className="flex w-full md:w-auto items-center justify-end gap-3">
          <button
            type="button"
            onClick={onLimpar}
            disabled={quantidade === 0 || emitindo}
            className="bg-white/10 hover:bg-white/20 text-white text-sm font-bold py-2.5 px-5 rounded-xl transition-all flex items-center gap-2 border border-white/10 disabled:opacity-40"
          >
            <Eraser className="w-4 h-4" /> Limpar lista
          </button>
          <button
            type="button"
            onClick={onEmitir}
            disabled={desabilitado}
            className="bg-blue-500 hover:bg-blue-400 text-white text-sm font-bold py-2.5 px-6 rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" /> {rotulo}
          </button>
        </div>
      </div>
    </div>
  );
}
