"use client";
import { CheckCircle2, Info, Printer } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatarBRL, toCents } from "@/lib/money";
import type { NumeroPrevisto } from "@/lib/op-emissao";

export interface OpEmitida {
  id: string;
  numeroOp: string;
  sub: string;
  credorCpfCnpj: string;
  credorNome: string;
  valorPagamento: number;
  totalDescontos: number;
  valorLiquido: number;
}

export interface ResultadoEmissao {
  numeroNe: string;
  ops: OpEmitida[];
  resumo: { quantidade: number; totalBruto: number; saldoAnterior: number; saldoRestante: number; statusNe: string | null };
  mudaram: Array<{ indice: number; previsto: NumeroPrevisto; gravado: { numeroOp: string; sub: string } }>;
}

/** Sucesso da emissão (T35-B): as OPs criadas, com o caminho para imprimir. */
export function DialogoEmissao({ resultado, onFechar }: { resultado: ResultadoEmissao | null; onFechar: () => void }) {
  const urlImpressao = resultado ? `/consulta-impressao?ne=${encodeURIComponent(resultado.numeroNe)}` : "#";

  return (
    <Dialog open={!!resultado} onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent className="max-w-3xl">
        {resultado && (
          <>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              {resultado.ops.length === 1 ? "1 ordem de pagamento emitida" : `${resultado.ops.length} ordens de pagamento emitidas`}
            </DialogTitle>
            <DialogDescription>
              NE {resultado.numeroNe} · total R$ {formatarBRL(toCents(resultado.resumo.totalBruto))} · restante da NE R${" "}
              {formatarBRL(toCents(resultado.resumo.saldoRestante))}
              {resultado.resumo.statusNe && <> · {resultado.resumo.statusNe}</>}
            </DialogDescription>

            {resultado.mudaram.length > 0 && (
              <p role="status" className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm font-semibold text-amber-800">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                O número mudou porque outra OP foi salva antes:{" "}
                {resultado.mudaram.map((m) => `${m.gravado.numeroOp} /${m.gravado.sub} (previsto ${m.previsto.numeroOp} /${m.previsto.sub})`).join("; ")}.
              </p>
            )}

            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-black text-slate-500 uppercase tracking-widest">
                    <th className="py-2">Nº da OP</th>
                    <th className="py-2">Credor</th>
                    <th className="py-2 text-right">Bruto</th>
                    <th className="py-2 text-right">Líquido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {resultado.ops.map((op) => (
                    <tr key={op.id}>
                      <td className="py-2 font-bold text-blue-900">
                        {op.numeroOp} <span className="font-semibold text-slate-500">/{op.sub}</span>
                      </td>
                      <td className="py-2 font-semibold text-slate-700">{op.credorNome}</td>
                      <td className="py-2 text-right">R$ {formatarBRL(toCents(op.valorPagamento))}</td>
                      <td className="py-2 text-right font-black text-emerald-700">R$ {formatarBRL(toCents(op.valorLiquido))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <a
                href={urlImpressao}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-2.5 px-5 rounded-xl shadow-sm transition-all flex items-center gap-2"
              >
                <Printer className="w-4 h-4" /> Imprimir
              </a>
              <button
                type="button"
                onClick={onFechar}
                className="bg-blue-900 hover:bg-blue-800 text-white text-sm font-bold py-2.5 px-5 rounded-xl shadow-sm transition-all"
              >
                Nova emissão nesta NE
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
