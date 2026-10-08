"use client";
import { useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { simularRetencoes, CAMPOS_TRIBUTARIOS } from "@/lib/retencoes-simulador";
import { formatarBRL, toCents } from "@/lib/money";
import { parseFormNumber } from "@/lib/utils";

const ROTULOS: Record<string, string> = {
  irrf: "IRRF",
  iss: "ISS",
  inss: "INSS",
  patronal: "Patronal",
  sest_senat: "SEST/SENAT",
};

export default function RetencoesSimulador() {
  const { control } = useFormContext<any>();
  const camposWatch = useWatch({ control, name: "campos" });
  const elementosWatch = useWatch({ control, name: "elementos" });

  const [elementoCodigo, setElementoCodigo] = useState("");
  const [brutoTexto, setBrutoTexto] = useState("");
  const [taxaBancariaTexto, setTaxaBancariaTexto] = useState("");
  const [taxaPixTexto, setTaxaPixTexto] = useState("");

  const elementos = elementosWatch || [];
  const elementoSelecionado = elementos.find((e: any) => e.codigo === elementoCodigo);
  const regrasElemento = useMemo(() => {
    if (!elementoSelecionado) return [];
    return CAMPOS_TRIBUTARIOS.filter((c) => elementoSelecionado.campos?.[c]);
  }, [elementoSelecionado]);

  const resultado = useMemo(() => {
    const bruto = parseFormNumber(brutoTexto);
    if (!bruto || !elementoCodigo) return null;
    return simularRetencoes({
      brutoReais: bruto,
      regrasElemento,
      camposConfig: camposWatch || [],
      taxaBancariaReais: parseFormNumber(taxaBancariaTexto),
      taxaPixReais: parseFormNumber(taxaPixTexto),
    });
  }, [brutoTexto, elementoCodigo, regrasElemento, camposWatch, taxaBancariaTexto, taxaPixTexto]);

  return (
    <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] mb-8">
      <div className="flex items-center mb-6 pb-4 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-800">Simulador</h2>
      </div>
      <p className="text-xs text-slate-500 mb-6">
        Mostra o efeito da configuração <strong>atual da tela</strong> (ainda não salva). Não é o motor de
        cálculo da OP — só uma conferência rápida pra você antes de salvar.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div>
          <label htmlFor="sim-elemento" className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
            Elemento
          </label>
          <select
            id="sim-elemento"
            value={elementoCodigo}
            onChange={(e) => setElementoCodigo(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold"
          >
            <option value="">Selecione</option>
            {elementos.map((el: any) => (
              <option key={el.codigo} value={el.codigo}>
                {el.codigo} — {el.descricao}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sim-bruto" className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
            Valor Bruto
          </label>
          <input
            id="sim-bruto"
            type="text"
            placeholder="0,00"
            value={brutoTexto}
            onChange={(e) => setBrutoTexto(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold"
          />
        </div>
        <div>
          <label htmlFor="sim-taxa-bancaria" className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
            Taxa Bancária
          </label>
          <input
            id="sim-taxa-bancaria"
            type="text"
            placeholder="0,00"
            value={taxaBancariaTexto}
            onChange={(e) => setTaxaBancariaTexto(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold"
          />
        </div>
        <div>
          <label htmlFor="sim-taxa-pix" className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
            Taxa PIX
          </label>
          <input
            id="sim-taxa-pix"
            type="text"
            placeholder="0,00"
            value={taxaPixTexto}
            onChange={(e) => setTaxaPixTexto(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold"
          />
        </div>
      </div>

      {resultado && (
        <div className="border-t border-slate-100 pt-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
            {CAMPOS_TRIBUTARIOS.map((campo) => (
              <div key={campo} className="text-center">
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{ROTULOS[campo]}</p>
                <p className="text-sm font-bold text-slate-700">{formatarBRL(resultado.itensCents[campo] || 0)}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-8 pt-4 border-t border-slate-100">
            <div className="text-right">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Total de Descontos</p>
              <p className="text-lg font-bold text-slate-600">- {formatarBRL(resultado.totalDescontosCents)}</p>
            </div>
            <div className="text-right pl-8 border-l border-slate-100">
              <p className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-1">Valor Líquido</p>
              <p className="text-2xl font-black text-emerald-600">{formatarBRL(resultado.liquidoCents)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
