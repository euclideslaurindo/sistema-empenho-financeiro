"use client";
import { useEffect, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { AlertTriangle, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatarBRL, toCents } from "@/lib/money";
import { idNaLinha, type Perfil } from "@/lib/retencoes-form";
import {
  liquidoLinhaCents,
  resumoItens,
  somaItensCents,
  type CampoLinha,
  type CredorLinha,
  type NumeroPrevisto,
} from "@/lib/op-emissao";
import { InputValorPagamento } from "@/components/op-form/InputValorPagamento";
import { NumeroPrevistoSelo } from "@/components/op-form/NumeroPrevistoSelo";
import { CredorOpDetalhes } from "@/components/op-form/CredorOpDetalhes";
import { EfeitosRetencaoLinha } from "@/components/op-form/OpTaxesSection";
import { assinaturaDaLinha } from "@/components/op-form/PreviaLoteEffect";
import type { ConfigRetencoes } from "@/hooks/use-retencoes-config";

export type ErrosLinha = Partial<Record<CampoLinha, string>>;

/** O que o operador mexe na linha (o calculado fica de fora): mudou, some o erro. */
const assinaturaEditavel = (l: Partial<CredorLinha>) =>
  JSON.stringify([assinaturaDaLinha(l, ""), l.numeroCheque || "", JSON.stringify(l.itens || [])]);

/** Uma linha da emissão = uma OP (T35-B). */
export function CredorOpLinha({
  indice,
  total,
  numero,
  config,
  erroConfig,
  perfil,
  aberto,
  erros,
  onAlternar,
  onRemover,
  onLimparErros,
}: {
  indice: number;
  total: number;
  numero: NumeroPrevisto | null;
  config: ConfigRetencoes | null;
  erroConfig: string | null;
  perfil: Perfil;
  aberto: boolean;
  erros?: ErrosLinha;
  onAlternar: () => void;
  onRemover: () => void;
  onLimparErros: () => void;
}) {
  const { control, register, setValue } = useFormContext<any>();
  const basePath = `credores.${indice}`;
  const linha: CredorLinha = useWatch({ control, name: basePath }) || ({} as CredorLinha);
  const elemento = useWatch({ control, name: "elemento" });
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);

  const id = (nome: string) => idNaLinha(basePath, nome);
  const temErro = !!erros && Object.keys(erros).length > 0;
  const liquidoCents = liquidoLinhaCents(linha, elemento);

  // Mudou algo que o operador digita: o erro daquela validação não vale mais.
  const assinatura = assinaturaEditavel(linha);
  const anterior = useRef(assinatura);
  useEffect(() => {
    if (anterior.current !== assinatura) {
      anterior.current = assinatura;
      if (temErro) onLimparErros();
    }
  }, [assinatura, temErro, onLimparErros]);

  const preenchida = toCents(linha.valorPagamento) > 0 || !!String(linha.numeroCheque || "").trim() || somaItensCents(linha.itens) > 0;
  const pedirRemocao = () => (preenchida ? setConfirmarRemocao(true) : onRemover());

  return (
    <div
      role="group"
      aria-label={`Credor ${indice + 1} de ${total}: ${linha.nomeCredor || ""}`}
      data-testid={`linha-credor-${indice}`}
      tabIndex={-1}
      className={`rounded-2xl border bg-white p-4 md:p-5 shadow-sm outline-none focus-visible:ring-4 focus-visible:ring-blue-200 ${temErro ? "border-red-400 ring-2 ring-red-100" : "border-slate-200"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">#{indice + 1}</p>
          <p className="font-black text-slate-800 truncate">
            {linha.nomeCredor}
            {linha.credorMei && (
              <span className="ml-2 text-emerald-700 font-black text-xs uppercase bg-emerald-100 px-1.5 py-0.5 rounded">MEI</span>
            )}
          </p>
          <p className="text-xs font-semibold text-slate-500">
            {linha.cpfCnpj}
            {linha.municipioExpediente && <> · Município (Expediente): {linha.municipioExpediente}</>}
          </p>
        </div>
        <NumeroPrevistoSelo numero={numero} />
      </div>

      {erros?.linha && (
        <p role="alert" className="mt-3 flex items-center gap-2 text-sm font-bold text-red-600">
          <AlertTriangle className="w-4 h-4" /> {erros.linha}
        </p>
      )}

      <div className="mt-2 grid grid-cols-12 gap-4 items-end">
        <InputValorPagamento
          register={register}
          control={control}
          setValue={setValue}
          basePath={basePath}
          errors={erros?.valorPagamento ? { valorPagamento: { message: erros.valorPagamento } } : {}}
        />
        <div className="col-span-12 md:col-span-3">
          <label htmlFor={id("op-cheque")} className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
            Nº do cheque
          </label>
          <input
            id={id("op-cheque")}
            type="text"
            placeholder="Ex: 852963"
            {...register(`${basePath}.numeroCheque`)}
            aria-invalid={!!erros?.numeroCheque}
            aria-describedby={erros?.numeroCheque ? id("op-cheque-erro") : undefined}
            className={`w-full px-4 py-3 rounded-xl border bg-slate-50 focus:border-blue-800 transition-all ${erros?.numeroCheque ? "border-red-400 bg-red-50" : "border-slate-200"}`}
          />
          {erros?.numeroCheque && (
            <p id={id("op-cheque-erro")} className="text-red-500 text-xs mt-1 font-semibold">
              {erros.numeroCheque}
            </p>
          )}
        </div>
        <div className="col-span-12 md:col-span-3">
          <label htmlFor={id("op-data-pagamento")} className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
            Data do pagamento
          </label>
          <input
            id={id("op-data-pagamento")}
            type="date"
            {...register(`${basePath}.dataPagamento`)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-800 transition-all"
          />
        </div>
        <div className="col-span-12 md:col-span-2 md:text-right">
          <p className="text-xs font-black text-emerald-600 uppercase tracking-widest">Líquido</p>
          <p className="text-lg font-black text-emerald-700" data-testid={`liquido-linha-${indice}`}>
            R$ {formatarBRL(liquidoCents)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={onAlternar}
          aria-expanded={aberto}
          aria-controls={id("op-detalhes")}
          className="flex items-center gap-2 text-sm font-bold text-blue-900 hover:underline"
        >
          {aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          Detalhes: especificação e retenções
          <span className="font-semibold text-slate-500">· {resumoItens(linha.itens)}</span>
          {(erros?.itens || erros?.retencoes) && !aberto && <span className="text-red-600">· revisar</span>}
        </button>
        <button
          type="button"
          onClick={pedirRemocao}
          aria-label={`Remover ${linha.nomeCredor || "credor"} da emissão`}
          className="flex items-center gap-1 text-sm font-bold text-slate-400 hover:text-red-600"
        >
          <Trash2 className="w-4 h-4" /> Remover
        </button>
      </div>

      {/* Sempre montados: o líquido e a prévia valem mesmo com o painel fechado. */}
      {config && <EfeitosRetencaoLinha config={config} perfil={perfil} basePath={basePath} previa="externa" />}

      {aberto && (
        <CredorOpDetalhes id={id("op-detalhes")} basePath={basePath} linha={linha} config={config} erroConfig={erroConfig} perfil={perfil} erros={erros} />
      )}

      <AlertDialog open={confirmarRemocao} onOpenChange={setConfirmarRemocao}>
        <AlertDialogContent>
          <AlertDialogTitle>Remover credor da emissão?</AlertDialogTitle>
          <AlertDialogDescription>
            {linha.nomeCredor} já tem dados preenchidos nesta linha. Eles serão descartados.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onRemover}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
