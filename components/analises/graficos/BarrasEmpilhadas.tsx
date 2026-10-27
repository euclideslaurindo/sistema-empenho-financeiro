"use client";
import { ESPACO_TOPO, pct, teto } from "../escala";
import { brl } from "../formato";
import { ANIMA, Marca } from "./Marca";
import { QuadroVertical } from "./QuadroVertical";
import type { Categoria, Serie, Valores } from "./BarrasAgrupadas";

/**
 * Séries empilhadas por categoria (retenções por mês, DARF paga × pendente).
 * Ordem fixa de baixo para cima; segmento zero não é desenhado.
 */
export function BarrasEmpilhadas({
  categorias,
  series,
  valores,
  altura = 200,
}: {
  categorias: Categoria[];
  series: Serie[];
  valores: Valores;
  altura?: number;
}) {
  const totalDe = (c: string) => series.reduce((t, s) => t + Math.max(0, valores[c]?.[s.chave] ?? 0), 0);
  const t = teto(Math.max(0, ...categorias.map((c) => totalDe(c.chave))));
  return (
    <QuadroVertical altura={altura} tetoEscala={t} rotulos={categorias.map((c) => c.rotulo)}>
      {categorias.map((c) => {
        const partes = series.filter((s) => (valores[c.chave]?.[s.chave] ?? 0) > 0);
        const texto = `${c.rotuloLongo}: ${series.map((s) => `${s.nome} ${brl(valores[c.chave]?.[s.chave] ?? 0)}`).join(", ")}`;
        return (
          <Marca key={c.chave} nome={texto} dica={texto} className="h-full min-w-0 flex-1" classeInterna="flex h-full w-full flex-col-reverse items-center gap-[2px]">
            {partes.map((s, i) => (
              <span
                key={s.chave}
                data-testid={`pilha-${c.chave}-${s.chave}`}
                className={`w-[62%] ${i === partes.length - 1 ? "rounded-t" : ""} ${ANIMA}`}
                style={{ height: `${pct(valores[c.chave][s.chave], t) * ESPACO_TOPO}%`, background: s.fundo }}
              />
            ))}
          </Marca>
        );
      })}
    </QuadroVertical>
  );
}
