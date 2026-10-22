"use client";
import { useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { formatCurrency, formatDateOnlyBR } from "@/lib/utils";
import { useDebouncedCallback } from "@/hooks/use-debounce";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const MOTIVO_MINIMO = 5;

/**
 * Ordens recentes. Com `onExcluir` (só ADMIN), cada linha tem "Excluir OP":
 * pede confirmação e o motivo, que vai para a auditoria; o saldo volta à NE.
 */
export default function OpRecentTable({
  ops,
  onSearch,
  onExcluir,
}: {
  ops: any[];
  onSearch: (term: string) => void;
  /** Devolve true se excluiu (fecha o diálogo). */
  onExcluir?: (op: any, motivo: string) => Promise<boolean>;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedOnSearch = useDebouncedCallback(onSearch, 400);
  const [paraExcluir, setParaExcluir] = useState<any | null>(null);
  const [motivo, setMotivo] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const motivoValido = motivo.trim().length >= MOTIVO_MINIMO;

  const handleSearch = (val: string) => {
    setSearchTerm(val);
    debouncedOnSearch(val);
  };

  const fecharExclusao = () => {
    setParaExcluir(null);
    setMotivo("");
  };

  const confirmarExclusao = async () => {
    if (!onExcluir || !paraExcluir || !motivoValido) return;
    setExcluindo(true);
    try {
      if (await onExcluir(paraExcluir, motivo.trim())) fecharExclusao();
    } finally {
      setExcluindo(false);
    }
  };

  const colunas = onExcluir ? 7 : 6;

  return (
    <div className="pb-12 mt-8">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-slate-800 text-xl tracking-tight">Ordens Recentes</h3>
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar OP..."
            aria-label="Buscar OP por número, NE, credor ou CPF/CNPJ"
            title="Número da OP, NE, credor ou CPF/CNPJ"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all w-64"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="pb-4 pl-2 text-sm font-black text-slate-500 uppercase tracking-widest">Número OP</th>
              <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">NE Ref.</th>
              <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">Favorecido</th>
              <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">Emissão</th>
              <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">Pagamento</th>
              <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest text-right">Valor (R$)</th>
              {onExcluir && <th className="pb-4 pr-2 text-sm font-black text-slate-500 uppercase tracking-widest text-right">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {ops.map((op) => (
              <tr key={op.id} className="group hover:bg-blue-50/50 transition-colors">
                <td className="py-5 font-bold text-blue-900 rounded-l-lg pl-2">
                  <span>{op.numeroEmpenho || "-"}</span>
                  {op.sub && <span className="ml-1 font-semibold text-slate-500">/{op.sub}</span>}
                </td>
                <td className="py-5 font-semibold text-slate-500">{op.numeroNe || "-"}</td>
                <td className="py-5 font-semibold text-slate-700">{op.credorNome || "-"}</td>
                <td className="py-5 font-medium text-slate-500">{formatDateOnlyBR(op.dataEmissao)}</td>
                <td className="py-5 font-medium text-slate-500">{formatDateOnlyBR(op.dataPagamento)}</td>
                <td className="py-5 font-black text-slate-800 text-right">{formatCurrency(Number(op.valorPagamento) || 0)}</td>
                {onExcluir && (
                  <td className="py-5 pr-2 text-right">
                    <button
                      type="button"
                      onClick={() => setParaExcluir(op)}
                      aria-label={`Excluir OP ${op.numeroEmpenho || ""}${op.sub ? ` /${op.sub}` : ""}`}
                      title="Excluir OP"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-md transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {ops.length === 0 && (
              <tr>
                <td colSpan={colunas} className="py-8 text-center text-slate-500">Nenhuma ordem encontrada.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!paraExcluir} onOpenChange={(aberto) => !aberto && !excluindo && fecharExclusao()}>
        <AlertDialogContent>
          <AlertDialogTitle>Excluir a OP {paraExcluir?.numeroEmpenho}{paraExcluir?.sub ? ` /${paraExcluir.sub}` : ""}?</AlertDialogTitle>
          <AlertDialogDescription>
            {paraExcluir?.credorNome} · {formatCurrency(Number(paraExcluir?.valorPagamento) || 0)}. O valor volta para o saldo da NE{" "}
            {paraExcluir?.numeroNe} e as retenções pendentes saem da DARF. OP com DARF já paga não pode ser excluída. A exclusão fica
            registrada na auditoria com o motivo.
          </AlertDialogDescription>
          <div>
            <label htmlFor="op-motivo-exclusao" className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
              Motivo da exclusão
            </label>
            <textarea
              id="op-motivo-exclusao"
              rows={3}
              maxLength={500}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: valor digitado errado"
              aria-describedby="op-motivo-exclusao-ajuda"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:border-blue-800"
            />
            <p id="op-motivo-exclusao-ajuda" className="text-xs text-slate-500 mt-1">Obrigatório, com pelo menos {MOTIVO_MINIMO} caracteres.</p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Voltar</AlertDialogCancel>
            {/* Botão comum (não AlertDialogAction): o diálogo só fecha se a exclusão der certo. */}
            <button
              type="button"
              onClick={confirmarExclusao}
              disabled={!motivoValido || excluindo}
              className="bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {excluindo ? "Excluindo..." : "Excluir OP"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
