"use client";
import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { Calculator } from "lucide-react";
import { maskCurrency } from "@/lib/utils";

export default function OpTaxesSection({ userRole }: { userRole: string }) {
  const { register, watch, setValue } = useFormContext<any>();

  const parseFormNumber = (val: any): number => {
    if (!val && val !== 0) return 0;
    if (typeof val === 'number') return val;
    const clean = String(val).replace(/\./g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const wValorPagamento = watch("valorPagamento");
  const wAutoCalculate = watch("autoCalculate");
  const wApplied = {
    irrf: watch("appliedTax_irrf"),
    iss: watch("appliedTax_iss"),
    inss: watch("appliedTax_inss"),
    sestSenat: watch("appliedTax_sestSenat"),
    patronal: watch("appliedTax_patronal"),
  };

  const wDesc = {
    irrf: watch("irrf") || 0,
    iss: watch("iss") || 0,
    inss: watch("inss") || 0,
    sestSenat: watch("sestSenat") || 0,
    patronal: watch("patronal") || 0,
    outrosDescontos: watch("outrosDescontos") || 0
  };

  const wItens = watch("itens") || [];
  const totalItens = wItens.reduce((acc: number, item: any) => {
    return acc + (Number(item?.quantidade) || 0) * parseFormNumber(item?.valorUnitario);
  }, 0);

  useEffect(() => {
    const timer = setTimeout(() => {
      const vp = parseFormNumber(wValorPagamento);
      if (wAutoCalculate && vp > 0) {
        setValue("irrf",      wApplied.irrf      ? maskCurrency(vp * 0.015)  : "");
        setValue("iss",       wApplied.iss       ? maskCurrency(Math.round(vp * 0.05 * 100) / 100)   : "");
        setValue("inss",      wApplied.inss      ? maskCurrency(Math.round(vp * 0.11 * 100) / 100)   : "");
        setValue("sestSenat", wApplied.sestSenat ? maskCurrency(Math.round(vp * 0.025 * 100) / 100)  : "");
        setValue("patronal",  wApplied.patronal  ? maskCurrency(Math.round(vp * 0.20 * 100) / 100)   : "");
      } else {
        setValue("irrf", ""); setValue("iss", ""); setValue("inss", "");
        setValue("sestSenat", ""); setValue("patronal", "");
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [wValorPagamento, wAutoCalculate, wApplied.irrf, wApplied.iss, wApplied.inss, wApplied.sestSenat, wApplied.patronal, setValue]);

  const totalDescontos = parseFormNumber(wDesc.irrf) + parseFormNumber(wDesc.iss) + parseFormNumber(wDesc.inss) + parseFormNumber(wDesc.sestSenat) + parseFormNumber(wDesc.patronal) + parseFormNumber(wDesc.outrosDescontos);
  const valorPg = parseFormNumber(wValorPagamento);
  const baseCalculo = totalItens > 0 ? totalItens : valorPg;
  const liquidoOrdem = baseCalculo - totalDescontos;

  return (
    <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] mb-8">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 mr-3"><Calculator className="w-4 h-4" /></div>
          <h2 className="text-lg font-bold text-slate-800">Retenções e Descontos</h2>
        </div>
        <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
          <label className="flex items-center cursor-pointer">
            <input type="checkbox" disabled={userRole !== 'ADMIN'} {...register("autoCalculate")} className="mr-2 rounded text-indigo-600 focus:ring-indigo-500 disabled:opacity-50" /> Cálculo Automático
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        <div>
          <label className="flex items-center text-sm font-black text-slate-500 uppercase tracking-widest mb-2"><input type="checkbox" {...register("appliedTax_irrf")} className="mr-1.5 rounded text-blue-900 disabled:opacity-50" /> IRRF</label>
          <input type="text" placeholder="0,00" disabled={userRole !== 'ADMIN'} {...register("irrf", { onChange: (e: any) => e.target.value = maskCurrency(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-400 disabled:opacity-70 disabled:cursor-not-allowed" />
        </div>
        <div>
          <label className="flex items-center text-sm font-black text-slate-500 uppercase tracking-widest mb-2"><input type="checkbox" {...register("appliedTax_iss")} className="mr-1.5 rounded text-blue-900 disabled:opacity-50" /> ISS (5%)</label>
          <input type="text" placeholder="0,00" disabled={userRole !== 'ADMIN'} {...register("iss", { onChange: (e: any) => e.target.value = maskCurrency(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-400 disabled:opacity-70 disabled:cursor-not-allowed" />
        </div>
        <div>
          <label className="flex items-center text-sm font-black text-slate-500 uppercase tracking-widest mb-2"><input type="checkbox" {...register("appliedTax_inss")} className="mr-1.5 rounded text-blue-900 disabled:opacity-50" /> INSS</label>
          <input type="text" placeholder="0,00" disabled={userRole !== 'ADMIN'} {...register("inss", { onChange: (e: any) => e.target.value = maskCurrency(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-400 disabled:opacity-70 disabled:cursor-not-allowed" />
        </div>
        <div>
          <label className="flex items-center text-sm font-black text-slate-500 uppercase tracking-widest mb-2"><input type="checkbox" {...register("appliedTax_patronal")} className="mr-1.5 rounded text-blue-900 disabled:opacity-50" /> PATRONAL</label>
          <input type="text" placeholder="0,00" disabled={userRole !== 'ADMIN'} {...register("patronal", { onChange: (e: any) => e.target.value = maskCurrency(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-400 disabled:opacity-70 disabled:cursor-not-allowed" />
        </div>
        <div>
          <label className="flex items-center text-sm font-black text-slate-500 uppercase tracking-widest mb-2"><input type="checkbox" {...register("appliedTax_sestSenat")} className="mr-1.5 rounded text-blue-900 disabled:opacity-50" /> SEST/SENAT</label>
          <input type="text" placeholder="0,00" disabled={userRole !== 'ADMIN'} {...register("sestSenat", { onChange: (e: any) => e.target.value = maskCurrency(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-400 disabled:opacity-70 disabled:cursor-not-allowed" />
        </div>
        <div>
          <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Outros</label>
          <input type="text" placeholder="0,00" disabled={userRole !== 'ADMIN'} {...register("outrosDescontos", { onChange: (e: any) => e.target.value = maskCurrency(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-400 disabled:opacity-70 disabled:cursor-not-allowed" />
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end gap-8">
        <div className="text-right">
          <p className="text-sm font-black text-slate-500 uppercase tracking-widest mb-1">Total de Descontos</p>
          <p className="text-lg font-bold text-slate-600">- {formatCurrency(totalDescontos)}</p>
        </div>
        <div className="text-right pl-8 border-l border-slate-100">
          <p className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-1">Valor Líquido a Pagar</p>
          <p className="text-2xl font-black text-emerald-600">{formatCurrency(liquidoOrdem)}</p>
        </div>
      </div>
    </div>
  );
}
