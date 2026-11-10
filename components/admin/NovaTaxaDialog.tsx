"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { slugTaxaExtra } from "@/lib/retencoes";
import { parseFormNumber } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * B12: o ADMIN cria uma taxa nova (rótulo + tipo + alíquota). Percentual
 * calcula sozinha e vale nos elementos marcados na Matriz; valor digitado é
 * preenchido em cada OP. Não há exclusão — só desativar na tabela.
 */
export default function NovaTaxaDialog({ desabilitado, onCriada }: { desabilitado?: boolean; onCriada: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [rotulo, setRotulo] = useState("");
  const [tipo, setTipo] = useState<"PERCENTUAL" | "VALOR_DIGITADO">("PERCENTUAL");
  const [aliquota, setAliquota] = useState("");
  const [editavel, setEditavel] = useState(false);
  const [darf, setDarf] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const percentual = tipo === "PERCENTUAL";
  const aliquotaNum = parseFormNumber(aliquota);
  const slug = slugTaxaExtra(rotulo);
  const erro = !rotulo.trim()
    ? "Informe o rótulo."
    : !slug
      ? "O rótulo precisa ter letras ou números."
      : percentual && (!Number.isFinite(aliquotaNum) || aliquotaNum <= 0 || aliquotaNum > 100)
        ? "Alíquota entre 0 e 100."
        : null;

  const limpar = () => {
    setRotulo("");
    setTipo("PERCENTUAL");
    setAliquota("");
    setEditavel(false);
    setDarf(false);
  };

  const criar = async () => {
    if (erro) return;
    setSalvando(true);
    try {
      await apiClient.post("/api/configuracoes/retencoes/campos", {
        rotulo: rotulo.trim(),
        tipo,
        aliquota: percentual ? aliquotaNum : null,
        calculoAutomatico: percentual,
        editavelOperador: percentual ? editavel : true,
        entraDarf: percentual ? darf : false,
      });
      toast.success(`Taxa "${rotulo.trim()}" criada.${percentual ? " Marque na Matriz em quais elementos ela vale." : ""}`);
      setAberto(false);
      limpar();
      onCriada();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível criar a taxa.");
    } finally {
      setSalvando(false);
    }
  };

  const rotuloCls = "block text-xs font-black text-slate-500 uppercase tracking-widest mb-1";
  const inputCls = "w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold focus:outline-none focus:border-blue-800";

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        disabled={desabilitado}
        title={desabilitado ? "Salve ou descarte as alterações antes de criar uma taxa." : undefined}
        className="text-sm font-bold text-blue-900 border border-blue-200 hover:bg-blue-50 px-3 py-2 rounded-xl flex items-center gap-1 disabled:opacity-50"
      >
        <Plus className="w-4 h-4" /> Nova taxa
      </button>
      <AlertDialog open={aberto} onOpenChange={(a) => !a && !salvando && setAberto(false)}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogTitle>Nova taxa</AlertDialogTitle>
          <AlertDialogDescription>
            Vale para as OPs novas. Depois de criada não pode ser excluída — só desativada.
          </AlertDialogDescription>
          <div className="space-y-4">
            <div>
              <label htmlFor="nova-taxa-rotulo" className={rotuloCls}>Rótulo</label>
              <input id="nova-taxa-rotulo" value={rotulo} maxLength={60} onChange={(e) => setRotulo(e.target.value)} className={inputCls} />
              {slug && <p className="text-[11px] text-slate-500 mt-1">Código: {slug}</p>}
            </div>
            <div>
              <label htmlFor="nova-taxa-tipo" className={rotuloCls}>Tipo</label>
              <select id="nova-taxa-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as any)} className={inputCls}>
                <option value="PERCENTUAL">Percentual (calcula sozinha)</option>
                <option value="VALOR_DIGITADO">Valor digitado na OP</option>
              </select>
            </div>
            {percentual && (
              <>
                <div>
                  <label htmlFor="nova-taxa-aliquota" className={rotuloCls}>Alíquota (%)</label>
                  <input
                    id="nova-taxa-aliquota"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={aliquota}
                    onChange={(e) => setAliquota(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <input type="checkbox" checked={editavel} onChange={(e) => setEditavel(e.target.checked)} className="rounded" />
                  Editável pelo operador
                </label>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <input type="checkbox" checked={darf} onChange={(e) => setDarf(e.target.checked)} className="rounded" />
                  Entra na DARF
                </label>
              </>
            )}
            {erro && rotulo && <p role="alert" className="text-xs font-bold text-red-700">{erro}</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={salvando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                criar();
              }}
              disabled={!!erro || salvando}
              className="bg-blue-900 hover:bg-blue-800"
            >
              {salvando ? "Criando..." : "Criar taxa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
