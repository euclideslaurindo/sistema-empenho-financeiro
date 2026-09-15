"use client";
import { useState } from "react";
import { Search } from "lucide-react";

export default function OpRecentTable({ ops, onSearch }: { ops: any[], onSearch: (term: string) => void }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const handleSearch = (val: string) => {
    setSearchTerm(val);
    if (searchTimeout) clearTimeout(searchTimeout);
    setSearchTimeout(setTimeout(() => {
      onSearch(val);
    }, 400));
  };

  return (
    <div className="pb-12 mt-8">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-slate-800 text-xl tracking-tight">Ordens Recentes</h3>
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar OP..."
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
              <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">Data Pgto</th>
              <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest text-right">Valor (R$)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {ops.map((op) => (
              <tr key={op.id} className="group hover:bg-blue-50/50 transition-colors">
                <td className="py-5 font-bold text-blue-900 rounded-l-lg pl-2">{op.numeroEmpenho || "-"}</td>
                <td className="py-5 font-semibold text-slate-500">{op.numeroNe || "-"}</td>
                <td className="py-5 font-semibold text-slate-700">{op.credorNome || "-"}</td>
                <td className="py-5 font-medium text-slate-500">{op.dataPagamento ? new Date(op.dataPagamento).toLocaleDateString('pt-BR') : "-"}</td>
                <td className="py-5 font-black text-slate-800 text-right">{formatCurrency(Number(op.valorPagamento) || 0)}</td>
              </tr>
            ))}
            {ops.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500">Nenhuma ordem encontrada.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
