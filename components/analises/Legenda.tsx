"use client";
import { CheckSquare, Clock3 } from "lucide-react";
import { paleta } from "./paleta";

export interface ItemLegenda {
  nome: string;
  /** Cor ou hachura (qualquer `background` do CSS). */
  fundo: string;
  /** Status: o ícone vem junto com o texto, a cor nunca fica sozinha. */
  status?: "paga" | "pendente";
}

export function Legenda({ itens }: { itens: ItemLegenda[] }) {
  // Uma série não precisa de legenda: o título já diz o que é.
  if (itens.length < 2) return null;
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1.5 p-0 text-xs" style={{ color: paleta.textoSecundario }}>
      {itens.map((i) => (
        <li key={i.nome} className="inline-flex items-center gap-1.5">
          {i.status === "paga" ? (
            <CheckSquare aria-hidden="true" className="h-3.5 w-3.5" style={{ color: paleta.verde }} />
          ) : i.status === "pendente" ? (
            <Clock3 aria-hidden="true" className="h-3.5 w-3.5" style={{ color: paleta.ambarTexto }} />
          ) : (
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[2px]" style={{ background: i.fundo }} />
          )}
          {i.nome}
        </li>
      ))}
    </ul>
  );
}
