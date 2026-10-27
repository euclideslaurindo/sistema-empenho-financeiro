"use client";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { brl } from "../formato";
import { paleta } from "../paleta";
import type { RespostaOps } from "./tipos";

const dataBR = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "-");

export type EstadoDetalhe = { dados: RespostaOps } | { erro: string } | null;

/** As OPs de um mês, ao clicar numa barra (T5–T6). */
export function PainelDetalhe({
  aberto,
  titulo,
  subtitulo,
  estado,
  onFechar,
  onTentarDeNovo,
}: {
  aberto: boolean;
  titulo: string;
  subtitulo: string;
  /** null = carregando. */
  estado: EstadoDetalhe;
  onFechar: () => void;
  onTentarDeNovo: () => void;
}) {
  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && onFechar()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogTitle className="text-2xl font-semibold" style={{ fontFamily: "var(--font-titulo-analises, Georgia), Georgia, serif", color: paleta.texto }}>
          {titulo}
        </DialogTitle>
        <DialogDescription className="text-sm" style={{ color: paleta.textoSecundario }}>
          {subtitulo}
        </DialogDescription>

        <div className="mt-4 tabular-nums">
          {estado === null && (
            <div className="space-y-2" aria-busy="true" aria-label="Carregando as OPs">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          )}

          {estado && "erro" in estado && (
            <div role="alert" className="flex flex-col items-start gap-3 rounded-lg bg-slate-50 p-4 text-sm">
              <span>{estado.erro}</span>
              <button type="button" onClick={onTentarDeNovo} className="h-9 rounded-lg border border-[#c8d1de] bg-white px-3 font-semibold text-blue-900">
                Tentar de novo
              </button>
            </div>
          )}

          {estado && "dados" in estado && (
            <div className="flex flex-col">
              {estado.dados.ops.length === 0 && <p className="text-sm">Nenhuma OP neste recorte.</p>}
              {estado.dados.ops.map((o) => (
                <div key={o.id} className="grid grid-cols-[78px_minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-b border-[#eef1f6] py-2.5 text-[13px]">
                  <span style={{ color: paleta.textoMudo }}>{dataBR(o.data)}</span>
                  <span className="min-w-0">
                    <strong className="font-semibold">{o.credor || "-"}</strong>
                    <br />
                    <span style={{ color: paleta.textoMudo }}>
                      {o.numeroNe ? (
                        <Link href={`/consulta-impressao?ne=${encodeURIComponent(o.numeroNe)}&ops=${encodeURIComponent(o.id)}`} className="font-semibold text-blue-900 hover:underline" title="Abrir impressão da OP">
                          {o.numeroOp || "OP"}
                        </Link>
                      ) : (
                        o.numeroOp || "-"
                      )}
                      {" · "}
                      {o.elemento || "-"}
                      {o.restos && (
                        <span className="ml-2 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-900">restos a pagar</span>
                      )}
                    </span>
                  </span>
                  <span className="text-right">
                    <strong className="font-semibold">{brl(o.bruto)}</strong>
                    <br />
                    <span style={{ color: paleta.textoMudo }}>
                      retido {brl(o.retido)} · líq. {brl(o.liquido)}
                    </span>
                  </span>
                </div>
              ))}
              <div className="flex justify-between py-3 text-sm font-bold">
                <span>
                  {estado.dados.truncado ? `Mostrando ${estado.dados.limite} de ${estado.dados.qtd} OPs` : `${estado.dados.qtd} ${estado.dados.qtd === 1 ? "OP" : "OPs"}`}
                </span>
                <span>Total {brl(estado.dados.total)}</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
