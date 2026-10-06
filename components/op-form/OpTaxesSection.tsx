"use client";
import React, { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Calculator } from "lucide-react";
import { maskCurrency, parseFormNumber, formatCurrency } from "@/lib/utils";

// Isolado do resto do formulário: só este componente re-renderiza quando
// valorPagamento/autoCalculate/appliedTax_* mudam. Retorna null (sem DOM),
// então o custo do re-render é praticamente zero.
function AutoCalcEffect() {
  const { control, setValue } = useFormContext<any>();
  const wValorPagamento = useWatch({ control, name: "valorPagamento" });
  const wAutoCalculate = useWatch({ control, name: "autoCalculate" });
  const appliedIrrf = useWatch({ control, name: "appliedTax_irrf" });
  const appliedIss = useWatch({ control, name: "appliedTax_iss" });
  const appliedInss = useWatch({ control, name: "appliedTax_inss" });
  const appliedSestSenat = useWatch({ control, name: "appliedTax_sestSenat" });
  const appliedPatronal = useWatch({ control, name: "appliedTax_patronal" });

  useEffect(() => {
    const timer = setTimeout(() => {
      const vp = parseFormNumber(wValorPagamento);
      if (wAutoCalculate && vp > 0) {
        setValue("irrf",      appliedIrrf      ? maskCurrency(vp * 0.015)  : "");
        setValue("iss",       appliedIss       ? maskCurrency(Math.round(vp * 0.05 * 100) / 100)   : "");
        setValue("inss",      appliedInss      ? maskCurrency(Math.round(vp * 0.11 * 100) / 100)   : "");
        setValue("sestSenat", appliedSestSenat ? maskCurrency(Math.round(vp * 0.025 * 100) / 100)  : "");
        setValue("patronal",  appliedPatronal  ? maskCurrency(Math.round(vp * 0.20 * 100) / 100)   : "");
      } else {
        setValue("irrf", ""); setValue("iss", ""); setValue("inss", "");
        setValue("sestSenat", ""); setValue("patronal", "");
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [wValorPagamento, wAutoCalculate, appliedIrrf, appliedIss, appliedInss, appliedSestSenat, appliedPatronal, setValue]);

  return null;
}

// Isolado do resto do formulário: só este componente re-renderiza quando os
// campos de desconto/itens/valorPagamento mudam — os inputs de imposto (que
// usam register, não watch) não são afetados.
function TaxesTotalSummary() {
  const { control } = useFormContext<any>();
  const wValorPagamento = useWatch({ control, name: "valorPagamento" });
  const wIrrf = useWatch({ control, name: "irrf" });
  const wIss = useWatch({ control, name: "iss" });
  const wInss = useWatch({ control, name: "inss" });
  const wSestSenat = useWatch({ control, name: "sestSenat" });
  const wPatronal = useWatch({ control, name: "patronal" });
  const wOutrosDescontos = useWatch({ control, name: "outrosDescontos" });
  const wItens = useWatch({ control, name: "itens" }) || [];

  const totalItens = wItens.reduce((acc: number, item: any) => {
    return acc + (Number(item?.quantidade) || 0) * parseFormNumber(item?.valorUnitario);
  }, 0);

  const totalDescontos = parseFormNumber(wIrrf) + parseFormNumber(wIss) + parseFormNumber(wInss) + parseFormNumber(wSestSenat) + parseFormNumber(wPatronal) + parseFormNumber(wOutrosDescontos);
  const valorPg = parseFormNumber(wValorPagamento);
  const baseCalculo = totalItens > 0 ? totalItens : valorPg;
  const liquidoOrdem = baseCalculo - totalDescontos;

  return (
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
  );
}

// onChange via setValue (não via mutação de e.target.value): o onChange
// passado como opção do register() roda DEPOIS do react-hook-form já ter
// capturado o valor bruto (sem máscara) do evento, deixando o estado do
// form um dígito atrasado em relação ao texto exibido (mesmo bug corrigido
// em OpPaymentData.tsx — "Valor a Pagar" aparecia certo na tela mas usava
// um valor errado no cálculo de "Saldo Restante").
function maskedTaxOnChange(setValue: any, field: string) {
  return (e: any) => {
    const masked = maskCurrency(e.target.value);
    e.target.value = masked;
    setValue(field, masked, { shouldValidate: true, shouldDirty: true });
  };
}

export default function OpTaxesSection({ userRole }: { userRole: string }) {
  const { register, setValue } = useFormContext<any>();

  return (
    <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] mb-8">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 mr-3"><Calculator className="w-4 h-4" /></div>
          <h2 className="text-lg font-bold text-slate-800">Retenções e Descontos</h2>
        </div>
        <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
          <label className="flex items-center cursor-pointer">
            <input type="checkbox" disabled={userRole !== 'ADMIN'} aria-disabled={userRole !== 'ADMIN'} {...register("autoCalculate")} className="mr-2 rounded text-indigo-600 focus:ring-indigo-500 disabled:opacity-50" /> Cálculo Automático
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        <div>
          <label className="flex items-center text-sm font-black text-slate-500 uppercase tracking-widest mb-2"><input type="checkbox" disabled={userRole !== 'ADMIN'} aria-disabled={userRole !== 'ADMIN'} {...register("appliedTax_irrf")} className="mr-1.5 rounded text-blue-900 disabled:opacity-50" /> IRRF</label>
          <input type="text" placeholder="0,00" disabled={userRole !== 'ADMIN'} aria-disabled={userRole !== 'ADMIN'} {...register("irrf")} onChange={maskedTaxOnChange(setValue, "irrf")} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-400 disabled:opacity-70 disabled:cursor-not-allowed" />
        </div>
        <div>
          <label className="flex items-center text-sm font-black text-slate-500 uppercase tracking-widest mb-2"><input type="checkbox" disabled={userRole !== 'ADMIN'} aria-disabled={userRole !== 'ADMIN'} {...register("appliedTax_iss")} className="mr-1.5 rounded text-blue-900 disabled:opacity-50" /> ISS (5%)</label>
          <input type="text" placeholder="0,00" disabled={userRole !== 'ADMIN'} aria-disabled={userRole !== 'ADMIN'} {...register("iss")} onChange={maskedTaxOnChange(setValue, "iss")} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-400 disabled:opacity-70 disabled:cursor-not-allowed" />
        </div>
        <div>
          <label className="flex items-center text-sm font-black text-slate-500 uppercase tracking-widest mb-2"><input type="checkbox" disabled={userRole !== 'ADMIN'} aria-disabled={userRole !== 'ADMIN'} {...register("appliedTax_inss")} className="mr-1.5 rounded text-blue-900 disabled:opacity-50" /> INSS</label>
          <input type="text" placeholder="0,00" disabled={userRole !== 'ADMIN'} aria-disabled={userRole !== 'ADMIN'} {...register("inss")} onChange={maskedTaxOnChange(setValue, "inss")} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-400 disabled:opacity-70 disabled:cursor-not-allowed" />
        </div>
        <div>
          <label className="flex items-center text-sm font-black text-slate-500 uppercase tracking-widest mb-2"><input type="checkbox" disabled={userRole !== 'ADMIN'} aria-disabled={userRole !== 'ADMIN'} {...register("appliedTax_patronal")} className="mr-1.5 rounded text-blue-900 disabled:opacity-50" /> PATRONAL</label>
          <input type="text" placeholder="0,00" disabled={userRole !== 'ADMIN'} aria-disabled={userRole !== 'ADMIN'} {...register("patronal")} onChange={maskedTaxOnChange(setValue, "patronal")} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-400 disabled:opacity-70 disabled:cursor-not-allowed" />
        </div>
        <div>
          <label className="flex items-center text-sm font-black text-slate-500 uppercase tracking-widest mb-2"><input type="checkbox" disabled={userRole !== 'ADMIN'} aria-disabled={userRole !== 'ADMIN'} {...register("appliedTax_sestSenat")} className="mr-1.5 rounded text-blue-900 disabled:opacity-50" /> SEST/SENAT</label>
          <input type="text" placeholder="0,00" disabled={userRole !== 'ADMIN'} aria-disabled={userRole !== 'ADMIN'} {...register("sestSenat")} onChange={maskedTaxOnChange(setValue, "sestSenat")} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-400 disabled:opacity-70 disabled:cursor-not-allowed" />
        </div>
        <div>
          <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Outros</label>
          <input type="text" placeholder="0,00" disabled={userRole !== 'ADMIN'} aria-disabled={userRole !== 'ADMIN'} {...register("outrosDescontos")} onChange={maskedTaxOnChange(setValue, "outrosDescontos")} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-400 disabled:opacity-70 disabled:cursor-not-allowed" />
        </div>
      </div>

      <AutoCalcEffect />
      <TaxesTotalSummary />
    </div>
  );
}
