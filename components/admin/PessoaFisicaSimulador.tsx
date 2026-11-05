"use client";
import { useMemo, useState } from "react";
import { calcularRetencoes } from "@/lib/retencoes";
import type { ParametrosPessoaFisica } from "@/lib/irrf-pessoa-fisica";
import type { ConfigRetencaoCampoMapeado } from "@/lib/services/config-retencoes.service";
import { formatarBRL, toCents } from "@/lib/money";
import { formatarData, vigenciaNaData, type ListaIrrf, type ListaParametros } from "@/components/admin/transporte-tipos";

export const ELEMENTO_PF = "3.3.90.36";

interface Props {
  parametros: ListaParametros;
  irrf: ListaIrrf;
  config: ConfigRetencaoCampoMapeado[];
  /** Regras do elemento (matriz salva): quais impostos o 3.3.90.36 aplica. */
  regras: Record<string, string[]>;
}

const num = (v: unknown) => Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** B8: mesmo motor da OP de 3.3.90.36 (sem subelemento), com os valores salvos. */
export default function PessoaFisicaSimulador({ parametros, irrf, config, regras }: Props) {
  const [brutoTexto, setBrutoTexto] = useState("");
  const [data, setData] = useState(parametros.hoje);

  const simulacao = useMemo(() => {
    const brutoCents = toCents(brutoTexto);
    if (!brutoCents || !data) return null;
    const vParam = vigenciaNaData(parametros.vigencias, data);
    const vIrrf = vigenciaNaData(irrf.vigencias, data);
    if (!vParam || !vIrrf) return { erro: `Não há parâmetros ou tabela do IRRF vigentes em ${formatarData(data)}.` };
    try {
      const r = calcularRetencoes({
        brutoCents,
        elementoCodigo: ELEMENTO_PF,
        config,
        regras,
        informados: {},
        perfil: "ADMIN",
        pessoaFisica: {
          parametros: vParam.parametros as unknown as ParametrosPessoaFisica,
          faixas: vIrrf.faixas,
          vigencia: vParam.vigenteDe,
          vigenciaIrrf: vIrrf.vigenteDe,
        },
      });
      return { r, vParam: vParam.vigenteDe, vIrrf: vIrrf.vigenteDe };
    } catch (e: any) {
      return { erro: e?.error || e?.message || "Não foi possível simular." };
    }
  }, [brutoTexto, data, parametros, irrf, config, regras]);

  const linhas = (() => {
    if (!simulacao || !("r" in simulacao) || !simulacao.r) return [];
    const { snapshot: s, itens } = simulacao.r;
    const aplica = (campo: string) => !!s.campos?.[campo]?.aplica && !!s.campos?.[campo]?.ativo;
    const out: Array<[string, string]> = [["INSS", formatarBRL(itens.inss ?? 0)]];
    if (aplica("irrf") && s.base_irrf !== undefined) {
      out.push(
        ["Dedução do IR (maior entre INSS e desconto simplificado)", num(s.deducao_irrf)],
        ["Base de cálculo do IRRF", num(s.base_irrf)],
        ["IRRF pela tabela", num(s.irrf_tabela)],
        ["Redutor", num(s.redutor)]
      );
    }
    out.push([s.isento_irrf ? "IRRF (isento)" : "IRRF", formatarBRL(itens.irrf ?? 0)]);
    for (const campo of ["iss", "sest_senat", "patronal"]) {
      const c = s.campos?.[campo];
      if (!c) continue;
      out.push([campo === "patronal" ? `${c.rotulo} (informativa, fora do total)` : c.rotulo, formatarBRL(itens[campo] ?? 0)]);
    }
    return out;
  })();

  return (
    <section className="bg-white border border-slate-200 p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
      <div className="flex items-center mb-6 pb-4 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-800">Simulador da pessoa física</h2>
      </div>
      <p className="text-xs text-slate-500 mb-6">
        Usa os valores <strong>salvos</strong> e o mesmo cálculo da OP de {ELEMENTO_PF} (sem subelemento). Salve as alterações acima
        para vê-las aqui.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label htmlFor="simpf-bruto" className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
            Valor bruto
          </label>
          <input
            id="simpf-bruto"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={brutoTexto}
            onChange={(e) => setBrutoTexto(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold"
          />
        </div>
        <div>
          <label htmlFor="simpf-data" className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
            Data do pagamento
          </label>
          <input
            id="simpf-data"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold"
          />
        </div>
      </div>

      {simulacao && "erro" in simulacao && <p role="alert" className="text-sm font-bold text-red-700">{simulacao.erro}</p>}

      {simulacao && "r" in simulacao && simulacao.r && (
        <div className="border-t border-slate-100 pt-6" data-testid="ficha-pf">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-2 text-sm">
            {linhas.map(([rotulo, valor]) => (
              <div key={rotulo} className="flex justify-between gap-4 border-b border-slate-50 py-1">
                <dt className="text-slate-600">{rotulo}</dt>
                <dd className="font-bold text-slate-800" data-rotulo={rotulo}>
                  {valor}
                </dd>
              </div>
            ))}
          </dl>
          {simulacao.r.avisos.length > 0 && (
            <ul className="mt-4 text-xs text-amber-700 list-disc pl-5">
              {simulacao.r.avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap justify-end gap-8 pt-4 mt-4 border-t border-slate-100">
            <div className="text-right">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Total de descontos</p>
              <p className="text-lg font-bold text-slate-600" data-testid="simpf-total">
                - {formatarBRL(simulacao.r.totalDescontosCents)}
              </p>
            </div>
            <div className="text-right pl-8 border-l border-slate-100">
              <p className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-1">Valor líquido</p>
              <p className="text-2xl font-black text-emerald-600" data-testid="simpf-liquido">
                {formatarBRL(simulacao.r.liquidoCents)}
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Parâmetros de {formatarData(simulacao.vParam)} · tabela do IRRF de {formatarData(simulacao.vIrrf)}
          </p>
        </div>
      )}
    </section>
  );
}
