"use client";
import { useState, type ReactNode } from "react";
import { Legenda, type ItemLegenda } from "./Legenda";
import { TabelaDados, type DadosTabela } from "./TabelaDados";
import { paleta } from "./paleta";

/**
 * Moldura de todo gráfico da aba Análises: sobretítulo (o tema), título (o
 * resultado), "Ver tabela", legenda, o gráfico ou a tabela, e a nota.
 */
export function CartaoGrafico({
  id,
  sobretitulo,
  titulo,
  legenda = [],
  tabela,
  nota,
  vazio = false,
  acoes,
  className = "",
  children,
}: {
  id: string;
  sobretitulo: string;
  titulo: string;
  legenda?: ItemLegenda[];
  tabela: DadosTabela;
  nota?: ReactNode;
  vazio?: boolean;
  /** Botões extras ao lado do "Ver tabela". */
  acoes?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const [verTabela, setVerTabela] = useState(false);
  const idTitulo = `${id}-titulo`;
  const idCorpo = `${id}-corpo`;

  return (
    <section aria-labelledby={idTitulo} className={`flex min-w-0 flex-col gap-3.5 rounded-xl border border-[#dde3ec] bg-white px-6 py-5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: paleta.textoMudo }}>
            {sobretitulo}
          </span>
          <h3
            id={idTitulo}
            className="m-0 text-xl font-semibold [text-wrap:balance]"
            style={{ color: paleta.texto, fontFamily: "var(--font-titulo-analises, Georgia), Georgia, serif" }}
          >
            {titulo}
          </h3>
        </div>
        <div className="flex flex-none items-center gap-2">
          {acoes}
          {!vazio && (
            <button
              type="button"
              aria-pressed={verTabela}
              aria-controls={idCorpo}
              onClick={() => setVerTabela((v) => !v)}
              className="h-8 rounded-lg border border-[#c8d1de] bg-white px-2.5 text-xs font-semibold text-blue-900 hover:bg-slate-50 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
            >
              {verTabela ? "Ver gráfico" : "Ver tabela"}
            </button>
          )}
        </div>
      </div>

      {!vazio && !verTabela && <Legenda itens={legenda} />}

      <div id={idCorpo}>
        {vazio ? (
          <p className="m-0 py-10 text-center text-sm font-semibold" style={{ color: paleta.textoMudo }}>
            Sem movimento no período.
          </p>
        ) : verTabela ? (
          <TabelaDados dados={tabela} />
        ) : (
          <div role="group" aria-labelledby={idTitulo}>
            {children}
          </div>
        )}
      </div>

      {nota && (
        <p className="m-0 text-xs" style={{ color: paleta.textoMudo }}>
          {nota}
        </p>
      )}
    </section>
  );
}
