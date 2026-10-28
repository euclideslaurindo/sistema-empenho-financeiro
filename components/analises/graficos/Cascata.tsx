"use client";
import { ESPACO_TOPO, pct } from "../escala";
import { brl, curto } from "../formato";
import { paleta } from "../paleta";
import { ANIMA, Marca } from "./Marca";

export interface EtapaCascata {
  chave: string;
  rotulo: string;
  valor: number;
  /** total: começa no chão; menos: desce do que sobrou; saldo: o que restou, do chão. */
  tipo: "total" | "menos" | "saldo";
  fundo: string;
}

export interface BarraCascata {
  chave: string;
  /** % do quadro (já com o espaço livre do topo). */
  base: number;
  altura: number;
  topo: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** A geometria da ponte: cada "menos" começa onde o anterior terminou. Negativo não inverte (D8). */
export function calcularCascata(etapas: EtapaCascata[]): BarraCascata[] {
  const escala = Math.max(1, ...etapas.filter((e) => e.tipo === "total").map((e) => e.valor));
  let restante = 0;
  return etapas.map((e) => {
    let de = 0;
    let ate = 0;
    if (e.tipo === "total") {
      ate = e.valor;
      restante = e.valor;
    } else if (e.tipo === "menos") {
      ate = restante;
      de = restante - e.valor;
      restante = de;
    } else {
      ate = e.valor;
    }
    const base = pct(de, escala) * ESPACO_TOPO;
    const topo = pct(ate, escala) * ESPACO_TOPO;
    return { chave: e.chave, base: r2(base), altura: r2(Math.max(0, topo - base)), topo: r2(Math.max(base, topo)) };
  });
}

/** Etapa com valor nunca some: mesmo R$ 937 num empenho de R$ 1,4 mi aparece como um filete. */
export const ALTURA_MINIMA_PX = 4;

/** Quanto ainda resta do empenhado depois de cada etapa "menos" (a faixa clara embaixo dela). */
function restosDaCascata(etapas: EtapaCascata[]): number[] {
  let restante = 0;
  return etapas.map((e) => {
    if (e.tipo === "total") restante = e.valor;
    else if (e.tipo === "menos") restante -= e.valor;
    return e.tipo === "menos" ? restante : 0;
  });
}

export function Cascata({ etapas, altura = 260 }: { etapas: EtapaCascata[]; altura?: number }) {
  const barras = calcularCascata(etapas);
  const restos = restosDaCascata(etapas);
  return (
    <div className="grid items-end gap-4" style={{ gridTemplateColumns: `repeat(${etapas.length}, minmax(0, 1fr))` }}>
      {etapas.map((e, i) => {
        const b = barras[i];
        const comValor = e.valor > 0;
        // A barra colorida tem altura mínima; o rótulo fica logo acima dela.
        const alturaBarra = comValor ? `max(${b.altura}%, ${ALTURA_MINIMA_PX}px)` : "0%";
        const resto = e.tipo === "menos" && b.base > 0;
        const texto = `${e.rotulo}: ${brl(e.valor)}${e.tipo === "menos" ? `. Depois desta etapa restam ${brl(Math.max(0, restos[i]))}` : ""}`;
        return (
          <div key={e.chave} className="flex min-w-0 flex-col gap-2.5">
            <Marca
              nome={texto}
              dica={texto}
              className="w-full"
              classeInterna="relative block w-full border-b"
              style={{ height: altura, borderColor: paleta.eixo }}
            >
              {resto && (
                // O que ainda resta do empenhado: a coluna aparece inteira, e a etapa fica em cima.
                <span
                  data-testid={`cascata-resto-${e.chave}`}
                  data-altura={b.base}
                  className={`absolute bottom-0 left-[12%] right-[12%] rounded-b ${ANIMA}`}
                  style={{ height: `${b.base}%`, background: paleta.restoCascata }}
                />
              )}
              <span
                data-testid={`cascata-${e.chave}`}
                data-base={b.base}
                data-altura={b.altura}
                className={`absolute left-[12%] right-[12%] ${resto ? "rounded-t" : "rounded"} ${ANIMA}`}
                style={{ bottom: `${b.base}%`, height: alturaBarra, background: e.fundo }}
              />
              <span
                className="absolute inset-x-0 whitespace-nowrap text-center text-[15px] font-bold tabular-nums"
                style={{ bottom: comValor ? `calc(${b.base}% + ${alturaBarra} + 6px)` : `calc(${b.topo}% + 6px)`, color: paleta.texto }}
              >
                {curto(e.valor)}
              </span>
            </Marca>
            <span className="text-center text-[13px] font-semibold leading-tight" style={{ color: paleta.textoSecundario }}>
              {e.rotulo}
            </span>
          </div>
        );
      })}
    </div>
  );
}
