"use client";
import type { ReactNode } from "react";

/**
 * Uma folha A4 de altura fixa (210 × 297 mm, margens de 18 mm). Na tela,
 * parece papel; na impressão, cada folha é uma página (o @page A4 é global).
 */
export function Folha({ pagina, total, children }: { pagina: number; total: number; children: ReactNode }) {
  return (
    <section
      aria-label={`Página ${pagina} de ${total}`}
      data-testid={`folha-${pagina}`}
      className="relative mx-auto flex flex-col overflow-hidden bg-white text-[#111827] shadow-[0_8px_30px_rgba(15,23,42,0.12)] print:shadow-none"
      style={{ width: "210mm", height: "297mm", padding: "16mm 18mm 14mm", boxSizing: "border-box", breakAfter: pagina < total ? "page" : "auto", fontVariantNumeric: "tabular-nums" }}
    >
      {children}
    </section>
  );
}
