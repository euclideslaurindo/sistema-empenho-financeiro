"use client";
import { useEffect, useState } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useElementos } from "@/hooks/use-elementos";
import { FiltrosAnalisesBarra } from "@/components/analises/tela/Filtros";
import { CartoesAnalises } from "@/components/analises/tela/Cartoes";
import { ResumoAnalises } from "@/components/analises/tela/Resumo";
import { GraficosAnalises } from "@/components/analises/tela/Graficos";
import { PainelDetalhe, type EstadoDetalhe } from "@/components/analises/tela/PainelDetalhe";
import { FILTROS_INICIAIS, montarUrlAnalises, montarUrlOps, recorteDoMes, validarIntervalo, type FiltrosAnalises } from "@/components/analises/tela/url";
import type { RespostaAnalises, RespostaOps } from "@/components/analises/tela/tipos";

const horaBR = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dataBR = (iso: string) => iso.split("-").reverse().join("/");

export default function AnalisesPage() {
  const [filtros, setFiltros] = useState<FiltrosAnalises>(FILTROS_INICIAIS);
  const [versao, setVersao] = useState(0);
  // A resposta guarda a URL de onde veio: trocar de filtro rápido nunca mostra o filtro anterior.
  const [resultado, setResultado] = useState<{ url: string; dados: RespostaAnalises | null; erro: string | null } | null>(null);
  const [detalheAberto, setDetalheAberto] = useState<{ url: string; titulo: string; subtitulo: string } | null>(null);
  const [detalhes, setDetalhes] = useState<Record<string, EstadoDetalhe>>({});
  const { elementos } = useElementos();

  const url = montarUrlAnalises(filtros);
  const erroIntervalo = filtros.periodo === "intervalo" ? validarIntervalo(filtros.inicio, filtros.fim) : null;

  useEffect(() => {
    if (!url) return;
    let cancelado = false;
    apiClient
      .get<RespostaAnalises>(url)
      .then((dados) => !cancelado && setResultado({ url, dados, erro: null }))
      .catch((e: any) => !cancelado && setResultado({ url, dados: null, erro: e?.message || "Erro desconhecido." }));
    return () => {
      cancelado = true;
    };
  }, [url, versao]);

  // O detalhe busca uma vez por recorte; o resultado fica guardado.
  const carregarDetalhe = (alvo: string, forcar = false) => {
    if (!forcar && detalhes[alvo] !== undefined) return;
    setDetalhes((d) => ({ ...d, [alvo]: null }));
    apiClient
      .get<RespostaOps>(alvo)
      .then((r) => setDetalhes((d) => ({ ...d, [alvo]: { dados: r } })))
      .catch((e: any) => setDetalhes((d) => ({ ...d, [alvo]: { erro: e?.message || "Não foi possível carregar as OPs." } })));
  };

  const carregando = url !== null && resultado?.url !== url;
  const dados = !carregando && resultado?.dados ? resultado.dados : null;
  const falhou = !carregando && url !== null && !!resultado?.erro;
  const anoExibido = filtros.ano ?? resultado?.dados?.periodo.ano ?? new Date().getFullYear();

  const mudarFiltros = (parcial: Partial<FiltrosAnalises>) => {
    setDetalheAberto(null);
    setFiltros((f) => {
      const novo = { ...f, ...parcial };
      // O ano que está na tela fica guardado ao trocar de período.
      if (parcial.periodo && f.ano === null) novo.ano = anoExibido;
      // Intervalo já abre com uma consulta válida: do 1º de janeiro ao fim efetivo.
      if (parcial.periodo === "intervalo" && f.periodo !== "intervalo") {
        const fimEf = resultado?.dados?.periodo.fimEfetivo;
        novo.inicio = `${anoExibido}-01-01`;
        novo.fim = fimEf && fimEf.startsWith(String(anoExibido)) ? fimEf : `${anoExibido}-12-31`;
      }
      return novo;
    });
  };

  const abrirMes = (mes: string) => {
    if (!dados) return;
    const r = recorteDoMes(mes, dados.periodo);
    const urlOps = montarUrlOps({ ...r, base: dados.base, ano: dados.periodo.ano, elemento: dados.elemento });
    const m = dados.meses.find((x) => x.mes === mes);
    setDetalheAberto({
      url: urlOps,
      titulo: `${m?.longo ?? mes}/${mes.slice(0, 4)}`,
      subtitulo: `OPs pagas de ${dataBR(r.inicio)} a ${dataBR(r.fim)} · ${dados.base === "civil" ? "ano civil" : "exercício da NE"}${dados.elemento ? ` · elemento ${dados.elemento}` : ""}`,
    });
    carregarDetalhe(urlOps);
  };

  const tentarDetalheDeNovo = () => {
    if (detalheAberto) carregarDetalhe(detalheAberto.url, true);
  };

  return (
    <div className="flex h-full flex-col bg-[#f4f6fa]">
      <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-7 p-4 sm:p-8">
        <header className="flex flex-col gap-2">
          <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-[#5b6678]">Início › Gestão Financeira › Análises</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="m-0 flex items-center gap-3 text-3xl font-semibold text-slate-900 [text-wrap:balance] md:text-4xl" style={{ fontFamily: "var(--font-titulo-analises, Georgia), Georgia, serif" }}>
              <BarChart3 aria-hidden="true" className="h-8 w-8 text-blue-900" />
              Execução financeira{dados ? ` de ${dados.periodo.rotulo}` : ""}
            </h1>
            {dados?.periodo.parcial && <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900">Período em andamento</span>}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
            <span>
              Valores em reais · base: {filtros.base === "civil" ? "ano civil (data do pagamento)" : "exercício da NE"}
              {dados ? ` · atualizado às ${horaBR(dados.atualizadoEm)}` : ""}
            </span>
            <button
              type="button"
              onClick={() => setVersao((v) => v + 1)}
              disabled={!url}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#c8d1de] bg-white px-3 text-xs font-semibold text-blue-900 hover:bg-slate-50 disabled:opacity-40"
            >
              <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" /> Atualizar
            </button>
          </div>
        </header>

        <FiltrosAnalisesBarra
          filtros={filtros}
          anoExibido={anoExibido}
          anos={resultado?.dados?.anos ?? []}
          elementos={elementos}
          erroIntervalo={erroIntervalo}
          onChange={mudarFiltros}
        />

        {carregando && (
          <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando as análises">
            <div className="h-20 animate-pulse rounded-xl bg-slate-200/70" />
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-200/70" />
              ))}
            </div>
            <div className="h-80 animate-pulse rounded-xl bg-slate-200/70" />
          </div>
        )}

        {falhou && (
          <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-[#dde3ec] bg-white py-14 text-center">
            <p className="m-0 font-semibold text-slate-700">Não foi possível carregar as análises.</p>
            <p className="m-0 text-sm text-slate-500">{resultado?.erro}</p>
            <button type="button" onClick={() => setVersao((v) => v + 1)} className="h-9 rounded-lg border border-[#c8d1de] bg-white px-4 text-sm font-semibold text-blue-900 hover:bg-slate-50">
              Tentar de novo
            </button>
          </div>
        )}

        {dados && (
          <>
            <ResumoAnalises dados={dados} />
            <CartoesAnalises dados={dados} />
            <GraficosAnalises dados={dados} onSelecionarMes={abrirMes} onSelecionarElemento={(codigo) => mudarFiltros({ elemento: codigo })} />
            <footer className="flex flex-col gap-1 border-t border-[#c8d1de] pt-4 text-xs leading-relaxed text-[#5b6678]">
              <strong className="text-slate-700">Critérios</strong>
              {dados.criterios.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </footer>
          </>
        )}
      </div>

      <PainelDetalhe
        aberto={!!detalheAberto}
        titulo={detalheAberto?.titulo ?? ""}
        subtitulo={detalheAberto?.subtitulo ?? ""}
        estado={detalheAberto ? detalhes[detalheAberto.url] ?? null : null}
        onFechar={() => setDetalheAberto(null)}
        onTentarDeNovo={tentarDetalheDeNovo}
      />
    </div>
  );
}
