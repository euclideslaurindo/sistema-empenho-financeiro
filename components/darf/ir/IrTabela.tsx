"use client";
import { Fragment } from "react";
import { ChevronRight } from "lucide-react";
import { formatarBRL, toCents } from "@/lib/money";
import { totaisDoAno } from "@/lib/ir-pessoas-fisicas";
import { IrDetalhe } from "./IrDetalhe";
import type { OpDaPessoaIr, PessoaFisicaIr } from "./tipos-ir";

const brl = (v: number) => formatarBRL(toCents(v));
const th = "pb-3 px-2 text-[11px] font-black text-slate-500 uppercase tracking-widest";
const td = "py-3 px-2";

export function BadgeInformadoIr({ informado }: { informado: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-widest uppercase border ${
        informado ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-amber-100 text-amber-800 border-amber-300"
      }`}
    >
      {informado ? "Informado" : "Pendente"}
    </span>
  );
}

export function textoSemPessoas(ano: number, filtrado: boolean): string {
  if (filtrado) return "Nenhuma pessoa encontrada com estes filtros.";
  return `Nenhuma pessoa física recebeu pagamento em ${ano}.`;
}

export function IrTabela({
  ano,
  pessoas,
  totalDoAno,
  carregando,
  filtrado,
  podeAlterar,
  pendentes,
  abertos,
  detalhes,
  salvandoObservacao,
  onAlternar,
  onAbrir,
  onSalvarObservacao,
}: {
  ano: number;
  /** Já filtradas. */
  pessoas: PessoaFisicaIr[];
  totalDoAno: number;
  carregando: boolean;
  filtrado: boolean;
  podeAlterar: boolean;
  pendentes: Set<string>;
  abertos: Set<string>;
  detalhes: Map<string, OpDaPessoaIr[] | "erro">;
  salvandoObservacao: Set<string>;
  onAlternar: (p: PessoaFisicaIr) => void;
  onAbrir: (p: PessoaFisicaIr) => void;
  onSalvarObservacao: (p: PessoaFisicaIr, observacao: string) => void;
}) {
  if (carregando) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Carregando as pessoas físicas">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (pessoas.length === 0) {
    return <p className="py-12 text-center text-slate-400 font-bold">{textoSemPessoas(ano, filtrado)}</p>;
  }

  const soma = totaisDoAno(pessoas);
  const COLUNAS = 11;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <caption className="sr-only">Pessoas físicas que receberam pagamento em {ano}</caption>
        <thead>
          <tr className="border-b border-slate-100">
            <th scope="col" className={th}>{podeAlterar ? "Inform." : "Situação"}</th>
            <th scope="col" className={th}>Nome</th>
            <th scope="col" className={th}>CPF</th>
            <th scope="col" className={th}>Natureza</th>
            <th scope="col" className={`${th} text-right`}>OPs</th>
            <th scope="col" className={`${th} text-right`}>Bruto</th>
            <th scope="col" className={`${th} text-right`}>IRRF</th>
            <th scope="col" className={`${th} text-right`}>INSS</th>
            <th scope="col" className={`${th} text-right`}>ISS</th>
            <th scope="col" className={`${th} text-right`}>Líquido</th>
            <th scope="col" className={th}><span className="sr-only">Detalhes</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {pessoas.map((p) => {
            const aberto = abertos.has(p.cpf);
            const idPainel = `ir-detalhe-${p.cpf}`;
            return (
              <Fragment key={p.cpf}>
                <tr className={p.informado ? "bg-emerald-50/40" : "hover:bg-slate-50"}>
                  <td className={td}>
                    {podeAlterar ? (
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-emerald-600"
                        aria-label={`Marcar ${p.nome} como informado no IR de ${ano}`}
                        checked={!!p.informado}
                        disabled={pendentes.has(p.cpf)}
                        onChange={() => onAlternar(p)}
                      />
                    ) : (
                      <BadgeInformadoIr informado={!!p.informado} />
                    )}
                  </td>
                  <td className={`${td} font-bold text-slate-800`}>{p.nome || "-"}</td>
                  <td className={`${td} text-slate-500 whitespace-nowrap`}>{p.cpfFormatado}</td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-1">
                      {p.naturezas.map((n) => (
                        <span
                          key={n.codigo ?? n.descricao}
                          title={n.descricao}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-bold text-slate-600"
                        >
                          {n.codigo ?? n.descricao}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className={`${td} text-right`}>{p.qtdOps}</td>
                  <td className={`${td} text-right font-black`}>{brl(p.bruto)}</td>
                  <td className={`${td} text-right`}>{brl(p.irrf)}</td>
                  <td className={`${td} text-right`}>{brl(p.inss)}</td>
                  <td className={`${td} text-right`}>{brl(p.iss)}</td>
                  <td className={`${td} text-right`}>{brl(p.liquido)}</td>
                  <td className={`${td} text-right`}>
                    <button
                      type="button"
                      aria-expanded={aberto}
                      aria-controls={idPainel}
                      aria-label={`${aberto ? "Fechar" : "Abrir"} detalhes de ${p.nome}`}
                      onClick={() => onAbrir(p)}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-900"
                    >
                      <ChevronRight className={`w-4 h-4 transition-transform ${aberto ? "rotate-90" : ""}`} />
                    </button>
                  </td>
                </tr>
                {aberto && (
                  <tr id={idPainel}>
                    <td colSpan={COLUNAS} className="px-2 pb-4">
                      <IrDetalhe
                        key={p.informado?.observacao ?? ""}
                        pessoa={p}
                        ano={ano}
                        ops={detalhes.get(`${ano}:${p.cpf}`)}
                        podeAlterar={podeAlterar}
                        salvando={salvandoObservacao.has(p.cpf)}
                        onSalvarObservacao={(obs) => onSalvarObservacao(p, obs)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-200" data-testid="ir-rodape">
            <td colSpan={4} className={`${td} text-xs font-black uppercase tracking-widest text-slate-500`} aria-live="polite">
              Mostrando {pessoas.length} de {totalDoAno} pessoa(s)
            </td>
            <td className={`${td} text-right font-bold`}>{soma.qtdOps}</td>
            <td className={`${td} text-right font-black`}>{brl(soma.bruto)}</td>
            <td className={`${td} text-right font-bold`}>{brl(soma.irrf)}</td>
            <td className={`${td} text-right font-bold`}>{brl(soma.inss)}</td>
            <td className={`${td} text-right font-bold`}>{brl(soma.iss)}</td>
            <td className={`${td} text-right font-bold`}>{brl(soma.liquido)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
