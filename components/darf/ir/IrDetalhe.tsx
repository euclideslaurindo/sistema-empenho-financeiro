"use client";
import { useState } from "react";
import Link from "next/link";
import { formatarBRL, toCents } from "@/lib/money";
import { dataBR } from "../tipos";
import type { OpDaPessoaIr, PessoaFisicaIr } from "./tipos-ir";

const brl = (v: number) => formatarBRL(toCents(v));

/** "2026-10-26 14:30" → "26/10/2026 14:30". */
export const dataHoraBR = (em: string | null | undefined) => (em ? `${dataBR(em)}${em.slice(10)}` : "-");

/** Painel aberto embaixo da linha: quem marcou, a observação e as OPs do ano. */
export function IrDetalhe({
  pessoa,
  ano,
  ops,
  podeAlterar,
  salvando,
  onSalvarObservacao,
}: {
  pessoa: PessoaFisicaIr;
  ano: number;
  /** undefined = carregando. */
  ops: OpDaPessoaIr[] | "erro" | undefined;
  podeAlterar: boolean;
  salvando: boolean;
  onSalvarObservacao: (observacao: string) => void;
}) {
  const gravada = pessoa.informado?.observacao ?? "";
  const [observacao, setObservacao] = useState(gravada);
  const idObs = `ir-obs-${pessoa.cpf}`;

  return (
    <div className="space-y-4 rounded-2xl bg-slate-50 border border-slate-100 p-4">
      {pessoa.informado ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-600">
            Informado em <strong>{dataHoraBR(pessoa.informado.em)}</strong>
            {pessoa.informado.porNome ? ` por ${pessoa.informado.porNome}` : ""}.
          </p>
          {podeAlterar ? (
            <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
              <div className="flex-1">
                <label htmlFor={idObs} className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5">
                  Observação
                </label>
                <input
                  id={idObs}
                  type="text"
                  maxLength={300}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Ex.: informe enviado por e-mail"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-4 focus:ring-blue-900/10 focus:border-blue-800"
                />
              </div>
              <button
                type="button"
                disabled={salvando || observacao.trim() === gravada.trim()}
                onClick={() => onSalvarObservacao(observacao)}
                className="px-4 py-2 rounded-xl bg-blue-900 text-sm font-bold text-white hover:bg-blue-950 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {salvando ? "Salvando..." : "Salvar observação"}
              </button>
            </div>
          ) : (
            gravada && (
              <p className="text-sm text-slate-600">
                <span className="font-black text-slate-500 uppercase tracking-widest text-xs mr-2">Observação</span>
                {gravada}
              </p>
            )
          )}
        </div>
      ) : (
        <p className="text-sm font-semibold text-amber-800">Ainda não informado no IR de {ano}.</p>
      )}

      <div>
        <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">OPs de {ano}</p>
        {ops === undefined && (
          <div className="space-y-2" aria-busy="true" aria-label="Carregando as OPs">
            {[0, 1].map((i) => (
              <div key={i} className="h-8 rounded-lg bg-slate-100 animate-pulse" />
            ))}
          </div>
        )}
        {ops === "erro" && <p className="text-sm font-bold text-red-600">Não foi possível carregar as OPs.</p>}
        {Array.isArray(ops) && ops.length === 0 && <p className="text-sm text-slate-500">Nenhuma OP encontrada.</p>}
        {Array.isArray(ops) && ops.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <caption className="sr-only">OPs de {pessoa.nome} em {ano}</caption>
              <thead>
                <tr className="text-slate-500 uppercase tracking-widest">
                  <th scope="col" className="pb-2 px-2 font-black">Data</th>
                  <th scope="col" className="pb-2 px-2 font-black">OP</th>
                  <th scope="col" className="pb-2 px-2 font-black">NE/Sub</th>
                  <th scope="col" className="pb-2 px-2 font-black">Elemento</th>
                  <th scope="col" className="pb-2 px-2 font-black text-right">Bruto</th>
                  <th scope="col" className="pb-2 px-2 font-black text-right">IRRF</th>
                  <th scope="col" className="pb-2 px-2 font-black text-right">INSS</th>
                  <th scope="col" className="pb-2 px-2 font-black text-right">ISS</th>
                  <th scope="col" className="pb-2 px-2 font-black text-right">Líquido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ops.map((op) => (
                  <tr key={op.id}>
                    <td className="py-2 px-2 text-slate-600">{dataBR(op.data)}</td>
                    <td className="py-2 px-2">
                      {op.numeroNe ? (
                        <Link
                          href={`/consulta-impressao?ne=${encodeURIComponent(op.numeroNe)}&ops=${encodeURIComponent(op.id)}`}
                          className="font-bold text-blue-900 hover:underline"
                          title="Abrir impressão da OP"
                        >
                          {op.numeroOp || "-"}
                        </Link>
                      ) : (
                        op.numeroOp || "-"
                      )}
                    </td>
                    <td className="py-2 px-2 text-slate-600">
                      {op.numeroNe || "-"}
                      {op.sub ? `/${op.sub}` : ""}
                    </td>
                    <td className="py-2 px-2 text-slate-600">{op.elemento || "-"}</td>
                    <td className="py-2 px-2 text-right font-bold">{brl(op.bruto)}</td>
                    <td className="py-2 px-2 text-right">{brl(op.irrf)}</td>
                    <td className="py-2 px-2 text-right">{brl(op.inss)}</td>
                    <td className="py-2 px-2 text-right">{brl(op.iss)}</td>
                    <td className="py-2 px-2 text-right">{brl(op.liquido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
