"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Search } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { useDebouncedCallback } from "@/hooks/use-debounce";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { IrResumo } from "./IrResumo";
import { IrTabela } from "./IrTabela";
import { baixarCsvIr } from "./exportar-csv";
import { anosDoSeletor, filtrarPessoas, type SituacaoIr } from "./filtros-ir";
import {
  URL_IR,
  montarUrlDetalheIr,
  montarUrlIr,
  type OpDaPessoaIr,
  type PessoaFisicaIr,
  type RelatorioIrResposta,
} from "./tipos-ir";

const campo =
  "w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-900/10 focus:border-blue-800";
const rotulo = "block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5";

const SITUACOES: Array<[SituacaoIr, string]> = [
  ["todas", "Todas"],
  ["pendentes", "Pendentes"],
  ["informadas", "Informadas"],
];

const alternarNoConjunto = (s: Set<string>, chave: string, incluir: boolean) => {
  const novo = new Set(s);
  if (incluir) novo.add(chave);
  else novo.delete(chave);
  return novo;
};

/** Visão "Pessoas físicas (IR)" da aba DARF: relatório anual por CPF para a declaração. */
export function IrPessoasFisicas({ podeAlterar }: { podeAlterar: boolean }) {
  // null = o ano que o servidor escolher (o mais recente com movimento).
  const [anoEscolhido, setAnoEscolhido] = useState<number | null>(null);
  const [versao, setVersao] = useState(0);
  // A resposta guarda a URL de onde veio: trocar de ano rápido nunca mostra o ano anterior.
  const [resultado, setResultado] = useState<{ url: string; dados: RelatorioIrResposta | null } | null>(null);
  const [textoBusca, setTextoBusca] = useState("");
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<SituacaoIr>("todas");
  const [pendentes, setPendentes] = useState<Set<string>>(new Set());
  const [salvandoObs, setSalvandoObs] = useState<Set<string>>(new Set());
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [detalhes, setDetalhes] = useState<Map<string, OpDaPessoaIr[] | "erro">>(new Map());
  const [paraDesmarcar, setParaDesmarcar] = useState<PessoaFisicaIr | null>(null);
  const [exportando, setExportando] = useState(false);
  const enviando = useRef(new Set<string>());
  const buscandoDetalhe = useRef(new Set<string>());

  const aplicarBusca = useDebouncedCallback((v: string) => setBusca(v), 300);
  const url = montarUrlIr(anoEscolhido);

  useEffect(() => {
    let cancelado = false;
    apiClient
      .get<RelatorioIrResposta>(url)
      .then((dados) => !cancelado && setResultado({ url, dados }))
      .catch((e: any) => {
        if (cancelado) return;
        toast.error(e?.message || "Erro ao carregar as pessoas físicas.");
        setResultado({ url, dados: null });
      });
    return () => {
      cancelado = true;
    };
  }, [url, versao]);

  const carregando = resultado?.url !== url;
  const dados = carregando ? null : (resultado?.dados ?? null);
  const ano = dados?.ano ?? anoEscolhido;
  const visiveis = useMemo(() => filtrarPessoas(dados?.pessoas ?? [], { busca, situacao }), [dados, busca, situacao]);
  const filtrado = situacao !== "todas" || busca.trim() !== "";
  const falhou = !carregando && !dados;

  const trocarAno = (novo: number) => {
    setAnoEscolhido(novo);
    setAbertos(new Set());
    setParaDesmarcar(null);
  };

  /** Uma gravação por pessoa de cada vez; a tela só muda depois de recarregar do servidor. */
  async function enviar(p: PessoaFisicaIr, corpo: { informado: boolean; observacao?: string }, sucesso: string) {
    if (!dados || enviando.current.has(p.cpf)) return;
    enviando.current.add(p.cpf);
    const marcarAndamento = corpo.observacao !== undefined ? setSalvandoObs : setPendentes;
    marcarAndamento((s) => alternarNoConjunto(s, p.cpf, true));
    try {
      await apiClient.post(`${URL_IR}/informado`, { ano: dados.ano, cpf: p.cpf, ...corpo });
      toast.success(sucesso);
      setVersao((v) => v + 1);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar.");
    } finally {
      enviando.current.delete(p.cpf);
      marcarAndamento((s) => alternarNoConjunto(s, p.cpf, false));
    }
  }

  const alternar = (p: PessoaFisicaIr) => {
    if (p.informado) setParaDesmarcar(p);
    else void enviar(p, { informado: true }, `${p.nome} marcado(a) como informado(a) no IR de ${dados?.ano}.`);
  };

  const abrir = (p: PessoaFisicaIr) => {
    const vaiAbrir = !abertos.has(p.cpf);
    setAbertos((s) => alternarNoConjunto(s, p.cpf, vaiAbrir));
    if (!vaiAbrir || !dados) return;
    const chave = `${dados.ano}:${p.cpf}`;
    const atual = detalhes.get(chave);
    if (Array.isArray(atual) || buscandoDetalhe.current.has(chave)) return;
    buscandoDetalhe.current.add(chave);
    setDetalhes((m) => {
      const novo = new Map(m);
      novo.delete(chave); // "erro" anterior: tenta de novo
      return novo;
    });
    apiClient
      .get<{ ops: OpDaPessoaIr[] }>(montarUrlDetalheIr(dados.ano, p.cpf))
      .then((r) => setDetalhes((m) => new Map(m).set(chave, r?.ops ?? [])))
      .catch(() => setDetalhes((m) => new Map(m).set(chave, "erro")))
      .finally(() => buscandoDetalhe.current.delete(chave));
  };

  const exportar = async () => {
    if (!dados || exportando) return;
    setExportando(true);
    try {
      await baixarCsvIr(dados.ano);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível exportar a planilha.");
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-2">
            <label htmlFor="ir-ano" className={rotulo}>
              Ano
            </label>
            <select
              id="ir-ano"
              value={ano ?? ""}
              disabled={ano === null}
              onChange={(e) => trocarAno(Number(e.target.value))}
              className={campo}
            >
              {ano !== null &&
                anosDoSeletor(resultado?.dados?.anos ?? [], ano).map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
            </select>
          </div>

          <div className="md:col-span-4">
            <label htmlFor="ir-busca" className={rotulo}>
              Buscar
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="ir-busca"
                type="search"
                value={textoBusca}
                placeholder="Nome ou CPF"
                onChange={(e) => {
                  setTextoBusca(e.target.value);
                  aplicarBusca(e.target.value);
                }}
                className={`${campo} pl-10`}
              />
            </div>
          </div>

          <div className="md:col-span-3">
            <span id="ir-situacao-rotulo" className={rotulo}>
              Situação
            </span>
            <div role="radiogroup" aria-labelledby="ir-situacao-rotulo" className="flex rounded-xl border border-slate-200 bg-white p-1">
              {SITUACOES.map(([valor, texto]) => {
                const ativo = situacao === valor;
                return (
                  <button
                    key={valor}
                    type="button"
                    role="radio"
                    aria-checked={ativo}
                    onClick={() => setSituacao(valor)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-black uppercase tracking-widest ${
                      ativo ? "bg-blue-900 text-white" : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {texto}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="md:col-span-3">
            <button
              type="button"
              onClick={exportar}
              disabled={!dados || exportando}
              title="A planilha traz todas as pessoas do ano, sem os filtros da tela."
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-blue-900 text-sm font-bold text-blue-900 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              {exportando ? "Exportando..." : "Exportar CSV do ano"}
            </button>
          </div>
        </div>
      </div>

      <IrResumo totais={dados?.totais ?? null} ano={ano} />

      <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
        {falhou ? (
          // Erro não é "ninguém recebeu": diz o que houve e deixa tentar de novo.
          <div className="py-12 text-center space-y-3" role="alert">
            <p className="text-slate-500 font-bold">Não foi possível carregar o relatório.</p>
            <button
              type="button"
              onClick={() => setVersao((v) => v + 1)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Tentar de novo
            </button>
          </div>
        ) : (
          <IrTabela
            ano={ano ?? new Date().getFullYear()}
            pessoas={visiveis}
            totalDoAno={dados?.pessoas.length ?? 0}
            carregando={carregando}
            filtrado={filtrado}
            podeAlterar={podeAlterar}
            pendentes={pendentes}
            abertos={abertos}
            detalhes={detalhes}
            salvandoObservacao={salvandoObs}
            onAlternar={alternar}
            onAbrir={abrir}
            onSalvarObservacao={(p, observacao) => void enviar(p, { informado: true, observacao }, "Observação salva.")}
          />
        )}
      </div>

      <AlertDialog open={!!paraDesmarcar} onOpenChange={(abrir) => !abrir && setParaDesmarcar(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Desmarcar {paraDesmarcar?.nome}?</AlertDialogTitle>
          <AlertDialogDescription>
            A pessoa volta para pendente no IR de {dados?.ano}. A data da marcação e a observação serão apagadas.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const p = paraDesmarcar;
                setParaDesmarcar(null);
                if (p) void enviar(p, { informado: false }, `${p.nome} voltou para pendente.`);
              }}
            >
              Desmarcar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
