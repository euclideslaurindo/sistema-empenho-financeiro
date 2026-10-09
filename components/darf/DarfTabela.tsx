"use client";
import Link from "next/link";
import { formatarBRL, toCents } from "@/lib/money";
import {
  competenciaBR,
  dataBR,
  detalheDaDarf,
  type Agrupamento,
  type DarfItemCredor,
  type DarfItemOp,
} from "./tipos";

const brl = (v: number | undefined) => formatarBRL(toCents(v ?? 0));

export function BadgeStatusDarf({ status }: { status: string }) {
  const paga = status === "PAGA";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-widest uppercase border ${
        paga ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-amber-100 text-amber-800 border-amber-300"
      }`}
    >
      {paga ? "Paga" : "Pendente"}
    </span>
  );
}

const th = "pb-3 px-2 text-[11px] font-black text-slate-500 uppercase tracking-widest";
const td = "py-3 px-2";

export function DarfTabela({
  agrupar,
  itens,
  carregando,
  competencia,
  podeSelecionar,
  selecionados,
  onAlternar,
  onAlternarPagina,
}: {
  agrupar: Agrupamento;
  itens: Array<DarfItemOp | DarfItemCredor>;
  carregando: boolean;
  competencia: string;
  podeSelecionar: boolean;
  selecionados: Set<string>;
  onAlternar: (id: string) => void;
  onAlternarPagina: (marcar: boolean) => void;
}) {
  const legenda = `DARFs ${competencia ? `de ${competenciaBR(competencia)}` : "de todas as competências"}${
    agrupar === "credor" ? ", agrupadas por credor" : ""
  }`;

  if (carregando) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Carregando DARFs">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (itens.length === 0) {
    return <p className="py-12 text-center text-slate-400 font-bold">Nenhuma DARF neste mês.</p>;
  }

  if (agrupar === "credor") {
    const linhas = itens as DarfItemCredor[];
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <caption className="sr-only">{legenda}</caption>
          <thead>
            <tr className="border-b border-slate-100">
              <th scope="col" className={th}>Credor</th>
              <th scope="col" className={th}>CPF/CNPJ</th>
              <th scope="col" className={th}>Município</th>
              <th scope="col" className={`${th} text-right`}>OPs</th>
              <th scope="col" className={`${th} text-right`}>Total da DARF</th>
              <th scope="col" className={`${th} text-right`}>Pendente</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {linhas.map((c) => (
              <tr key={c.credorCpfCnpj}>
                <td className={`${td} font-bold text-slate-800`}>{c.credorNome || "-"}</td>
                <td className={`${td} text-slate-500`}>{c.credorCpfCnpj}</td>
                <td className={`${td} text-slate-500`}>{c.municipio || "-"}</td>
                <td className={`${td} text-right`}>{c.qtd}</td>
                <td className={`${td} text-right font-black`}>R$ {brl(c.total)}</td>
                <td className={`${td} text-right font-bold text-amber-800`}>R$ {brl(c.totalPendente)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const linhas = itens as DarfItemOp[];
  const todosMarcados = linhas.length > 0 && linhas.every((l) => selecionados.has(l.id));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <caption className="sr-only">{legenda}</caption>
        <thead>
          <tr className="border-b border-slate-100">
            {podeSelecionar && (
              <th scope="col" className={th}>
                <input
                  type="checkbox"
                  aria-label="Selecionar todas as DARFs desta página"
                  checked={todosMarcados}
                  onChange={(e) => onAlternarPagina(e.target.checked)}
                />
              </th>
            )}
            <th scope="col" className={th}>Credor</th>
            <th scope="col" className={th}>CPF/CNPJ</th>
            <th scope="col" className={th}>Município</th>
            <th scope="col" className={th}>NE/Sub</th>
            <th scope="col" className={th}>OP</th>
            <th scope="col" className={th}>Comp.</th>
            <th scope="col" className={`${th} text-right`}>INSS</th>
            <th scope="col" className={`${th} text-right`}>Patronal</th>
            <th scope="col" className={`${th} text-right`}>SEST/SENAT</th>
            <th scope="col" className={`${th} text-right`}>Total</th>
            <th scope="col" className={`${th} text-center`}>Status</th>
            <th scope="col" className={th}>Pago em</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {linhas.map((d) => {
            const det = detalheDaDarf(d.detalhe);
            const marcado = selecionados.has(d.id);
            return (
              <tr key={d.id} className={marcado ? "bg-blue-50/60" : "hover:bg-slate-50"}>
                {podeSelecionar && (
                  <td className={td}>
                    <input
                      type="checkbox"
                      aria-label={`Selecionar DARF da OP ${d.numeroOp || d.id}`}
                      checked={marcado}
                      onChange={() => onAlternar(d.id)}
                    />
                  </td>
                )}
                <td className={`${td} font-bold text-slate-800`}>{d.credorNome || "-"}</td>
                <td className={`${td} text-slate-500`}>{d.credorCpfCnpj}</td>
                <td className={`${td} text-slate-500`}>{d.municipio || "-"}</td>
                <td className={`${td} text-slate-600`}>
                  {d.numeroNe}
                  {d.sub ? `/${d.sub}` : ""}
                </td>
                <td className={td}>
                  <Link
                    href={`/consulta-impressao?ne=${encodeURIComponent(d.numeroNe)}`}
                    className="font-bold text-blue-900 hover:underline"
                    title="Abrir impressão da OP"
                  >
                    {d.numeroOp || "-"}
                  </Link>
                </td>
                <td className={`${td} text-slate-500`}>{competenciaBR(d.competencia)}</td>
                <td className={`${td} text-right`}>{brl(det.inss)}</td>
                <td className={`${td} text-right`}>{brl(det.patronal)}</td>
                <td className={`${td} text-right`}>{brl(det.sest_senat)}</td>
                <td className={`${td} text-right font-black`}>R$ {brl(d.valorDarf)}</td>
                <td className={`${td} text-center`}>
                  <BadgeStatusDarf status={d.status} />
                </td>
                <td className={`${td} text-slate-500`}>{dataBR(d.dataPagamento)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
