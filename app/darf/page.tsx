"use client";
import { useEffect, useMemo, useState } from "react";
import { Landmark, CheckCircle2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { toCents } from "@/lib/money";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DarfFiltros } from "@/components/darf/DarfFiltros";
import { DarfResumo } from "@/components/darf/DarfResumo";
import { DarfTabela } from "@/components/darf/DarfTabela";
import { DarfBaixaModal } from "@/components/darf/DarfBaixaModal";
import {
  mesAtual,
  montarUrlDarf,
  type DarfItemOp,
  type DarfResposta,
  type FiltrosTela,
  type StatusDarf,
} from "@/components/darf/tipos";

const LIMITE = 50;

export default function DarfPage() {
  const [filtros, setFiltros] = useState<FiltrosTela>({ competencia: mesAtual(), status: "", busca: "", agrupar: "op" });
  const [page, setPage] = useState(1);
  const [versao, setVersao] = useState(0);
  // Guarda a URL de onde veio a resposta: "carregando" = a resposta ainda não é da URL atual.
  const [resultado, setResultado] = useState<{ url: string; dados: DarfResposta | null } | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [perfil, setPerfil] = useState<string | null>(null);
  const [baixaAberta, setBaixaAberta] = useState(false);
  const [reabrirAberto, setReabrirAberto] = useState(false);

  const url = montarUrlDarf(filtros, page, LIMITE);

  useEffect(() => {
    let cancelado = false;
    apiClient
      .get<DarfResposta>(url)
      .then((dados) => !cancelado && setResultado({ url, dados }))
      .catch((e: any) => {
        if (cancelado) return;
        toast.error(e?.message || "Erro ao carregar as DARFs.");
        setResultado({ url, dados: null });
      });
    return () => {
      cancelado = true;
    };
  }, [url, versao]);

  useEffect(() => {
    apiClient
      .get<{ usuario?: { perfil?: string } }>("/api/perfil")
      .then((d) => setPerfil(d?.usuario?.perfil ?? null))
      .catch(() => setPerfil(null));
  }, []);

  const carregando = resultado?.url !== url;
  const dados = resultado?.dados ?? null;
  const podeAlterar = perfil === "ADMIN" || perfil === "GESTOR";
  const porOp = filtros.agrupar === "op";

  const itensSelecionados = useMemo(
    () => (porOp && dados ? (dados.itens as DarfItemOp[]).filter((i) => selecionados.has(i.id)) : []),
    [dados, porOp, selecionados]
  );
  const totalSelecionadoCents = itensSelecionados.reduce((t, i) => t + toCents(i.valorDarf), 0);

  const mudarFiltros = (parcial: Partial<FiltrosTela>) => {
    setFiltros((f) => ({ ...f, ...parcial }));
    setPage(1);
    setSelecionados(new Set());
  };

  const mudarPagina = (nova: number) => {
    setPage(nova);
    setSelecionados(new Set());
  };

  const alternar = (id: string) =>
    setSelecionados((s) => {
      const novo = new Set(s);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  const alternarPagina = (marcar: boolean) =>
    setSelecionados(marcar && dados ? new Set((dados.itens as DarfItemOp[]).map((i) => i.id)) : new Set());

  const enviarStatus = async (status: StatusDarf, dataPagamento?: string, observacao?: string) => {
    const ids = itensSelecionados.map((i) => i.id);
    const resposta = await apiClient.post<{ atualizadas: number }>("/api/darf/status", {
      ids,
      status,
      ...(dataPagamento ? { dataPagamento } : {}),
      ...(observacao?.trim() ? { observacao } : {}),
    });
    toast.success(
      status === "PAGA"
        ? `${resposta?.atualizadas ?? ids.length} DARF(s) marcada(s) como paga(s).`
        : `${resposta?.atualizadas ?? ids.length} DARF(s) reaberta(s).`
    );
    setSelecionados(new Set());
    setVersao((v) => v + 1);
  };

  const totalPaginas = dados?.pagination.totalPages || 1;

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="p-8 max-w-[1400px] mx-auto w-full flex-1 space-y-6 animate-fade-in">
        <div>
          <div className="flex items-center text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">
            Início &gt; Gestão Financeira &gt; <span className="text-blue-900 ml-1">DARF</span>
          </div>
          <h1 className="flex items-center gap-3 text-3xl md:text-4xl font-black text-slate-800 tracking-tight">
            <Landmark className="w-8 h-8 text-blue-900" /> Acompanhamento da DARF
          </h1>
        </div>

        <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
          <DarfFiltros filtros={filtros} onChange={mudarFiltros} />
        </div>

        <DarfResumo totais={dados?.totais ?? null} />

        <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
          {podeAlterar && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold text-slate-500" aria-live="polite">
                {porOp
                  ? `${itensSelecionados.length} selecionada(s) nesta página`
                  : "Para marcar como paga ou reabrir, volte para a visão Por OP."}
              </p>
              {porOp && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={itensSelecionados.length === 0}
                    onClick={() => setBaixaAberta(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Marcar como paga
                  </button>
                  <button
                    type="button"
                    disabled={itensSelecionados.length === 0}
                    onClick={() => setReabrirAberto(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <RotateCcw className="w-4 h-4" /> Reabrir
                  </button>
                </div>
              )}
            </div>
          )}

          <DarfTabela
            agrupar={filtros.agrupar}
            itens={dados?.itens ?? []}
            carregando={carregando}
            competencia={filtros.competencia}
            podeSelecionar={podeAlterar && porOp}
            selecionados={selecionados}
            onAlternar={alternar}
            onAlternarPagina={alternarPagina}
          />

          <div className="flex justify-between items-center mt-6">
            <span className="text-sm font-semibold text-slate-500">
              Página {page} de {totalPaginas}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => mudarPagina(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => mudarPagina(Math.min(totalPaginas, page + 1))}
                disabled={page >= totalPaginas}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      </div>

      {baixaAberta && (
        <DarfBaixaModal
          aberto
          quantidade={itensSelecionados.length}
          totalCents={totalSelecionadoCents}
          onFechar={() => setBaixaAberta(false)}
          onConfirmar={async (data, observacao) => {
            try {
              await enviarStatus("PAGA", data, observacao);
              setBaixaAberta(false);
            } catch (e: any) {
              toast.error(e?.message || "Erro ao marcar como paga.");
              throw e;
            }
          }}
        />
      )}

      <AlertDialog open={reabrirAberto} onOpenChange={setReabrirAberto}>
        <AlertDialogContent>
          <AlertDialogTitle>Reabrir DARF(s)?</AlertDialogTitle>
          <AlertDialogDescription>
            {itensSelecionados.length} DARF(s) voltarão para PENDENTE e a data de pagamento será apagada.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await enviarStatus("PENDENTE");
                } catch (e: any) {
                  toast.error(e?.message || "Erro ao reabrir.");
                }
              }}
            >
              Reabrir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
