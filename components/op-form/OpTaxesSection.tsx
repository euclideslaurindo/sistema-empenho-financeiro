"use client";
import React, { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { AlertTriangle, Calculator } from "lucide-react";
import { maskCurrency } from "@/lib/utils";
import { toCents, formatarBRL } from "@/lib/money";
import { extrairCodigoElemento } from "@/lib/elementos";
import { calcularRetencoes } from "@/lib/retencoes";
import {
  CAMPO_FORM,
  CAMPOS_RETENCAO,
  ehCampoRetencao,
  estadoCampo,
  informadosEmCentavos,
  mascararValorDigitado,
  rotuloCampo,
  somarDescontosCents,
  type CampoRetencao,
  type Perfil,
} from "@/lib/retencoes-form";
import type { ConfigRetencoes } from "@/hooks/use-retencoes-config";

const NOMES_FORM = CAMPOS_RETENCAO.map((c) => CAMPO_FORM[c]);

function mesmaLista(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

// Isolado do resto do formulário (só ele re-renderiza com os watches) e sem
// DOM. Usa o MESMO motor do servidor (lib/retencoes.ts), então o valor
// mostrado é o valor que vai ser gravado.
function AutoCalcEffect({ config, perfil }: { config: ConfigRetencoes; perfil: Perfil }) {
  const { control, setValue, getValues } = useFormContext<any>();
  const valorPagamento = useWatch({ control, name: "valorPagamento" });
  const elemento = useWatch({ control, name: "elemento" });
  const camposInformados: string[] = useWatch({ control, name: "camposInformados" }) || [];
  const valoresCampos = useWatch({ control, name: NOMES_FORM });
  const chaveValores = JSON.stringify(valoresCampos);
  const chaveInformados = camposInformados.join("|");

  useEffect(() => {
    const timer = setTimeout(() => {
      const elementoCodigo = extrairCodigoElemento(elemento);
      const configPorCampo = new Map(config.campos.map((c) => [c.campo, c]));

      // Um campo digitado que deixou de ser editável (ex.: trocou a NE e o
      // imposto não se aplica mais) volta a ser do cálculo automático.
      const informadosValidos = camposInformados.filter((campo) => {
        const cfg = configPorCampo.get(campo);
        return !!cfg && cfg.ativo && estadoCampo(cfg, elementoCodigo, config.regras, perfil).editavel;
      });

      let resultado;
      try {
        resultado = calcularRetencoes({
          brutoCents: toCents(valorPagamento),
          elementoCodigo,
          config: config.campos,
          regras: config.regras,
          informados: informadosEmCentavos(getValues(), informadosValidos),
          perfil,
        });
      } catch {
        return; // valor digitado inválido (ex.: maior que o bruto): o resumo mostra o alerta
      }

      for (const campo of CAMPOS_RETENCAO) {
        if (informadosValidos.includes(campo)) continue;
        const cents = resultado.itens[campo] ?? 0;
        const novo = cents > 0 ? maskCurrency(cents / 100) : "";
        if (getValues(CAMPO_FORM[campo]) !== novo) setValue(CAMPO_FORM[campo], novo);
      }
      if (!mesmaLista(informadosValidos, camposInformados)) {
        setValue("camposInformados", informadosValidos);
      }
    }, 350);
    return () => clearTimeout(timer);
    // chaveValores/chaveInformados representam os arrays observados (identidade muda a cada render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorPagamento, elemento, chaveInformados, chaveValores, config, perfil, setValue, getValues]);

  return null;
}

function TaxesTotalSummary() {
  const { control } = useFormContext<any>();
  const valorPagamento = useWatch({ control, name: "valorPagamento" });
  const valoresCampos: unknown[] = useWatch({ control, name: NOMES_FORM }) || [];

  const valores = Object.fromEntries(NOMES_FORM.map((nome, i) => [nome, valoresCampos[i]]));
  const brutoCents = toCents(valorPagamento);
  const descontosCents = somarDescontosCents(valores);
  const liquidoCents = brutoCents - descontosCents;
  const excedeu = descontosCents > brutoCents;

  return (
    <div className="mt-8 pt-6 border-t border-slate-100">
      {excedeu && (
        <p role="alert" className="mb-4 text-sm font-bold text-red-600 text-right">
          Total de descontos maior que o valor a pagar.
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-8">
        <div className="text-right">
          <p className="text-sm font-black text-slate-500 uppercase tracking-widest mb-1">Base de Cálculo (Bruto)</p>
          <p className="text-lg font-bold text-slate-600" data-testid="resumo-bruto">R$ {formatarBRL(brutoCents)}</p>
        </div>
        <div className="text-right pl-8 border-l border-slate-100">
          <p className="text-sm font-black text-slate-500 uppercase tracking-widest mb-1">Total de Descontos</p>
          <p className="text-lg font-bold text-slate-600" data-testid="resumo-descontos">- R$ {formatarBRL(descontosCents)}</p>
        </div>
        <div className="text-right pl-8 border-l border-slate-100">
          <p className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-1">Valor Líquido a Pagar</p>
          <p className={`text-2xl font-black ${excedeu ? "text-red-600" : "text-emerald-600"}`} data-testid="resumo-liquido">
            R$ {formatarBRL(liquidoCents)}
          </p>
        </div>
      </div>
    </div>
  );
}

function CampoRetencaoInput({
  campo,
  rotulo,
  editavel,
  obrigatorio,
  dica,
}: {
  campo: CampoRetencao;
  rotulo: string;
  editavel: boolean;
  obrigatorio: boolean;
  dica: string | null;
}) {
  const { register, setValue, getValues } = useFormContext<any>();
  const nome = CAMPO_FORM[campo];
  const inputId = `op-retencao-${campo}`;
  const dicaId = `${inputId}-dica`;

  // onChange via setValue (não via o onChange do register): o do register roda
  // depois do RHF já ter capturado o valor sem máscara, deixando o estado um
  // dígito atrasado (mesmo bug já corrigido em OpPaymentData.tsx).
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const apagando = String((e.nativeEvent as InputEvent).inputType || "").startsWith("delete");
    const mascarado = mascararValorDigitado(e.target.value, apagando);
    e.target.value = mascarado;
    setValue(nome, mascarado, { shouldDirty: true });
    const atuais: string[] = getValues("camposInformados") || [];
    const semEste = atuais.filter((c) => c !== campo);
    setValue("camposInformados", mascarado ? [...semEste, campo] : semEste);
  };

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
        {rotulo}
      </label>
      <input
        id={inputId}
        type="text"
        inputMode="numeric"
        placeholder={obrigatorio ? "Informe o valor" : "0,00"}
        disabled={!editavel}
        aria-disabled={!editavel}
        aria-describedby={dica ? dicaId : undefined}
        {...register(nome)}
        onChange={onChange}
        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-400 disabled:opacity-70 disabled:cursor-not-allowed"
      />
      {dica && (
        <p id={dicaId} className="mt-1 text-xs font-semibold text-slate-400">
          {dica}
        </p>
      )}
    </div>
  );
}

function CamposRetencao({ config, perfil }: { config: ConfigRetencoes; perfil: Perfil }) {
  const { control } = useFormContext<any>();
  const elemento = useWatch({ control, name: "elemento" });
  const elementoCodigo = extrairCodigoElemento(elemento);
  const elementoConhecido = elementoCodigo !== null && config.regras[elementoCodigo] !== undefined;

  const campos = config.campos
    .filter((c) => c.ativo && ehCampoRetencao(c.campo))
    .sort((a, b) => a.ordem - b.ordem);

  return (
    <>
      {!elemento ? (
        <p className="mb-6 text-sm font-semibold text-slate-500">Selecione a NE para calcular as retenções.</p>
      ) : !elementoConhecido ? (
        <p role="status" className="mb-6 flex items-center gap-2 text-sm font-semibold text-amber-700">
          <AlertTriangle className="w-4 h-4" /> Elemento da NE não cadastrado nas regras de retenção: nenhuma retenção é
          calculada automaticamente.
        </p>
      ) : (
        <p className="mb-6 text-sm font-semibold text-slate-500">Retenções conforme a configuração do elemento {elementoCodigo}.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {campos.map((cfg) => {
          const estado = estadoCampo(cfg, elementoCodigo, config.regras, perfil);
          return (
            <CampoRetencaoInput
              key={cfg.campo}
              campo={cfg.campo as CampoRetencao}
              rotulo={rotuloCampo(cfg)}
              editavel={estado.editavel}
              obrigatorio={estado.obrigatorio}
              dica={estado.dica}
            />
          );
        })}
      </div>

      <AutoCalcEffect config={config} perfil={perfil} />
    </>
  );
}

export default function OpTaxesSection({
  userRole,
  config,
  erroConfig,
}: {
  userRole: string;
  config: ConfigRetencoes | null;
  erroConfig: string | null;
}) {
  const perfil = userRole as Perfil;

  return (
    <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] mb-8">
      <div className="flex items-center mb-6 pb-4 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 mr-3">
          <Calculator className="w-4 h-4" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Retenções e Descontos</h2>
      </div>

      {config ? (
        <CamposRetencao config={config} perfil={perfil} />
      ) : erroConfig ? (
        <p role="alert" className="text-sm font-semibold text-red-600">
          Não foi possível carregar a configuração de retenções ({erroConfig}). O servidor calculará as retenções ao salvar.
        </p>
      ) : (
        <p className="text-sm font-semibold text-slate-500">Carregando configuração de retenções...</p>
      )}

      <TaxesTotalSummary />
    </div>
  );
}
