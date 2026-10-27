"use client";
import { pct } from "../escala";
import { brl, curto, pct1 } from "../formato";
import { paleta } from "../paleta";
import { ANIMA, Marca } from "./Marca";

export interface ItemHorizontal {
  chave: string;
  rotulo: string;
  /** Segunda linha do rótulo (ex.: a descrição do elemento). */
  sub?: string;
  valor: number;
  /** Participação já calculada (em %). */
  pct?: number;
}

/** Ranking horizontal (elementos, credores, municípios): largura relativa ao maior. */
export function BarrasHorizontais({
  itens,
  onSelecionar,
  larguraRotulo = 190,
  espessura = 14,
}: {
  itens: ItemHorizontal[];
  onSelecionar?: (chave: string) => void;
  larguraRotulo?: number;
  espessura?: number;
}) {
  const max = Math.max(0, ...itens.map((i) => i.valor));
  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0 tabular-nums">
      {itens.map((i) => {
        const nome = `${i.rotulo}${i.sub ? ` ${i.sub}` : ""}: ${brl(i.valor)}${i.pct !== undefined ? ` (${pct1(i.pct)})` : ""}`;
        const w = pct(i.valor, max);
        return (
          <li key={i.chave}>
            <Marca
              nome={nome}
              dica={nome}
              onClick={onSelecionar ? () => onSelecionar(i.chave) : undefined}
              className="w-full"
              classeInterna="grid w-full items-center gap-3 text-left"
              style={{ gridTemplateColumns: `minmax(0, ${larguraRotulo}px) minmax(0, 1fr) auto` }}
            >
              <span className="min-w-0 text-[13px] leading-tight" style={{ color: paleta.texto }}>
                <span className={`block truncate ${i.sub ? "font-semibold" : ""}`}>{i.rotulo}</span>
                {i.sub && <span className="block truncate" style={{ color: paleta.textoSecundario }}>{i.sub}</span>}
              </span>
              <span className="block rounded-r" style={{ height: espessura, background: "#eef1f6" }}>
                <span data-testid={`horizontal-${i.chave}`} data-largura={w} className={`block h-full rounded-r group-hover:brightness-110 ${ANIMA}`} style={{ width: `${w}%`, background: paleta.azul }} />
              </span>
              <span className="whitespace-nowrap text-right text-[13px]">
                <strong className="font-semibold" style={{ color: paleta.texto }}>
                  {curto(i.valor)}
                </strong>
                {i.pct !== undefined && <span style={{ color: paleta.textoMudo }}> {pct1(i.pct)}</span>}
              </span>
            </Marca>
          </li>
        );
      })}
    </ul>
  );
}
