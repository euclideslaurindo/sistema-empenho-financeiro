"use client";
import { paleta } from "../paleta";
import { ANIMA } from "./Marca";

/**
 * A faixa pequena de quantidade (as OPs), alinhada às colunas do gráfico de
 * cima: mesma ordem de itens, mesmo `gap` e mesma margem do eixo. Escala
 * própria, porque quantidade e valor não dividem eixo.
 */
export function FaixaQuantidade({
  titulo,
  itens,
  margemEixo = 64,
  altura = 64,
}: {
  titulo: string;
  itens: Array<{ chave: string; valor: number; rotulo?: string }>;
  margemEixo?: number;
  altura?: number;
}) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <div className="flex flex-col gap-1.5 tabular-nums">
      <span className="text-xs font-semibold" style={{ color: paleta.textoSecundario }}>
        {titulo}
      </span>
      <div className="flex items-end gap-2 border-b" style={{ height: altura, marginLeft: margemEixo, borderColor: paleta.eixo }}>
        {itens.map((i) => {
          const h = Math.round((Math.max(0, i.valor) / max) * 100 * 0.78 * 100) / 100;
          return (
            <div key={i.chave} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-[3px]">
              <span className="text-[11px]" style={{ color: paleta.textoSecundario }}>
                {i.valor}
              </span>
              <span
                role="img"
                aria-label={`${i.rotulo ?? i.chave}: ${i.valor}`}
                data-testid={`faixa-${i.chave}`}
                data-altura={h}
                className={`w-[62%] rounded-t-[3px] ${ANIMA}`}
                style={{ height: `${h}%`, background: paleta.cinza }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
