"use client";
import type { ReactNode } from "react";
import { ESPACO_TOPO, gradeDoEixo } from "../escala";
import { curto } from "../formato";
import { paleta } from "../paleta";

/** Quadro dos gráficos de colunas: grade (metade e teto), eixo e os rótulos de baixo. */
export function QuadroVertical({
  altura,
  tetoEscala,
  grade = true,
  rotulos,
  children,
}: {
  altura: number;
  tetoEscala: number;
  /** Sem grade: rótulos diretos nas barras. */
  grade?: boolean;
  rotulos: string[];
  children: ReactNode;
}) {
  const margem = grade ? 64 : 0;
  return (
    <div className="flex flex-col gap-1.5 tabular-nums">
      <div className="relative border-b" style={{ height: altura, marginLeft: margem, borderColor: paleta.eixo }}>
        {grade &&
          gradeDoEixo(tetoEscala).map((g) => (
            <span
              key={g.pos}
              aria-hidden="true"
              className="absolute right-0 border-t border-dashed text-[11px] leading-[0]"
              style={{ left: -margem, bottom: `${g.pos * ESPACO_TOPO}%`, borderColor: paleta.grade, color: paleta.textoMudo }}
            >
              <span className="inline-block w-[58px] text-right">{curto(g.valor)}</span>
            </span>
          ))}
        <div className="absolute inset-0 flex items-end gap-2">{children}</div>
      </div>
      <div className="flex gap-2" style={{ marginLeft: margem }} aria-hidden="true">
        {rotulos.map((r, i) => (
          <span key={i} className="min-w-0 flex-1 text-center text-xs" style={{ color: paleta.textoSecundario }}>
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}
