"use client";
import { ArrowDown, ArrowUp } from "lucide-react";
import { brl, curto, pct1 } from "../formato";
import { paleta } from "../paleta";
import type { RespostaAnalises } from "./tipos";

function Variacao({ valor, comparacao }: { valor: number | null; comparacao: string }) {
  if (valor === null) return <span>sem base de comparação</span>;
  const sinal = valor > 0 ? "+" : valor < 0 ? "−" : "";
  return (
    <span className="inline-flex items-center gap-1">
      {valor > 0 && <ArrowUp aria-hidden="true" className="h-3 w-3" />}
      {valor < 0 && <ArrowDown aria-hidden="true" className="h-3 w-3" />}
      {sinal}
      {pct1(Math.abs(valor))} sobre {comparacao}
    </span>
  );
}

/** Os 4 cartões do topo, cada um com a variação sobre o mesmo recorte do ano anterior. */
export function CartoesAnalises({ dados }: { dados: RespostaAnalises }) {
  const k = dados.kpis;
  const comp = dados.periodo.rotuloComparacao;
  const cartoes = [
    { rotulo: "Empenhado", valor: k.empenhado, variacao: k.varEmpenhado, nota: `${dados.qtdNes} ${dados.qtdNes === 1 ? "NE" : "NEs"} no período`, cor: paleta.texto },
    {
      rotulo: "Pago no período",
      valor: k.pago,
      variacao: k.varPago,
      nota: dados.pagoAnteriores > 0 ? `${curto(dados.pagoDasNes)} das NEs do período · ${curto(dados.pagoAnteriores)} de NEs anteriores` : `${dados.qtdOps} OPs a ${dados.qtdCredores} credores`,
      cor: paleta.texto,
    },
    { rotulo: "Saldo a pagar", valor: k.saldo, variacao: k.varSaldo, nota: "das NEs empenhadas no período", cor: paleta.ambarTexto },
    { rotulo: "Retido dos credores", valor: k.retido, variacao: k.varRetido, nota: "IRRF, ISS, INSS e SEST/SENAT", cor: paleta.texto },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cartoes.map((c) => (
        <div key={c.rotulo} className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-[#dde3ec] bg-white px-5 py-4 tabular-nums" data-testid={`cartao-${c.rotulo}`}>
          <span className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: paleta.textoMudo }}>
            {c.rotulo}
          </span>
          <span className="text-[26px] font-bold tracking-tight" style={{ color: c.cor }}>
            {brl(c.valor)}
          </span>
          <span className="text-[13px] font-semibold" style={{ color: paleta.textoSecundario }}>
            <Variacao valor={c.variacao} comparacao={comp} />
          </span>
          <span className="text-xs leading-snug" style={{ color: paleta.textoMudo }}>
            {c.nota}
          </span>
        </div>
      ))}
    </div>
  );
}
