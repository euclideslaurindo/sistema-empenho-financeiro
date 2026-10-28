"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Relatorio, type IdentificacaoRelatorio } from "@/components/analises/relatorio/Relatorio";
import { filtrosDaUrl, montarUrlAnalises } from "@/components/analises/tela/url";
import type { RespostaAnalises } from "@/components/analises/tela/tipos";

type Estado = { tipo: "carregando" } | { tipo: "erro"; mensagem: string } | { tipo: "pronto"; dados: RespostaAnalises; identificacao: IdentificacaoRelatorio };

function RelatorioAnalises() {
  const sp = useSearchParams();
  const filtros = filtrosDaUrl(sp);
  const url = montarUrlAnalises(filtros);
  const consulta = url ? url.slice(url.indexOf("?")) : "";
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const [versao, setVersao] = useState(0);
  const [emitidoEm] = useState(() => new Date());

  useEffect(() => {
    if (!url) return;
    let cancelado = false;
    Promise.all([
      apiClient.get<RespostaAnalises>(url),
      // Sem a identificação (ou sem a migration_19), o relatório sai com "Estado de Pernambuco".
      apiClient.get<IdentificacaoRelatorio>("/api/configuracoes/identificacao").catch(() => ({ orgao: "", setor: "" })),
    ])
      .then(([dados, identificacao]) => !cancelado && setEstado({ tipo: "pronto", dados, identificacao: { orgao: identificacao?.orgao ?? "", setor: identificacao?.setor ?? "" } }))
      .catch((e: any) => !cancelado && setEstado({ tipo: "erro", mensagem: e?.message || "Erro desconhecido." }));
    return () => {
      cancelado = true;
    };
  }, [url, versao]);

  return (
    <div className="flex flex-col gap-6 bg-slate-200/60 px-4 py-6 print:bg-white print:p-0">
      <div className="mx-auto flex w-full max-w-[210mm] flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/analises${consulta}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#c8d1de] bg-white px-4 text-sm font-semibold text-blue-900 hover:bg-slate-50">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Voltar para Análises
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={estado.tipo !== "pronto"}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-900 px-4 text-sm font-semibold text-white hover:bg-blue-950 disabled:opacity-40"
        >
          <Printer aria-hidden="true" className="h-4 w-4" /> Imprimir / Salvar PDF
        </button>
      </div>

      {!url && (
        <p role="alert" className="mx-auto m-0 text-sm font-semibold text-red-700">
          O intervalo de datas deste endereço não é válido. Volte para Análises e escolha o período de novo.
        </p>
      )}
      {url && estado.tipo === "carregando" && (
        <div aria-busy="true" aria-label="Carregando o relatório" className="mx-auto h-[297mm] w-[210mm] max-w-full animate-pulse rounded bg-white/70" />
      )}
      {url && estado.tipo === "erro" && (
        <div role="alert" className="mx-auto flex flex-col items-center gap-3 rounded-xl bg-white px-8 py-10 text-center">
          <p className="m-0 font-semibold text-slate-700">Não foi possível montar o relatório.</p>
          <p className="m-0 text-sm text-slate-500">{estado.mensagem}</p>
          <button
            type="button"
            onClick={() => {
              setEstado({ tipo: "carregando" });
              setVersao((v) => v + 1);
            }}
            className="h-9 rounded-lg border border-[#c8d1de] bg-white px-4 text-sm font-semibold text-blue-900"
          >
            Tentar de novo
          </button>
        </div>
      )}
      {url && estado.tipo === "pronto" && (
        <div className="overflow-x-auto print:overflow-visible">
          <Relatorio dados={estado.dados} identificacao={estado.identificacao} emitidoEm={emitidoEm} />
        </div>
      )}
    </div>
  );
}

// useSearchParams fora de <Suspense> trava a página no build (Next 16).
export default function RelatorioPage() {
  return (
    <Suspense fallback={null}>
      <RelatorioAnalises />
    </Suspense>
  );
}
