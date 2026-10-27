"use client";
import { useId, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from "react";

export interface GatilhoDica {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: (e: FocusEvent) => void;
  onBlur: (e: FocusEvent) => void;
  onKeyDown: (e: KeyboardEvent) => void;
  "aria-describedby": string | undefined;
}

/**
 * Dica do gráfico: aparece no mouse E no foco do teclado (o `title` do
 * navegador não aparece no teclado nem no celular). Fecha ao sair e no Esc.
 */
export function ComDica({
  texto,
  className = "",
  children,
}: {
  texto: ReactNode;
  className?: string;
  children: (gatilho: GatilhoDica) => ReactNode;
}) {
  const id = useId();
  const [aberta, setAberta] = useState(false);
  const gatilho: GatilhoDica = {
    onMouseEnter: () => setAberta(true),
    onMouseLeave: () => setAberta(false),
    onFocus: () => setAberta(true),
    onBlur: () => setAberta(false),
    onKeyDown: (e) => {
      if (e.key === "Escape") setAberta(false);
    },
    "aria-describedby": aberta ? id : undefined,
  };

  return (
    <div className={`relative ${className}`}>
      {children(gatilho)}
      {aberta && (
        <div
          id={id}
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[260px] -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs leading-relaxed text-white shadow-lg"
        >
          {texto}
        </div>
      )}
    </div>
  );
}
