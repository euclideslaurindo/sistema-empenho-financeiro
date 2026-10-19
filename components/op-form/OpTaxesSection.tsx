"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { AlertTriangle, Calculator, ShieldCheck } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { maskCurrency } from "@/lib/utils";
import { toCents, formatarBRL } from "@/lib/money";
import { extrairCodigoElemento } from "@/lib/elementos";
import { calcularRetencoes, CAMPOS_TRIBUTARIOS } from "@/lib/retencoes";
import { perfilDoElemento } from "@/lib/perfis-calculo";
import { apiClient } from "@/lib/api-client";
import {
  CAMPO_FORM,
  CAMPOS_RETENCAO,
  camposInformativos,
  ehCampoRetencao,
  estadoCampoOp,
  idNaLinha,
  informadosEmCentavos,
  informadosValidosDaLinha,
  mascararValorDigitado,
  nomeNaLinha,
  rotuloCampoDoElemento,
  somarDescontosCents,
  valoresCalculadosDoForm,
  type CampoRetencao,
  type Perfil,
} from "@/lib/retencoes-form";
import type { ConfigRetencoes } from "@/hooks/use-retencoes-config";

const NOMES_FORM = CAMPOS_RETENCAO.map((c) => CAMPO_FORM[c]);

// Nomes dos campos POR CREDOR (T35-A). elemento, empenho e dataEmissao são da
// emissão e ficam sempre na raiz.
function useNomesDaLinha(basePath: string) {
  return useMemo(
    () => ({
      n: (nome: string) => nomeNaLinha(basePath, nome),
      nomesForm: NOMES_FORM.map((nome) => nomeNaLinha(basePath, nome)),
    }),
    [basePath]
  );
}

function mesmaLista(a: string[], b: string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

type SetValue = (nome: string, valor: unknown) => void;
type GetValues = (nome?: string) => any;

/** Grava os valores calculados na linha, sem tocar no que já está igual. */
export function aplicarCalculadosNaLinha(
  getValues: GetValues,
  setValue: SetValue,
  basePath: string,
  novos: Record<string, string>
) {
  for (const [nome, valor] of Object.entries(novos)) {
    const caminho = nomeNaLinha(basePath, nome);
    if (getValues(caminho) !== valor) setValue(caminho, valor);
  }
}

// Isolado do resto do formulário (só ele re-renderiza com os watches) e sem
// DOM. Usa o MESMO motor do servidor (lib/retencoes.ts), então o valor
// mostrado é o valor que vai ser gravado.
function AutoCalcEffect({ config, perfil, basePath }: { config: ConfigRetencoes; perfil: Perfil; basePath: string }) {
  const { control, setValue, getValues } = useFormContext<any>();
  const { n, nomesForm } = useNomesDaLinha(basePath);
  const valorPagamento = useWatch({ control, name: n("valorPagamento") });
  const elemento = useWatch({ control, name: "elemento" });
  const camposInformados: string[] = useWatch({ control, name: n("camposInformados") }) || [];
  const credorMei: boolean = !!useWatch({ control, name: n("credorMei") });
  const sobrescreverMei: boolean = !!useWatch({ control, name: n("sobrescreverMei") });
  const valoresCampos = useWatch({ control, name: nomesForm });
  const chaveValores = JSON.stringify(valoresCampos);
  const chaveInformados = camposInformados.join("|");

  useEffect(() => {
    // Transporte (.33) é calculado pelo servidor (PreviaTransporteEffect).
    if (perfilDoElemento(extrairCodigoElemento(elemento)) !== "PADRAO") return;
    const timer = setTimeout(() => {
      const elementoCodigo = extrairCodigoElemento(elemento);
      const informadosValidos = informadosValidosDaLinha(camposInformados, config, elementoCodigo, perfil, { credorMei, sobrescreverMei });

      let resultado;
      try {
        resultado = calcularRetencoes({
          brutoCents: toCents(valorPagamento),
          elementoCodigo,
          config: config.campos,
          regras: config.regras,
          informados: informadosEmCentavos((basePath ? getValues(basePath) : getValues()) || {}, informadosValidos),
          perfil,
          credorMei,
          sobrescreverMei,
        });
      } catch {
        return; // valor digitado inválido (ex.: maior que o bruto): o resumo mostra o alerta
      }

      aplicarCalculadosNaLinha(getValues, setValue, basePath, valoresCalculadosDoForm(resultado.itens, informadosValidos));
      if (!mesmaLista(informadosValidos, camposInformados)) {
        setValue(n("camposInformados"), informadosValidos);
      }
    }, 350);
    return () => clearTimeout(timer);
    // chaveValores/chaveInformados representam os arrays observados (identidade muda a cada render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorPagamento, elemento, chaveInformados, chaveValores, config, perfil, credorMei, sobrescreverMei, setValue, getValues, n, basePath]);

  return null;
}

/**
 * Transporte autônomo (3.3.90.33, T25): depende de tabela do IRRF, município
 * do credor e vigência, que só o servidor tem — pede a prévia (mesmo cálculo
 * do salvar, sem gravar). Descarta resposta atrasada de um estado anterior.
 */
function PreviaTransporteEffect({ config, perfil, basePath }: { config: ConfigRetencoes; perfil: Perfil; basePath: string }) {
  const { control, setValue, getValues } = useFormContext<any>();
  const { n, nomesForm } = useNomesDaLinha(basePath);
  const elemento = useWatch({ control, name: "elemento" });
  const empenho = useWatch({ control, name: "empenho" });
  const cpfCnpj = useWatch({ control, name: n("cpfCnpj") });
  const valorPagamento = useWatch({ control, name: n("valorPagamento") });
  const dataPagamento = useWatch({ control, name: n("dataPagamento") });
  const dataEmissao = useWatch({ control, name: "dataEmissao" });
  const camposInformados: string[] = useWatch({ control, name: n("camposInformados") }) || [];
  const credorMei: boolean = !!useWatch({ control, name: n("credorMei") });
  const sobrescreverMei: boolean = !!useWatch({ control, name: n("sobrescreverMei") });
  const valoresCampos = useWatch({ control, name: nomesForm });
  const chaveValores = JSON.stringify(valoresCampos);
  const chaveInformados = camposInformados.join("|");

  useEffect(() => {
    const elementoCodigo = extrairCodigoElemento(elemento);
    if (perfilDoElemento(elementoCodigo) !== "TRANSPORTE_AUTONOMO") return;
    let cancelado = false;

    const limparCalculados = (informadosValidos: string[]) =>
      aplicarCalculadosNaLinha(getValues, setValue, basePath, valoresCalculadosDoForm({}, informadosValidos));

    const timer = setTimeout(async () => {
      const informadosValidos = informadosValidosDaLinha(camposInformados, config, elementoCodigo, perfil, { credorMei, sobrescreverMei });
      if (!mesmaLista(informadosValidos, camposInformados)) setValue(n("camposInformados"), informadosValidos);

      const bruto = toCents(valorPagamento);
      if (!cpfCnpj || !empenho || bruto <= 0) {
        limparCalculados(informadosValidos);
        setValue(n("previaAvisos"), [
          !cpfCnpj ? "Escolha o credor para calcular o transporte." : "Informe o valor a pagar para calcular o transporte.",
        ]);
        return;
      }

      const valores = (basePath ? getValues(basePath) : getValues()) || {};
      const retencoesInformadas: Record<string, number> = {};
      for (const campo of informadosValidos) {
        if (ehCampoRetencao(campo)) retencoesInformadas[CAMPO_FORM[campo]] = toCents(valores[CAMPO_FORM[campo]]) / 100;
      }

      try {
        const previa = await apiClient.post<{ itens: Record<string, number>; avisos: string[] }>(
          "/api/ordens-pagamento/previa",
          {
            numeroEmpenho: empenho,
            credorCpfCnpj: cpfCnpj,
            valorPagamento: bruto / 100,
            dataPagamento: dataPagamento || null,
            dataEmissao: dataEmissao || null,
            ...(credorMei && sobrescreverMei ? { sobrescreverMei: true } : {}),
            ...retencoesInformadas,
          }
        );
        if (cancelado) return;
        aplicarCalculadosNaLinha(getValues, setValue, basePath, valoresCalculadosDoForm(itensDaPreviaEmCentavos(previa.itens), informadosValidos));
        setValue(n("previaAvisos"), previa.avisos || []);
      } catch (e: any) {
        if (cancelado) return;
        limparCalculados(informadosValidos);
        setValue(n("previaAvisos"), [e?.message || "Não foi possível calcular a prévia do transporte."]);
      }
    }, 350);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
    // chaveValores/chaveInformados representam os arrays observados (identidade muda a cada render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elemento, empenho, cpfCnpj, valorPagamento, dataPagamento, dataEmissao, chaveInformados, chaveValores, config, perfil, credorMei, sobrescreverMei, setValue, getValues, n, basePath]);

  return null;
}

/** Itens da prévia (em reais) → centavos, para o mesmo caminho do cálculo local. */
export function itensDaPreviaEmCentavos(itens: Record<string, number> | undefined): Partial<Record<CampoRetencao, number>> {
  return Object.fromEntries(CAMPOS_RETENCAO.map((campo) => [campo, toCents(itens?.[campo] ?? 0)]));
}

/**
 * Efeitos de uma linha (sem DOM): cálculo local e, no modo "individual", a
 * prévia do .33. Na lista (T35-B) ficam SEMPRE montados por linha, mesmo com
 * o painel fechado, e a prévia do .33 vem do PreviaLoteEffect ("externa").
 */
export function EfeitosRetencaoLinha({
  config,
  perfil,
  basePath = "",
  previa = "individual",
}: {
  config: ConfigRetencoes;
  perfil: Perfil;
  basePath?: string;
  previa?: "individual" | "externa";
}) {
  return (
    <>
      <AutoCalcEffect config={config} perfil={perfil} basePath={basePath} />
      {previa === "individual" && <PreviaTransporteEffect config={config} perfil={perfil} basePath={basePath} />}
    </>
  );
}

function TaxesTotalSummary({ basePath }: { basePath: string }) {
  const { control } = useFormContext<any>();
  const { n, nomesForm } = useNomesDaLinha(basePath);
  const valorPagamento = useWatch({ control, name: n("valorPagamento") });
  const elemento = useWatch({ control, name: "elemento" });
  const valoresCampos: unknown[] = useWatch({ control, name: nomesForm }) || [];

  const valores = Object.fromEntries(NOMES_FORM.map((nome, i) => [nome, valoresCampos[i]]));
  const brutoCents = toCents(valorPagamento);
  const descontosCents = somarDescontosCents(valores, camposInformativos(extrairCodigoElemento(elemento)));
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
  basePath,
}: {
  campo: CampoRetencao;
  rotulo: string;
  editavel: boolean;
  obrigatorio: boolean;
  dica: string | null;
  basePath: string;
}) {
  const { register, setValue, getValues } = useFormContext<any>();
  const { n } = useNomesDaLinha(basePath);
  const nome = n(CAMPO_FORM[campo]);
  const inputId = idNaLinha(basePath, `op-retencao-${campo}`);
  const dicaId = `${inputId}-dica`;

  // onChange via setValue (não via o onChange do register): o do register roda
  // depois do RHF já ter capturado o valor sem máscara, deixando o estado um
  // dígito atrasado (mesmo bug já corrigido em OpPaymentData.tsx).
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const apagando = String((e.nativeEvent as InputEvent).inputType || "").startsWith("delete");
    const mascarado = mascararValorDigitado(e.target.value, apagando);
    e.target.value = mascarado;
    setValue(nome, mascarado, { shouldDirty: true });
    const atuais: string[] = getValues(n("camposInformados")) || [];
    const semEste = atuais.filter((c) => c !== campo);
    setValue(n("camposInformados"), mascarado ? [...semEste, campo] : semEste);
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

function BannerMei({ perfil, sobrescreverMei, basePath }: { perfil: Perfil; sobrescreverMei: boolean; basePath: string }) {
  const { setValue, getValues } = useFormContext<any>();
  const { n } = useNomesDaLinha(basePath);
  const [confirmando, setConfirmando] = useState(false);

  const desfazer = () => {
    setValue(n("sobrescreverMei"), false);
    const tributarios = CAMPOS_TRIBUTARIOS as string[];
    setValue(n("camposInformados"), (getValues(n("camposInformados")) || []).filter((c: string) => !tributarios.includes(c)));
  };

  return (
    <div role="status" className="mb-6 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-black text-violet-800">
        <ShieldCheck className="w-4 h-4" /> Credor MEI — isento de retenções
      </p>
      <p className="mt-1 text-xs font-semibold text-violet-700">
        IRRF, ISS, INSS, SEST/SENAT e patronal ficam zerados. Taxa bancária, PIX e outros descontos continuam valendo.
      </p>
      {perfil === "ADMIN" &&
        (sobrescreverMei ? (
          <p className="mt-2 text-xs font-bold text-amber-800">
            Retenção manual liberada (fica registrada na auditoria).{" "}
            <button type="button" onClick={desfazer} className="underline">
              Voltar à isenção
            </button>
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="mt-2 text-xs font-black uppercase tracking-widest text-violet-900 hover:underline"
          >
            Aplicar retenção mesmo assim…
          </button>
        ))}

      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogTitle>Reter imposto de um credor MEI?</AlertDialogTitle>
          <AlertDialogDescription>
            MEI não sofre retenção. Se continuar, você digita manualmente os valores a reter, e a operação fica registrada na
            auditoria com o seu usuário.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => setValue(n("sobrescreverMei"), true)}>Liberar retenção manual</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CamposRetencao({ config, perfil, basePath, efeitos }: { config: ConfigRetencoes; perfil: Perfil; basePath: string; efeitos: boolean }) {
  const { control } = useFormContext<any>();
  const { n } = useNomesDaLinha(basePath);
  const elemento = useWatch({ control, name: "elemento" });
  const previaAvisos: string[] = useWatch({ control, name: n("previaAvisos") }) || [];
  const credorMei: boolean = !!useWatch({ control, name: n("credorMei") });
  const sobrescreverMei: boolean = !!useWatch({ control, name: n("sobrescreverMei") });
  const elementoCodigo = extrairCodigoElemento(elemento);
  const elementoConhecido = elementoCodigo !== null && config.regras[elementoCodigo] !== undefined;
  const transporte = perfilDoElemento(elementoCodigo) === "TRANSPORTE_AUTONOMO";

  const campos = config.campos
    .filter((c) => c.ativo && ehCampoRetencao(c.campo))
    .sort((a, b) => a.ordem - b.ordem);

  return (
    <>
      {credorMei && <BannerMei perfil={perfil} sobrescreverMei={sobrescreverMei} basePath={basePath} />}
      {!elemento ? (
        <p className="mb-6 text-sm font-semibold text-slate-500">Selecione a NE para calcular as retenções.</p>
      ) : transporte ? (
        <div className="mb-6 space-y-1" role="status">
          <p className="text-sm font-semibold text-slate-500">
            Transporte autônomo ({elementoCodigo}): retenções calculadas pelo servidor conforme a tabela vigente. A patronal é
            informativa e não entra no total.
          </p>
          {previaAvisos.map((aviso) => (
            <p key={aviso} className="flex items-center gap-2 text-sm font-semibold text-amber-700">
              <AlertTriangle className="w-4 h-4" /> {aviso}
            </p>
          ))}
        </div>
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
          const estado = estadoCampoOp(cfg, elementoCodigo, config.regras, perfil, { credorMei, sobrescreverMei });
          return (
            <CampoRetencaoInput
              key={cfg.campo}
              campo={cfg.campo as CampoRetencao}
              rotulo={rotuloCampoDoElemento(cfg, elementoCodigo)}
              editavel={estado.editavel}
              obrigatorio={estado.obrigatorio}
              dica={estado.dica}
              basePath={basePath}
            />
          );
        })}
      </div>

      {efeitos && <EfeitosRetencaoLinha config={config} perfil={perfil} basePath={basePath} />}
    </>
  );
}

export default function OpTaxesSection({
  userRole,
  config,
  erroConfig,
  basePath = "",
  efeitos = true,
}: {
  userRole: string;
  config: ConfigRetencoes | null;
  erroConfig: string | null;
  /** Prefixo da linha do credor (ex.: `credores.2`); vazio = campos na raiz. */
  basePath?: string;
  /** false quando quem monta a seção já mantém os efeitos da linha (lista da T35-B). */
  efeitos?: boolean;
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
        <CamposRetencao config={config} perfil={perfil} basePath={basePath} efeitos={efeitos} />
      ) : erroConfig ? (
        <p role="alert" className="text-sm font-semibold text-red-600">
          Não foi possível carregar a configuração de retenções ({erroConfig}). O servidor calculará as retenções ao salvar.
        </p>
      ) : (
        <p className="text-sm font-semibold text-slate-500">Carregando configuração de retenções...</p>
      )}

      <TaxesTotalSummary basePath={basePath} />
    </div>
  );
}
