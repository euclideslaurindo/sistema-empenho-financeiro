"use client";
import { useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { simularRetencoes, CAMPOS_TRIBUTARIOS } from "@/lib/retencoes-simulador";
import { formatarBRL, toCents } from "@/lib/money";
import { parseFormNumber } from "@/lib/utils";
import { regraDaOp } from "@/lib/retencoes";
import { perfilDoElemento } from "@/lib/perfis-calculo";
import type { ElementoOption } from "@/hooks/use-elementos";

const ROTULOS: Record<string, string> = {
  irrf: "IRRF",
  iss: "ISS",
  inss: "INSS",
  patronal: "Patronal (informativa, fora do total)",
  sest_senat: "SEST/SENAT",
};

export default function RetencoesSimulador({
  elementosApi = [],
  regrasSubelemento = {},
}: {
  /** B7a: para listar os subelementos do elemento escolhido. */
  elementosApi?: ElementoOption[];
  /** B7a: regras próprias salvas; o subelemento com regra própria troca a do elemento. */
  regrasSubelemento?: Record<string, string[]>;
} = {}) {
  const { control } = useFormContext<any>();
  const camposWatch = useWatch({ control, name: "campos" });
  const elementosWatch = useWatch({ control, name: "elementos" });

  const [elementoCodigo, setElementoCodigo] = useState("");
  const [subelementoCodigo, setSubelementoCodigo] = useState("");
  const [brutoTexto, setBrutoTexto] = useState("");
  const [taxaBancariaTexto, setTaxaBancariaTexto] = useState("");
  const [taxaPixTexto, setTaxaPixTexto] = useState("");

  const elementos = elementosWatch || [];
  const elementoSelecionado = elementos.find((e: any) => e.codigo === elementoCodigo);
  const subelementos = elementosApi.find((e) => e.codigo === elementoCodigo)?.subelementos ?? [];
  const regrasElemento = useMemo(() => {
    if (!elementoSelecionado) return [];
    const doElemento = CAMPOS_TRIBUTARIOS.filter((c) => elementoSelecionado.campos?.[c]);
    // Mesma escolha do cálculo da OP (lib/retencoes.ts).
    return regraDaOp(elementoCodigo, subelementoCodigo || null, { [elementoCodigo]: doElemento }, regrasSubelemento).campos ?? [];
  }, [elementoSelecionado, elementoCodigo, subelementoCodigo, regrasSubelemento]);
  const regraPropria = !!subelementoCodigo && regrasSubelemento[subelementoCodigo] !== undefined;

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

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div>
          <label htmlFor="sim-elemento" className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
            Elemento
          </label>
          <select
            id="sim-elemento"
            value={elementoCodigo}
            onChange={(e) => {
              setElementoCodigo(e.target.value);
              setSubelementoCodigo("");
            }}
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
          <label htmlFor="sim-subelemento" className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
            Subelemento
          </label>
          <select
            id="sim-subelemento"
            value={subelementoCodigo}
            onChange={(e) => setSubelementoCodigo(e.target.value)}
            disabled={subelementos.length === 0}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold disabled:opacity-50"
          >
            <option value="">Nenhum (regra do elemento)</option>
            {subelementos.map((s) => (
              <option key={s.codigo} value={s.codigo}>
                {s.codigo} — {s.descricao}
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
          {perfilDoElemento(elementoCodigo) === "PESSOA_FISICA" && (
            <p role="note" className="mb-4 text-xs font-bold text-amber-700">
              No {elementoCodigo}, o IRRF é pela tabela progressiva e o INSS tem teto: o IRRF e o INSS abaixo são só o
              percentual. Use o simulador da aba Pessoa Física (3.3.90.36).
            </p>
          )}
          {perfilDoElemento(elementoCodigo) === "TRANSPORTE_AUTONOMO" && (
            <p role="note" className="mb-4 text-xs font-bold text-amber-700">
              O {elementoCodigo} tem cálculo próprio: use o simulador da aba Transporte (3.3.90.33).
            </p>
          )}
          {regraPropria && (
            <p role="status" className="mb-4 text-xs font-bold text-emerald-700">
              Regra própria do subelemento {subelementoCodigo} (salva).
            </p>
          )}
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
