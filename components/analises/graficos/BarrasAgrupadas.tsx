"use client";
import { ESPACO_TOPO, pct, teto } from "../escala";
import { brl } from "../formato";
import { paleta } from "../paleta";
import { ANIMA, Marca } from "./Marca";
import { QuadroVertical } from "./QuadroVertical";

export interface Categoria {
  chave: string;
  rotulo: string;
  rotuloLongo: string;
}
export interface Serie {
  chave: string;
  nome: string;
  fundo: string;
}
export type Valores = Record<string, Record<string, number>>;

/** Duas séries lado a lado por categoria (empenhado × pago por mês). Um eixo só. */
export function BarrasAgrupadas({
  categorias,
  series,
  valores,
  destaque,
  onSelecionar,
  altura = 210,
}: {
  categorias: Categoria[];
  series: Serie[];
  valores: Valores;
  destaque?: string;
  onSelecionar?: (chave: string) => void;
  altura?: number;
}) {
  const t = teto(Math.max(0, ...categorias.flatMap((c) => series.map((s) => valores[c.chave]?.[s.chave] ?? 0))));
  return (
    <QuadroVertical altura={altura} tetoEscala={t} rotulos={categorias.map((c) => c.rotulo)}>
      {categorias.map((c) => {
        const texto = `${c.rotuloLongo}: ${series.map((s) => `${s.nome.toLowerCase()} ${brl(valores[c.chave]?.[s.chave] ?? 0)}`).join(", ")}`;
        const hs = series.map((s) => pct(valores[c.chave]?.[s.chave] ?? 0, t) * ESPACO_TOPO);
        return (
          <Marca
            key={c.chave}
            nome={texto}
            dica={texto}
            onClick={onSelecionar ? () => onSelecionar(c.chave) : undefined}
            className="h-full min-w-0 flex-1"
            classeInterna="relative flex h-full w-full items-end justify-center gap-[2px]"
          >
            {series.map((s, i) => (
              <span
                key={s.chave}
                data-testid={`barra-${c.chave}-${s.chave}`}
                data-altura={Math.round(hs[i] * 100) / 100}
                className={`w-[42%] rounded-t group-hover:brightness-110 ${ANIMA}`}
                style={{ height: `${hs[i]}%`, background: s.fundo }}
              />
            ))}
            {destaque === c.chave && (
              <span
                className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold"
                style={{ bottom: `calc(${Math.max(...hs)}% + 6px)`, color: paleta.texto }}
              >
                maior
              </span>
            )}
          </Marca>
        );
      })}
    </QuadroVertical>
  );
}
