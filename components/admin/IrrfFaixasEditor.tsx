"use client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Save, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { diffFaixas, numero, validarFaixasIrrf, type FaixaEdicao } from "@/lib/transporte-admin";
import ConfirmarDiffDialog from "@/components/admin/ConfirmarDiffDialog";
import { formatarData, motivoSoLeitura, paraCampo, type ListaIrrf } from "@/components/admin/transporte-tipos";

interface Props {
  dados: ListaIrrf;
  onSalvo: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

interface Linha {
  limiteAte: string;
  aliquota: string;
  parcelaDeduzir: string;
}

const NOVA = "__nova__";

/** A última faixa é sempre "acima de" (sem limite). */
const normalizar = (linhas: Linha[]): Linha[] => linhas.map((l, i) => (i === linhas.length - 1 ? { ...l, limiteAte: "" } : l));

/** Quem usa remonta o componente (key) quando os dados são recarregados. */
export default function IrrfFaixasEditor({ dados, onSalvo, onDirtyChange }: Props) {
  const inicial = dados.atual ?? dados.vigencias.at(-1)?.vigenteDe ?? NOVA;
  const linhasDe = (vigenteDe: string): Linha[] =>
    (dados.vigencias.find((v) => v.vigenteDe === (vigenteDe === NOVA ? (dados.atual ?? dados.vigencias.at(-1)?.vigenteDe) : vigenteDe))?.faixas ?? [])
      .slice()
      .sort((a, b) => a.ordem - b.ordem)
      .map((f) => ({ limiteAte: paraCampo(f.limiteAte), aliquota: paraCampo(f.aliquota), parcelaDeduzir: paraCampo(f.parcelaDeduzir) }));

  const [selecionada, setSelecionada] = useState(inicial);
  const [novaData, setNovaData] = useState(dados.hoje);
  const [linhas, setLinhas] = useState(() => linhasDe(inicial));
  const [original, setOriginal] = useState(linhas);
  const [diff, setDiff] = useState<string[] | null>(null);
  const [salvando, setSalvando] = useState(false);

  const abrir = (vigenteDe: string) => {
    const base = linhasDe(vigenteDe);
    if (vigenteDe === NOVA) setNovaData(dados.hoje);
    setLinhas(base);
    setOriginal(base);
    setSelecionada(vigenteDe);
  };

  const nova = selecionada === NOVA;
  const vigencia = dados.vigencias.find((v) => v.vigenteDe === selecionada);
  const editavel = nova || !!vigencia?.editavel;
  const somenteLeitura = !nova && vigencia ? motivoSoLeitura(vigencia, dados.hoje) : null;
  const erros = useMemo(() => (editavel ? validarFaixasIrrf(linhas as FaixaEdicao[]) : []), [editavel, linhas]);
  const mudancas = useMemo(() => diffFaixas(original as FaixaEdicao[], linhas as FaixaEdicao[]), [original, linhas]);
  const dirty = editavel && (nova || mudancas.length > 0);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const alterar = (i: number, campo: keyof Linha, valor: string) =>
    setLinhas((ls) => ls.map((l, j) => (j === i ? { ...l, [campo]: valor } : l)));
  const incluir = () =>
    setLinhas((ls) => normalizar([...ls.slice(0, -1), { limiteAte: "", aliquota: "", parcelaDeduzir: "" }, ...ls.slice(-1)]));
  const remover = (i: number) => setLinhas((ls) => normalizar(ls.filter((_, j) => j !== i)));

  const salvar = () => {
    if (nova) {
      if (dados.vigencias.some((v) => v.vigenteDe === novaData)) {
        toast.error("Já existe tabela com essa data. Escolha-a na lista para editar.");
        return;
      }
      setDiff([`Nova tabela do IRRF a partir de ${formatarData(novaData)}`, ...mudancas]);
      return;
    }
    if (mudancas.length === 0) {
      toast.info("Nada para salvar.");
      return;
    }
    setDiff([`Tabela de ${formatarData(selecionada)}`, ...mudancas]);
  };

  const confirmar = async () => {
    setSalvando(true);
    try {
      await apiClient.put("/api/configuracoes/irrf", {
        vigenteDe: nova ? novaData : selecionada,
        faixas: linhas.map((l, i) => ({
          limiteAte: i === linhas.length - 1 ? null : numero(l.limiteAte),
          aliquota: numero(l.aliquota),
          parcelaDeduzir: numero(l.parcelaDeduzir),
        })),
      });
      toast.success("Tabela do IRRF salva.");
      setDiff(null);
      onSalvo();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar a tabela do IRRF.");
    } finally {
      setSalvando(false);
    }
  };

  const input = "w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold disabled:opacity-60";

  return (
    <section className="bg-white border border-slate-200 p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-800">Tabela do IRRF</h2>
        <div className="flex items-center gap-2">
          <label htmlFor="irrf-vigencia" className="text-xs font-black text-slate-500 uppercase tracking-widest">
            Vigência
          </label>
          <select
            id="irrf-vigencia"
            value={selecionada}
            onChange={(e) => abrir(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold"
          >
            {dados.vigencias.map((v) => (
              <option key={v.vigenteDe} value={v.vigenteDe}>
                {formatarData(v.vigenteDe)}
                {v.vigenteDe === dados.atual ? " (atual)" : v.vigenteDe > dados.hoje ? " (futura)" : ""}
              </option>
            ))}
            {nova && <option value={NOVA}>Nova vigência</option>}
          </select>
          {!nova && (
            <button
              type="button"
              onClick={() => abrir(NOVA)}
              className="text-sm font-bold text-blue-900 border border-blue-200 hover:bg-blue-50 px-3 py-2 rounded-xl flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Nova vigência
            </button>
          )}
        </div>
      </div>

      {nova && (
        <div className="mb-6 max-w-xs">
          <label htmlFor="irrf-nova-data" className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
            Vale a partir de
          </label>
          <input
            id="irrf-nova-data"
            type="date"
            min={dados.hoje}
            value={novaData}
            onChange={(e) => setNovaData(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold"
          />
        </div>
      )}
      {somenteLeitura && <p className="mb-6 text-sm font-bold text-amber-700">{somenteLeitura}</p>}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-black text-slate-500 uppercase tracking-widest">
            <th className="py-2 pr-3 w-16">Faixa</th>
            <th className="py-2 pr-3">Base até (R$)</th>
            <th className="py-2 pr-3">Alíquota (%)</th>
            <th className="py-2 pr-3">Parcela a deduzir (R$)</th>
            {editavel && <th className="py-2 w-10" />}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => {
            const ultima = i === linhas.length - 1;
            return (
              <tr key={i} className="border-t border-slate-100">
                <td className="py-2 pr-3 font-bold text-slate-600">{i + 1}</td>
                <td className="py-2 pr-3">
                  {ultima ? (
                    <span className="text-slate-500 font-bold">acima da faixa anterior</span>
                  ) : (
                    <input
                      aria-label={`Limite da faixa ${i + 1}`}
                      inputMode="decimal"
                      value={l.limiteAte}
                      disabled={!editavel}
                      onChange={(e) => alterar(i, "limiteAte", e.target.value)}
                      className={input}
                    />
                  )}
                </td>
                <td className="py-2 pr-3">
                  <input
                    aria-label={`Alíquota da faixa ${i + 1}`}
                    inputMode="decimal"
                    value={l.aliquota}
                    disabled={!editavel}
                    onChange={(e) => alterar(i, "aliquota", e.target.value)}
                    className={input}
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    aria-label={`Parcela a deduzir da faixa ${i + 1}`}
                    inputMode="decimal"
                    value={l.parcelaDeduzir}
                    disabled={!editavel}
                    onChange={(e) => alterar(i, "parcelaDeduzir", e.target.value)}
                    className={input}
                  />
                </td>
                {editavel && (
                  <td className="py-2">
                    <button
                      type="button"
                      aria-label={`Remover faixa ${i + 1}`}
                      onClick={() => remover(i)}
                      disabled={linhas.length <= 1}
                      className="p-2 text-slate-400 hover:text-red-600 disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {erros.length > 0 && (
        <ul role="alert" className="mt-4 text-sm text-red-700 list-disc pl-5 space-y-1">
          {erros.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {editavel && (
        <div className="flex justify-between gap-2 mt-6">
          <button
            type="button"
            onClick={incluir}
            className="text-sm font-bold text-blue-900 border border-blue-200 hover:bg-blue-50 px-3 py-2 rounded-xl flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Incluir faixa
          </button>
          <div className="flex gap-2">
            {nova && (
              <button
                type="button"
                onClick={() => abrir(inicial)}
                className="text-sm font-bold text-slate-600 px-4 py-2.5 rounded-xl hover:bg-slate-100"
              >
                Descartar
              </button>
            )}
            <button
              type="button"
              onClick={salvar}
              disabled={erros.length > 0 || salvando}
              className="bg-blue-900 hover:bg-blue-800 text-white text-sm font-bold py-2.5 px-5 rounded-xl shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> Salvar tabela
            </button>
          </div>
        </div>
      )}

      <ConfirmarDiffDialog linhas={diff} salvando={salvando} onConfirmar={confirmar} onCancelar={() => setDiff(null)} />
    </section>
  );
}
