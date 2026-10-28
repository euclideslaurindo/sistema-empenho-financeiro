"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Palco } from "@/components/analises/apresentacao/Palco";
import { SLIDES } from "@/components/analises/apresentacao/Slides";
import { TOTAL_SLIDES, slideDoHash } from "@/components/analises/apresentacao/navegacao";
import { filtrosDaUrl, montarUrlAnalises } from "@/components/analises/tela/url";
import type { RespostaAnalises } from "@/components/analises/tela/tipos";

type Identificacao = { orgao: string; setor: string };
type Estado = { tipo: "carregando" } | { tipo: "erro"; mensagem: string } | { tipo: "pronto"; dados: RespostaAnalises; identificacao: Identificacao };

function Apresentacao() {
  const sp = useSearchParams();
  const router = useRouter();
  const url = montarUrlAnalises(filtrosDaUrl(sp));
  const consulta = url ? url.slice(url.indexOf("?")) : "";
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const [versao, setVersao] = useState(0);
  // #2 no endereço abre no slide 2 (retomar depois de recarregar).
  const [slide, setSlide] = useState(() => (typeof window === "undefined" ? 1 : slideDoHash(window.location.hash)));

  useEffect(() => {
    if (!url) return;
    let cancelado = false;
    Promise.all([
      apiClient.get<RespostaAnalises>(url),
      apiClient.get<Identificacao>("/api/configuracoes/identificacao").catch(() => ({ orgao: "", setor: "" })),
    ])
      .then(([dados, id]) => !cancelado && setEstado({ tipo: "pronto", dados, identificacao: { orgao: id?.orgao ?? "", setor: id?.setor ?? "" } }))
      .catch((e: any) => !cancelado && setEstado({ tipo: "erro", mensagem: e?.message || "Erro desconhecido." }));
    return () => {
      cancelado = true;
    };
  }, [url, versao]);

  // O slide atual fica no endereço sem encher o histórico.
  useEffect(() => {
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}#${slide}`);
  }, [slide]);

  const sair = () => router.push(`/analises${consulta}`);

  if (!url || estado.tipo !== "pronto") {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-[#10204d] px-6 text-center text-white">
        {!url ? (
          <p role="alert" className="m-0 text-lg">O intervalo de datas deste endereço não é válido.</p>
        ) : estado.tipo === "carregando" ? (
          <p aria-busy="true" className="m-0 text-lg text-[#c7d2ea]">Preparando a apresentação…</p>
        ) : (
          <>
            <p role="alert" className="m-0 text-lg font-semibold">Não foi possível preparar a apresentação.</p>
            <p className="m-0 text-sm text-[#c7d2ea]">{estado.tipo === "erro" ? estado.mensagem : ""}</p>
          </>
        )}
        <div className="flex gap-3">
          {url && estado.tipo === "erro" && (
            <button
              type="button"
              onClick={() => {
                setEstado({ tipo: "carregando" });
                setVersao((v) => v + 1);
              }}
              className="h-10 rounded-lg bg-white px-4 text-sm font-semibold text-[#10204d]"
            >
              Tentar de novo
            </button>
          )}
          <button type="button" onClick={sair} className="h-10 rounded-lg border border-white/40 px-4 text-sm font-semibold text-white">
            Sair
          </button>
        </div>
      </div>
    );
  }

  const atual = SLIDES[slide - 1];
  const Componente = atual.Componente;
  return (
    <Palco slide={slide} total={TOTAL_SLIDES} titulo={atual.titulo} fundo={atual.fundo} onMudar={setSlide} onSair={sair}>
      <Componente dados={estado.dados} identificacao={estado.identificacao} />
    </Palco>
  );
}

// useSearchParams fora de <Suspense> trava a página no build (Next 16).
export default function ApresentacaoPage() {
  return (
    <Suspense fallback={null}>
      <Apresentacao />
    </Suspense>
  );
}
