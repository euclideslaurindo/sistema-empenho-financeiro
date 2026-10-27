"use client";
import { AlertTriangle } from "lucide-react";
import { paleta } from "../paleta";
import type { RespostaAnalises } from "./tipos";

/** A frase do topo (montada pelas contas, na B2) e os avisos de dado inconsistente. */
export function ResumoAnalises({ dados }: { dados: RespostaAnalises }) {
  return (
    <div className="flex flex-col gap-4">
      {dados.avisos.length > 0 && (
        <div role="status" className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 flex-none text-amber-700" />
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {dados.avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      <p
        data-testid="resumo-analises"
        className="m-0 max-w-[72ch] text-[22px] leading-normal [text-wrap:pretty]"
        style={{ color: paleta.texto, fontFamily: "var(--font-titulo-analises, Georgia), Georgia, serif" }}
      >
        {dados.resumo.map((t, i) =>
          t.forte ? (
            <strong key={i} className="font-bold">
              {t.t}
            </strong>
          ) : (
            <span key={i}>{t.t}</span>
          )
        )}
      </p>
    </div>
  );
}
