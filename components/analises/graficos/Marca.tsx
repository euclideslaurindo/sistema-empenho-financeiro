"use client";
import type { CSSProperties, ReactNode } from "react";
import { ComDica } from "../Dica";

/**
 * Uma barra (ou coluna) com dica e nome acessível. Clicável vira `<button>`;
 * sem clique, é uma imagem focável (a dica também abre pelo teclado).
 */
export function Marca({
  nome,
  dica,
  onClick,
  className = "",
  classeInterna = "",
  style,
  children,
}: {
  /** O que o leitor de tela fala: o valor por extenso. */
  nome: string;
  dica: ReactNode;
  onClick?: () => void;
  className?: string;
  classeInterna?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const foco = "focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber-500";
  return (
    <ComDica texto={dica} className={className}>
      {(g) =>
        onClick ? (
          <button type="button" aria-label={`${nome}. Abrir o detalhe`} onClick={onClick} className={`group cursor-pointer border-0 bg-transparent p-0 ${foco} ${classeInterna}`} style={style} {...g}>
            {children}
          </button>
        ) : (
          <span role="img" tabIndex={0} aria-label={nome} className={`${foco} ${classeInterna}`} style={style} {...g}>
            {children}
          </span>
        )
      }
    </ComDica>
  );
}

/** Classe das barras: anima a altura só para quem não pediu menos movimento. */
export const ANIMA = "motion-safe:transition-[height,width,bottom] motion-safe:duration-300";
