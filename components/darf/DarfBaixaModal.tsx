"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatarBRL } from "@/lib/money";
import { hojeIso } from "./tipos";

export function DarfBaixaModal({
  aberto,
  quantidade,
  totalCents,
  onFechar,
  onConfirmar,
}: {
  aberto: boolean;
  quantidade: number;
  totalCents: number;
  onFechar: () => void;
  onConfirmar: (dataPagamento: string, observacao: string) => Promise<void>;
}) {
  const hoje = hojeIso();
  const [data, setData] = useState(hoje);
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const confirmar = async () => {
    if (!data) return setErro("Informe a data de pagamento.");
    if (data > hoje) return setErro("A data de pagamento não pode ser futura.");
    setErro(null);
    setEnviando(true);
    try {
      await onConfirmar(data, observacao);
    } catch (e: any) {
      setErro(e?.message || "Não foi possível marcar como paga.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog
      open={aberto}
      onOpenChange={(abrir) => {
        if (!abrir) onFechar();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogTitle className="text-lg font-black text-slate-800">Marcar como paga</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-slate-500">
          {quantidade} DARF(s) · R$ {formatarBRL(totalCents)}
        </DialogDescription>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="darf-data-pagamento" className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">
              Data de pagamento
            </label>
            <input
              id="darf-data-pagamento"
              type="date"
              autoFocus
              value={data}
              max={hoje}
              onChange={(e) => setData(e.target.value)}
              aria-invalid={!!erro}
              aria-describedby={erro ? "darf-baixa-erro" : undefined}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-900/10 focus:border-blue-800"
            />
          </div>
          <div>
            <label htmlFor="darf-observacao" className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">
              Observação (opcional)
            </label>
            <textarea
              id="darf-observacao"
              rows={2}
              maxLength={300}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-4 focus:ring-blue-900/10 focus:border-blue-800 resize-none"
            />
          </div>
          {erro && (
            <p id="darf-baixa-erro" role="alert" className="text-sm font-bold text-red-600">
              {erro}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onFechar}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={enviando}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {enviando ? "Salvando..." : "Confirmar pagamento"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
