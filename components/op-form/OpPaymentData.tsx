"use client";
import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Search, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiClient } from "@/lib/api-client";
import { useListboxKeyboardNav } from "@/hooks/use-listbox-keyboard-nav";
import { useDebouncedCallback } from "@/hooks/use-debounce";
import { CamposElementoSubelemento } from "@/components/op-form/CamposElementoSubelemento";
import { FaixaSaldoEmissao } from "@/components/op-form/FaixaSaldoEmissao";
import type { SaldoNe } from "@/hooks/use-saldo-ne";

const CAMPO_LEITURA =
  "w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed transition-all duration-300";

/**
 * Dados da emissão (T35-B): a pesquisa da NE fica no lugar do antigo "Número
 * da OP" (o número agora é por credor). Unidade, gestão, elemento e
 * subelemento vêm da NE, somente leitura — é o que o servidor grava na OP.
 * Trocar de NE com credores na lista pede confirmação e limpa a lista.
 */
export default function OpPaymentData({
  errors,
  saldo,
  erroSaldo,
  onTrocarNe,
}: {
  errors: any;
  saldo: SaldoNe | null;
  erroSaldo?: string | null;
  onTrocarNe: () => void;
}) {
  const { register, setValue, getValues, control } = useFormContext<any>();
  const credores: unknown[] = useWatch({ control, name: "credores" }) || [];
  const [neSuggestions, setNeSuggestions] = useState<any[]>([]);
  const [showNeSuggestions, setShowNeSuggestions] = useState(false);
  const [nePendente, setNePendente] = useState<any | null>(null);

  const aplicarNe = (ne: any) => {
    setValue("empenho", ne.numero);
    setValue("neCarregada", ne.numero);
    setValue("historicoNe", ne.historico || "");
    setValue("unidadeOrcamentaria", ne.unidadeOrcamentaria || "");
    setValue("gestao", ne.gestao || "");
    setValue("elemento", ne.elemento || "");
    setValue("subelemento", ne.subelemento || "");
    toast.success(`Dados da NE ${ne.numero} carregados.`);
  };

  const loadNe = async (overrideNumero?: string) => {
    const raw = overrideNumero || getValues("empenho");
    const numero = raw != null ? String(raw).trim() : "";
    if (!numero) {
      toast.error("Digite o número da NE para buscar.");
      return;
    }
    try {
      const apiData = await apiClient.get(`/api/notas-empenho?numero=${encodeURIComponent(numero)}`);
      const ne = apiData?.ne;
      if (!ne) throw new Error();
      if (ne.status === "CANCELADO") {
        toast.error(`A NE ${ne.numero} está CANCELADA.`);
        return;
      }
      const atual = getValues("neCarregada");
      if (credores.length > 0 && atual && atual !== ne.numero) {
        setNePendente(ne); // confirma antes de descartar a lista
        return;
      }
      aplicarNe(ne);
    } catch {
      toast.error("NE não encontrada.");
    }
  };

  const confirmarTroca = () => {
    if (!nePendente) return;
    onTrocarNe();
    aplicarNe(nePendente);
    setNePendente(null);
  };

  const cancelarTroca = () => {
    setValue("empenho", getValues("neCarregada") || "");
    setNePendente(null);
  };

  const buscarNeSugestoes = useDebouncedCallback(async (val: string) => {
    try {
      const data = await apiClient.get(`/api/notas-empenho?busca=${encodeURIComponent(val)}&limit=10`);
      if (data && data.notas) {
        setNeSuggestions(data.notas);
        setShowNeSuggestions(true);
      }
    } catch {}
  }, 400);

  const handleNeSearchChange = (val: string) => {
    setValue("empenho", val);
    // Sem credores na lista, digitar outra NE já descarrega a anterior.
    // Com credores, a NE carregada só muda ao confirmar a troca.
    if (credores.length === 0) setValue("neCarregada", "");
    if (val.length >= 2) {
      buscarNeSugestoes(val);
    } else {
      setNeSuggestions([]);
      setShowNeSuggestions(false);
    }
  };

  const selectNe = (ne: any) => {
    setValue("empenho", ne.numero);
    setNeSuggestions([]);
    setShowNeSuggestions(false);
    loadNe(ne.numero);
  };

  const neNav = useListboxKeyboardNav(neSuggestions, selectNe);

  return (
    <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] mb-8">
      <div className="flex items-center mb-8 pb-4 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-900 mr-3">
          <Wallet className="w-4 h-4" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Dados da Emissão</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-6 relative">
          <label htmlFor="op-empenho" className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
            Nota de Empenho (NE)
          </label>
          <div className="relative flex">
            <input
              id="op-empenho"
              type="text"
              placeholder="Buscar NE (ex: 2024NE000123)"
              {...register("empenho")}
              onChange={(e) => handleNeSearchChange(e.target.value)}
              onFocus={() => {
                if (getValues("empenho")?.length >= 2) setShowNeSuggestions(true);
              }}
              onBlur={() => setTimeout(() => setShowNeSuggestions(false), 200)}
              onKeyDown={neNav.onKeyDown}
              role="combobox"
              aria-expanded={showNeSuggestions && neSuggestions.length > 0}
              aria-controls="ne-suggestions-listbox"
              aria-activedescendant={neNav.highlightedIndex >= 0 ? `ne-option-${neNav.highlightedIndex}` : undefined}
              aria-invalid={!!errors?.empenho}
              aria-describedby={errors?.empenho ? "op-empenho-error" : undefined}
              className={`w-full pl-4 pr-12 py-3 rounded-xl border bg-slate-50 focus:border-blue-800 transition-all duration-300 ${errors?.empenho ? "border-red-400 bg-red-50" : "border-slate-200"}`}
            />
            <button
              onClick={() => loadNe()}
              type="button"
              aria-label="Carregar a NE"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-500 hover:bg-blue-50 rounded-lg"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
          {errors?.empenho && (
            <p id="op-empenho-error" className="text-red-500 text-xs mt-1 font-semibold">
              {errors.empenho.message}
            </p>
          )}
          {showNeSuggestions && neSuggestions.length > 0 && (
            <div id="ne-suggestions-listbox" role="listbox" className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 max-h-60 overflow-y-auto">
              {neSuggestions.map((ne, i) => (
                <div
                  key={ne.id}
                  id={`ne-option-${i}`}
                  role="option"
                  aria-selected={neNav.highlightedIndex === i}
                  onClick={() => selectNe(ne)}
                  onMouseEnter={() => neNav.setHighlightedIndex(i)}
                  className={`p-3 cursor-pointer border-b border-slate-50 last:border-0 transition-colors ${neNav.highlightedIndex === i ? "bg-blue-50" : "hover:bg-blue-50"}`}
                >
                  <div className="font-bold text-slate-700">{ne.numero}</div>
                  <div className="text-xs text-slate-500 truncate">{ne.historico || "Sem observações"}</div>
                  <div className="text-xs font-black text-emerald-600 mt-1">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(ne.saldo?.restante ?? ne.saldoDisponivel) || 0)}{" "}
                    disponível
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="col-span-12 md:col-span-3">
          <label htmlFor="op-data-emissao" className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
            Data Emissão OP
          </label>
          <input
            id="op-data-emissao"
            type="date"
            {...register("dataEmissao")}
            aria-invalid={!!errors?.dataEmissao}
            aria-describedby={errors?.dataEmissao ? "op-data-emissao-error" : undefined}
            className={`w-full px-4 py-3 rounded-xl border bg-slate-50 focus:border-blue-800 transition-all duration-300 ${errors?.dataEmissao ? "border-red-400 bg-red-50" : "border-slate-200"}`}
          />
          {errors?.dataEmissao && (
            <p id="op-data-emissao-error" className="text-red-500 text-xs mt-1 font-semibold">
              {errors.dataEmissao.message}
            </p>
          )}
        </div>

        <div className="col-span-12 md:col-span-3">
          <label htmlFor="op-gestao" className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
            Gestão
          </label>
          <input id="op-gestao" type="text" readOnly {...register("gestao")} className={CAMPO_LEITURA} />
        </div>

        <div className="col-span-12 md:col-span-4">
          <label htmlFor="op-unidade" className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
            Unid. Orçamentária
          </label>
          <input id="op-unidade" type="text" readOnly {...register("unidadeOrcamentaria")} className={CAMPO_LEITURA} />
        </div>

        <CamposElementoSubelemento control={control} />

        <FaixaSaldoEmissao saldo={saldo} erro={erroSaldo} />
      </div>

      <AlertDialog open={!!nePendente} onOpenChange={(aberto) => !aberto && cancelarTroca()}>
        <AlertDialogContent>
          <AlertDialogTitle>Trocar de NE?</AlertDialogTitle>
          <AlertDialogDescription>
            A lista de credores será limpa: cada emissão é de uma NE só. Carregar a NE {nePendente?.numero}?
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelarTroca}>Manter a NE atual</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarTroca}>Trocar e limpar a lista</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
