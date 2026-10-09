"use client";
import { useMemo, useState } from "react";
import { calcularTransporteAutonomo, type ParametrosTransporte } from "@/lib/retencoes-transporte";
import type { ConfigRetencaoCampoMapeado } from "@/lib/services/config-retencoes.service";
import { formatarBRL, toCents } from "@/lib/money";
import { formatarData, vigenciaNaData, type IssMunicipioAdmin, type ListaIrrf, type ListaParametros } from "@/components/admin/transporte-tipos";

interface Props {
  parametros: ListaParametros;
  irrf: ListaIrrf;
  municipios: IssMunicipioAdmin[];
  config: ConfigRetencaoCampoMapeado[];
}

const SEM_CADASTRO = "__sem__";
const num = (v: unknown) => Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Ficha igual à da planilha EJA Campo, com o mesmo motor que calcula a OP. */
export default function TransporteSimulador({ parametros, irrf, municipios, config }: Props) {
  const [municipio, setMunicipio] = useState("");
  const [brutoTexto, setBrutoTexto] = useState("");
  const [data, setData] = useState(parametros.hoje);

  const ativos = useMemo(() => municipios.filter((m) => m.ativo), [municipios]);

  const simulacao = useMemo(() => {
    const brutoCents = toCents(brutoTexto);
    if (!brutoCents || !municipio || !data) return null;
    const vParam = vigenciaNaData(parametros.vigencias, data);
    const vIrrf = vigenciaNaData(irrf.vigencias, data);
    if (!vParam || !vIrrf) return { erro: `Não há parâmetros ou tabela do IRRF vigentes em ${formatarData(data)}.` };
    const m = municipio === SEM_CADASTRO ? null : ativos.find((x) => x.chave === municipio) ?? null;
    try {
      const r = calcularTransporteAutonomo({
        brutoCents,
        elementoCodigo: "3.3.90.33",
        vigencia: vParam.vigenteDe,
        vigenciaIrrf: vIrrf.vigenteDe,
        parametros: vParam.parametros as ParametrosTransporte,
        faixas: vIrrf.faixas,
        issMunicipio: m ? { nome: m.nome, aliquota: m.aliquota, taxaExpediente: m.taxaExpediente } : null,
        municipioCredor: m?.nome ?? null,
        credorMei: false,
        config,
        informados: {},
        perfil: "ADMIN",
      });
      return { r, vParam: vParam.vigenteDe, vIrrf: vIrrf.vigenteDe };
    } catch (e: any) {
      return { erro: e?.error || e?.message || "Não foi possível simular." };
    }
  }, [brutoTexto, municipio, data, parametros, irrf, ativos, config]);

  const linhas = (() => {
    if (!simulacao || !("r" in simulacao) || !simulacao.r) return [];
    const { snapshot: s, itens } = simulacao.r;
    return [
      ["Base do INSS", num(s.base_inss)],
      ["Base de cálculo do IRRF", num(s.base_irrf)],
      ["Desconto simplificado", num(s.desc_simplificado)],
      ["IRRF pela tabela", num(s.irrf_tabela)],
      ["Desconto adicional (redutor)", num(s.desc_adicional)],
      ["IRRF", formatarBRL(itens.irrf ?? 0)],
      [`ISS (${num(s.iss_aliquota)}% + expediente ${num(s.taxa_expediente)})`, formatarBRL(itens.iss ?? 0)],
      ["INSS", formatarBRL(itens.inss ?? 0)],
      ["SEST", num(s.sest)],
      ["SENAT", num(s.senat)],
      ["Patronal (informativa, fora do total)", formatarBRL(itens.patronal ?? 0)],
    ] as Array<[string, string]>;
  })();

  return (
    <section className="bg-white border border-slate-200 p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
      <div className="flex items-center mb-6 pb-4 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-800">Simulador do transporte</h2>
      </div>
      <p className="text-xs text-slate-500 mb-6">
        Usa os valores <strong>salvos</strong> e o mesmo cálculo da OP. Salve as alterações acima para vê-las aqui.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label htmlFor="simt-municipio" className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
            Município do credor
          </label>
          <select
            id="simt-municipio"
            value={municipio}
            onChange={(e) => setMunicipio(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold"
          >
            <option value="">Selecione</option>
            {ativos.map((m) => (
              <option key={m.chave} value={m.chave}>
                {m.nome}/{m.uf}
              </option>
            ))}
            <option value={SEM_CADASTRO}>Outro (sem cadastro)</option>
          </select>
        </div>
        <div>
          <label htmlFor="simt-bruto" className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
            Valor bruto
          </label>
          <input
            id="simt-bruto"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={brutoTexto}
            onChange={(e) => setBrutoTexto(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold"
          />
        </div>
        <div>
          <label htmlFor="simt-data" className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
            Data do pagamento
          </label>
          <input
            id="simt-data"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold"
          />
        </div>
      </div>

      {simulacao && "erro" in simulacao && <p role="alert" className="text-sm font-bold text-red-700">{simulacao.erro}</p>}

      {simulacao && "r" in simulacao && simulacao.r && (
        <div className="border-t border-slate-100 pt-6" data-testid="ficha-transporte">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-2 text-sm">
            {linhas.map(([rotulo, valor]) => (
              <div key={rotulo} className="flex justify-between border-b border-slate-50 py-1">
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
          <div className="flex justify-end gap-8 pt-4 mt-4 border-t border-slate-100">
            <div className="text-right">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Total de descontos</p>
              <p className="text-lg font-bold text-slate-600" data-testid="simt-total">
                - {formatarBRL(simulacao.r.totalDescontosCents)}
              </p>
            </div>
            <div className="text-right pl-8 border-l border-slate-100">
              <p className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-1">Valor líquido</p>
              <p className="text-2xl font-black text-emerald-600" data-testid="simt-liquido">
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
