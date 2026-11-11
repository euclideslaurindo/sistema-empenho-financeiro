"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Printer, Save } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAppStore } from "@/lib/store";
import { formatarBRL, toCents } from "@/lib/money";
import { maskCurrency } from "@/lib/utils";
import { MOTIVOS_PADRAO, validarJustificativa, valorPorExtenso, type DadosJustificativa } from "@/lib/justificativa-saldo";
import { FolhaJustificativa } from "@/components/notas-empenho/FolhaJustificativa";

interface Resposta {
  ne: { numero: string; status: string };
  saldo: { valor: number; gasto: number; restante: number };
  dados: DadosJustificativa;
  salva: null | { em: string; por: string | null; valorSaldoSalvo: number };
}

const rotulo = "block text-xs font-black text-slate-500 uppercase tracking-widest mb-1";
const campo = "w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold focus:outline-none focus:border-blue-800";

/** B13: justificativa de sobra de recurso da NE — preencher, salvar e imprimir. */
function JustificativaSaldo() {
  const numero = useSearchParams().get("ne")?.trim() || "";
  const perfil = useAppStore((s) => s.userProfile?.perfil) as string | undefined;
  const podeSalvar = perfil === "ADMIN" || perfil === "GESTOR";
  const [resp, setResp] = useState<Resposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<DadosJustificativa | null>(null);
  // Texto de cada motivo (editável) e quais estão marcados.
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [marcados, setMarcados] = useState<Record<string, boolean>>({});
  const [atualizadoTexto, setAtualizadoTexto] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!numero) return;
    let cancelado = false;
    apiClient
      .get<Resposta>(`/api/notas-empenho/justificativa?ne=${encodeURIComponent(numero)}`)
      .then((r) => {
        if (cancelado) return;
        setResp(r);
        setDados(r.dados);
        const salvos = new Map(r.dados.motivos.map((m) => [m.codigo, m.texto]));
        setTextos(Object.fromEntries(MOTIVOS_PADRAO.map((m) => [m.codigo, salvos.get(m.codigo) ?? m.texto])));
        setMarcados(Object.fromEntries(MOTIVOS_PADRAO.map((m) => [m.codigo, salvos.has(m.codigo)])));
        setAtualizadoTexto(formatarBRL(toCents(r.dados.valorAtualizado)));
      })
      .catch((e: any) => !cancelado && setErro(e?.message || "Não foi possível carregar a NE."));
    return () => {
      cancelado = true;
    };
  }, [numero]);

  // O documento como vai ser impresso/salvo.
  const atual = useMemo<DadosJustificativa | null>(() => {
    if (!dados) return null;
    return {
      ...dados,
      valorAtualizado: toCents(atualizadoTexto) / 100,
      motivos: MOTIVOS_PADRAO.filter((m) => marcados[m.codigo]).map((m) => ({ codigo: m.codigo, texto: textos[m.codigo] ?? m.texto })),
    };
  }, [dados, textos, marcados, atualizadoTexto]);

  const erros = atual ? validarJustificativa(atual) : [];
  const saldoMudou = !!resp?.salva && toCents(resp.salva.valorSaldoSalvo) !== toCents(resp.saldo.restante);

  const salvar = async () => {
    if (!atual || erros.length > 0) return;
    setSalvando(true);
    try {
      await apiClient.put(`/api/notas-empenho/justificativa?ne=${encodeURIComponent(numero)}`, {
        exercicio: atual.exercicio,
        objeto: atual.objeto,
        valorAtualizado: atual.valorAtualizado,
        motivos: atual.motivos,
        outros: atual.outros,
        textoDevolucao: atual.textoDevolucao,
      });
      toast.success("Justificativa salva.");
      const r = await apiClient.get<Resposta>(`/api/notas-empenho/justificativa?ne=${encodeURIComponent(numero)}`);
      setResp(r);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar a justificativa.");
    } finally {
      setSalvando(false);
    }
  };

  if (!numero) return <p role="alert" className="p-8 text-sm font-semibold text-red-700">Informe a NE.</p>;
  if (erro) return <p role="alert" className="p-8 text-sm font-semibold text-red-700">{erro}</p>;
  if (!resp || !dados || !atual) {
    return <div aria-busy="true" aria-label="Carregando a justificativa" className="mx-auto my-8 h-[297mm] w-[210mm] max-w-full animate-pulse rounded bg-white/70" />;
  }

  const alterar = (parcial: Partial<DadosJustificativa>) => setDados((d) => (d ? { ...d, ...parcial } : d));

  return (
    <div className="flex flex-col xl:flex-row gap-6 bg-slate-200/60 px-4 py-6 print:block print:bg-white print:p-0">
      <aside className="xl:w-[420px] shrink-0 space-y-5 print:hidden">
        <Link href="/notas-empenho" className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#c8d1de] bg-white px-4 text-sm font-semibold text-blue-900 hover:bg-slate-50">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Voltar para Notas de Empenho
        </Link>

        <section className="bg-white border border-slate-200 p-5 rounded-2xl space-y-4">
          <h1 className="text-lg font-bold text-slate-800 m-0">Justificativa de sobra — NE {resp.ne.numero}</h1>
          <p className="text-sm text-slate-600 m-0">
            Valor da NE R$ {formatarBRL(toCents(resp.saldo.valor))} · pago R$ {formatarBRL(toCents(resp.saldo.gasto))} ·{" "}
            <strong>saldo R$ {formatarBRL(toCents(resp.saldo.restante))}</strong>
          </p>
          {resp.salva && (
            <p className="text-xs font-semibold text-slate-500 m-0">
              Salva em {new Date(resp.salva.em).toLocaleString("pt-BR")}
              {resp.salva.por ? ` por ${resp.salva.por}` : ""}.
            </p>
          )}
          {saldoMudou && (
            <p role="alert" className="flex items-start gap-2 text-xs font-bold text-amber-700 m-0">
              <AlertTriangle className="w-4 h-4 shrink-0" /> O saldo da NE mudou desde que a justificativa foi salva (era R${" "}
              {formatarBRL(toCents(resp.salva!.valorSaldoSalvo))}). Confira o saldo atualizado e salve de novo.
            </p>
          )}

          <div>
            <label htmlFor="just-objeto" className={rotulo}>Objeto do recurso</label>
            <textarea id="just-objeto" rows={2} value={dados.objeto} onChange={(e) => alterar({ objeto: e.target.value })} className={campo} />
          </div>

          <fieldset className="space-y-3">
            <legend className={rotulo}>Motivos (marque um ou mais)</legend>
            {MOTIVOS_PADRAO.map((m) => (
              <div key={m.codigo} className="space-y-1">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={!!marcados[m.codigo]}
                    onChange={(e) => setMarcados((x) => ({ ...x, [m.codigo]: e.target.checked }))}
                    className="rounded"
                  />
                  {m.codigo === "parcial" ? "Execução parcial" : m.codigo === "comprovacao" ? "Falta de comprovação" : "Prazo acima de 60 dias"}
                </label>
                {marcados[m.codigo] && (
                  <textarea
                    aria-label={`Texto do motivo ${m.codigo}`}
                    rows={2}
                    value={textos[m.codigo] ?? ""}
                    onChange={(e) => setTextos((x) => ({ ...x, [m.codigo]: e.target.value }))}
                    className={campo}
                  />
                )}
              </div>
            ))}
            <div>
              <label htmlFor="just-outros" className={rotulo}>Outros fatores</label>
              <textarea id="just-outros" rows={2} value={dados.outros} onChange={(e) => alterar({ outros: e.target.value })} className={campo} />
            </div>
          </fieldset>

          <div>
            <label htmlFor="just-atualizado" className={rotulo}>Saldo remanescente atualizado (R$)</label>
            <input
              id="just-atualizado"
              inputMode="decimal"
              value={atualizadoTexto}
              onChange={(e) => setAtualizadoTexto(maskCurrency(e.target.value))}
              className={campo}
            />
            <p className="text-[11px] text-slate-500 mt-1 mb-0">{valorPorExtenso(atual.valorAtualizado)}</p>
          </div>

          <div>
            <label htmlFor="just-devolucao" className={rotulo}>Texto da devolução</label>
            <textarea id="just-devolucao" rows={4} value={dados.textoDevolucao} onChange={(e) => alterar({ textoDevolucao: e.target.value })} className={campo} />
          </div>

          {erros.length > 0 && (
            <ul role="alert" className="text-xs font-bold text-red-700 pl-4 m-0">
              {erros.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            {podeSalvar && (
              <button
                type="button"
                onClick={salvar}
                disabled={salvando || erros.length > 0 || resp.ne.status === "CANCELADO"}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-900 px-4 text-sm font-semibold text-white hover:bg-blue-950 disabled:opacity-40"
              >
                <Save aria-hidden="true" className="h-4 w-4" /> {salvando ? "Salvando..." : "Salvar"}
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              disabled={erros.length > 0}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-900 hover:bg-blue-50 disabled:opacity-40"
            >
              <Printer aria-hidden="true" className="h-4 w-4" /> Imprimir / Salvar PDF
            </button>
          </div>
        </section>
      </aside>

      <div className="flex-1 overflow-x-auto">
        <FolhaJustificativa dados={atual} />
      </div>
    </div>
  );
}

export default function JustificativaSaldoPage() {
  return (
    <Suspense fallback={<div aria-busy="true" className="p-8" />}>
      <JustificativaSaldo />
    </Suspense>
  );
}
