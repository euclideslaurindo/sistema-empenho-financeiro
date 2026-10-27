"use client";
import { ESPACO_TOPO, pct, teto } from "../escala";
import { brl, curto } from "../formato";
import { paleta } from "../paleta";
import { ANIMA, Marca } from "./Marca";
import { QuadroVertical } from "./QuadroVertical";

export interface ItemVertical {
  chave: string;
  rotulo: string;
  rotuloLongo?: string;
  valor: number;
  /** Cor própria do item (ex.: NE cancelada hachurada). */
  fundo?: string;
  /** Texto pequeno embaixo do rótulo (ex.: "12 NEs"). */
  sub?: string;
  /** Linhas extras da dica. */
  dica?: string;
}

/** Uma série por categoria (pagamentos por mês, situação das NEs). */
export function BarrasVerticais({
  itens,
  destaque,
  rotulosNoTopo = "destaque",
  grade = true,
  onSelecionar,
  altura = 150,
}: {
  itens: ItemVertical[];
  destaque?: string;
  /** Valor curto acima das barras: só a destacada, todas ou nenhuma. */
  rotulosNoTopo?: "destaque" | "todos" | "nenhum";
  grade?: boolean;
  onSelecionar?: (chave: string) => void;
  altura?: number;
}) {
  const t = teto(Math.max(0, ...itens.map((i) => i.valor)));
  return (
    <div className="flex flex-col gap-1">
      <QuadroVertical altura={altura} tetoEscala={t} grade={grade} rotulos={itens.map((i) => i.rotulo)}>
        {itens.map((i) => {
          const h = pct(i.valor, t) * ESPACO_TOPO;
          const nome = `${i.rotuloLongo ?? i.rotulo}: ${brl(i.valor)}${i.dica ? `. ${i.dica}` : ""}`;
          const mostrar = rotulosNoTopo === "todos" || (rotulosNoTopo === "destaque" && destaque === i.chave);
          return (
            <Marca
              key={i.chave}
              nome={nome}
              dica={nome}
              onClick={onSelecionar ? () => onSelecionar(i.chave) : undefined}
              className="h-full min-w-0 flex-1"
              classeInterna="relative flex h-full w-full items-end justify-center"
            >
              <span
                data-testid={`vertical-${i.chave}`}
                data-altura={Math.round(h * 100) / 100}
                className={`w-[62%] rounded-t group-hover:brightness-110 ${ANIMA}`}
                style={{ height: `${h}%`, background: i.fundo ?? paleta.azul }}
              />
              {mostrar && (
                <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[12px] font-bold" style={{ bottom: `calc(${h}% + 6px)`, color: paleta.texto }}>
                  {curto(i.valor)}
                </span>
              )}
            </Marca>
          );
        })}
      </QuadroVertical>
      {itens.some((i) => i.sub) && (
        <div className="flex gap-2" style={{ marginLeft: grade ? 64 : 0 }} aria-hidden="true">
          {itens.map((i) => (
            <span key={i.chave} className="min-w-0 flex-1 text-center text-xs" style={{ color: paleta.textoMudo }}>
              {i.sub ?? ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
