"use client";
import type { ReactNode } from "react";
import { Cascata } from "../graficos/Cascata";
import { BarrasHorizontais } from "../graficos/BarrasHorizontais";
import { paleta } from "../paleta";
import { montarElementos, montarPonte } from "../tela/montar";
import { elementosDoRelatorio } from "../relatorio/montar-relatorio";
import type { RespostaAnalises } from "../tela/tipos";
import { frasesDeAbertura } from "./navegacao";

const serif = { fontFamily: "var(--font-titulo-analises, Georgia), Georgia, serif" };

export interface DadosSlides {
  dados: RespostaAnalises;
  identificacao: { orgao: string; setor: string };
}

function Sobretitulo({ children, claro = false, parcial }: { children: ReactNode; claro?: boolean; parcial: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <span className="text-[15px] font-bold uppercase tracking-[0.16em]" style={{ color: claro ? "#c7d2ea" : paleta.textoMudo }}>
        {children}
      </span>
      {parcial && (
        <span className="rounded-full border px-3 py-1 text-[13px] font-bold" style={claro ? { borderColor: "#f6c370", color: "#f6c370" } : { borderColor: "#f1d29b", color: paleta.ambarTexto, background: "#fff4e0" }}>
          Período em andamento
        </span>
      )}
    </div>
  );
}

function SemMovimento() {
  return <p className="m-0 flex flex-1 items-center justify-center text-[28px] font-semibold" style={{ color: paleta.textoMudo }}>Sem movimento no período.</p>;
}

export function SlideAbertura({ dados, identificacao }: DadosSlides) {
  const f = frasesDeAbertura(dados);
  const rodape = [identificacao.orgao, identificacao.setor].filter(Boolean).join(" · ");
  return (
    <div className="flex h-full flex-col gap-7 px-24 pb-16 pt-[72px] text-white" style={{ background: "#10204d" }}>
      <Sobretitulo claro parcial={dados.periodo.parcial}>
        Prestação de contas · {dados.periodo.rotulo}
      </Sobretitulo>
      <div className="flex flex-1 flex-col justify-center gap-7">
        <p className="m-0 max-w-[22ch] text-[60px] font-semibold leading-[1.12] [text-wrap:balance]" style={serif} data-testid="abertura-principal">
          {f.principal}
        </p>
        {f.apoio && (
          <p className="m-0 text-[26px] leading-snug" style={{ color: "#dbe3f4" }} data-testid="abertura-apoio">
            {f.apoio}
          </p>
        )}
      </div>
      <span className="text-[15px]" style={{ color: "#c7d2ea" }} data-testid="abertura-rodape">
        {rodape || "Estado de Pernambuco"}
      </span>
    </div>
  );
}

export function SlidePonte({ dados }: DadosSlides) {
  const p = montarPonte(dados);
  return (
    <div className="flex h-full flex-col gap-6 bg-white px-24 pb-16 pt-14">
      <Sobretitulo parcial={dados.periodo.parcial}>Ponte do orçamento · NEs do período</Sobretitulo>
      <h2 className="m-0 text-[44px] font-semibold leading-tight [text-wrap:balance]" style={{ ...serif, color: paleta.texto }}>
        {p.titulo}
      </h2>
      {p.vazio ? (
        <SemMovimento />
      ) : (
        <div className="flex flex-1 flex-col justify-end">
          <Cascata etapas={p.props.etapas} altura={330} />
        </div>
      )}
      <span className="text-[15px]" style={{ color: paleta.textoSecundario }}>
        A área âmbar é o que ainda falta pagar.
      </span>
    </div>
  );
}

export function SlideElementos({ dados }: DadosSlides) {
  const m = montarElementos(dados);
  const linhas = elementosDoRelatorio(dados.elementos).map((e, i) => ({ chave: `${i}-${e.nome}`, rotulo: e.nome, valor: e.pago, pct: e.pct }));
  return (
    <div className="flex h-full flex-col gap-6 bg-white px-24 pb-16 pt-14">
      <Sobretitulo parcial={dados.periodo.parcial}>Pago por elemento de despesa · {dados.periodo.rotulo}</Sobretitulo>
      <h2 className="m-0 text-[44px] font-semibold leading-tight [text-wrap:balance]" style={{ ...serif, color: paleta.texto }}>
        {m.titulo}
      </h2>
      {m.vazio ? (
        <SemMovimento />
      ) : (
        <div className="flex flex-1 flex-col justify-center text-[20px] [&_span]:text-[18px]">
          <BarrasHorizontais itens={linhas} larguraRotulo={360} espessura={28} />
        </div>
      )}
      <span className="text-[15px]" style={{ color: paleta.textoSecundario }}>
        Base: {dados.base === "civil" ? "ano civil (data do pagamento)" : "exercício da NE"}
        {dados.elemento ? ` · elemento ${dados.elemento}` : ""}
      </span>
    </div>
  );
}

export const SLIDES = [
  { titulo: "Abertura", fundo: "#10204d", Componente: SlideAbertura },
  { titulo: "Ponte do orçamento", fundo: "#ffffff", Componente: SlidePonte },
  { titulo: "Pago por elemento", fundo: "#ffffff", Componente: SlideElementos },
] as const;
