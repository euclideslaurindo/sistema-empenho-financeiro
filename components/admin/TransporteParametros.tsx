"use client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Save } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { CHAVES_TRANSPORTE } from "@/lib/retencoes-transporte";
import { ROTULOS_PARAMETROS, diffParametros, numero, validarParametrosTransporte } from "@/lib/transporte-admin";
import ConfirmarDiffDialog from "@/components/admin/ConfirmarDiffDialog";
import { formatarData, motivoSoLeitura, paraCampo, type ListaParametros } from "@/components/admin/transporte-tipos";

interface Props {
  dados: ListaParametros;
  onSalvo: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

const NOVA = "__nova__";
const valoresDe = (p: Record<string, string> | undefined) =>
  Object.fromEntries(CHAVES_TRANSPORTE.map((c) => [c, paraCampo(p?.[c])])) as Record<string, string>;

/** Quem usa remonta o componente (key) quando os dados são recarregados. */
export default function TransporteParametros({ dados, onSalvo, onDirtyChange }: Props) {
  const inicial = dados.atual ?? dados.vigencias.at(-1)?.vigenteDe ?? NOVA;
  const valoresDaVigencia = (vigenteDe: string) =>
    valoresDe(
      vigenteDe === NOVA
        ? (dados.vigencias.find((v) => v.vigenteDe === dados.atual) ?? dados.vigencias.at(-1))?.parametros
        : dados.vigencias.find((v) => v.vigenteDe === vigenteDe)?.parametros
    );

  const [selecionada, setSelecionada] = useState(inicial);
  const [novaData, setNovaData] = useState(dados.hoje);
  const [valores, setValores] = useState(() => valoresDaVigencia(inicial));
  const [original, setOriginal] = useState(valores);
  const [diff, setDiff] = useState<string[] | null>(null);
  const [salvando, setSalvando] = useState(false);

  const abrir = (vigenteDe: string) => {
    const v = valoresDaVigencia(vigenteDe);
    if (vigenteDe === NOVA) setNovaData(dados.hoje);
    setValores(v);
    setOriginal(v);
    setSelecionada(vigenteDe);
  };

  const nova = selecionada === NOVA;
  const vigencia = dados.vigencias.find((v) => v.vigenteDe === selecionada);
  const editavel = nova || !!vigencia?.editavel;
  const somenteLeitura = !nova && vigencia ? motivoSoLeitura(vigencia, dados.hoje) : null;
  const erros = useMemo(() => (editavel ? validarParametrosTransporte(valores) : []), [editavel, valores]);
  const mudancas = useMemo(() => diffParametros(original, valores), [original, valores]);
  const dirty = editavel && (nova || mudancas.length > 0);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const salvar = () => {
    if (nova) {
      if (dados.vigencias.some((v) => v.vigenteDe === novaData)) {
        toast.error("Já existe vigência com essa data. Escolha-a na lista para editar.");
        return;
      }
      setDiff([`Nova vigência a partir de ${formatarData(novaData)}`, ...mudancas]);
      return;
    }
    if (mudancas.length === 0) {
      toast.info("Nada para salvar.");
      return;
    }
    setDiff([`Vigência de ${formatarData(selecionada)}`, ...mudancas]);
  };

  const confirmar = async () => {
    setSalvando(true);
    try {
      await apiClient.put("/api/configuracoes/calculo-transporte", {
        vigenteDe: nova ? novaData : selecionada,
        parametros: Object.fromEntries(CHAVES_TRANSPORTE.map((c) => [c, numero(valores[c])])),
      });
      toast.success("Parâmetros do transporte salvos.");
      setDiff(null);
      onSalvo();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar os parâmetros.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="bg-white border border-slate-200 p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-800">Parâmetros do cálculo</h2>
        <div className="flex items-center gap-2">
          <label htmlFor="param-vigencia" className="text-xs font-black text-slate-500 uppercase tracking-widest">
            Vigência
          </label>
          <select
            id="param-vigencia"
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
          <label htmlFor="param-nova-data" className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
            Vale a partir de
          </label>
          <input
            id="param-nova-data"
            type="date"
            min={dados.hoje}
            value={novaData}
            onChange={(e) => setNovaData(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold"
          />
          <p className="text-xs text-slate-500 mt-1">Copiada da vigência atual. Ajuste só o que muda.</p>
        </div>
      )}
      {somenteLeitura && <p className="mb-6 text-sm font-bold text-amber-700">{somenteLeitura}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CHAVES_TRANSPORTE.map((chave) => (
          <div key={chave}>
            <label htmlFor={`param-${chave}`} className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
              {ROTULOS_PARAMETROS[chave].rotulo}
            </label>
            <input
              id={`param-${chave}`}
              type="text"
              inputMode="decimal"
              value={valores[chave] ?? ""}
              disabled={!editavel}
              onChange={(e) => setValores((v) => ({ ...v, [chave]: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold disabled:opacity-60"
            />
          </div>
        ))}
      </div>

      {erros.length > 0 && (
        <ul role="alert" className="mt-4 text-sm text-red-700 list-disc pl-5 space-y-1">
          {erros.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {editavel && (
        <div className="flex justify-end gap-2 mt-6">
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
            <Save className="w-4 h-4" /> Salvar parâmetros
          </button>
        </div>
      )}

      <ConfirmarDiffDialog linhas={diff} salvando={salvando} onConfirmar={confirmar} onCancelar={() => setDiff(null)} />
    </section>
  );
}
