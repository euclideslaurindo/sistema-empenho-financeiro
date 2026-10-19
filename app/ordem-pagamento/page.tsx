"use client";
import { useState, useEffect, useCallback } from "react";
import { useForm, FormProvider, useFieldArray, useWatch } from "react-hook-form";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiClient } from "@/lib/api-client";
import { toCents, formatarBRL } from "@/lib/money";
import { idNaLinha, type Perfil } from "@/lib/retencoes-form";
import {
  credorNaLista,
  linhaDoCredor,
  linhaDoErroServidor,
  liquidoLinhaCents,
  montarPayloadLote,
  numerosQueMudaram,
  temErros,
  validarEmissao,
  type CredorApi,
  type CredorLinha,
} from "@/lib/op-emissao";
import { useRetencoesConfig } from "@/hooks/use-retencoes-config";
import { useSaldoNe } from "@/hooks/use-saldo-ne";
import { useNumerosPrevistos } from "@/hooks/use-numeros-previstos";

import OpPaymentData from "@/components/op-form/OpPaymentData";
import OpRecentTable from "@/components/op-form/OpRecentTable";
import { CredoresOpLista } from "@/components/op-form/CredoresOpLista";
import { PreviaLoteEffect } from "@/components/op-form/PreviaLoteEffect";
import { BarraTotaisEmissao } from "@/components/op-form/BarraTotaisEmissao";
import { DialogoEmissao, type OpEmitida, type ResultadoEmissao } from "@/components/op-form/DialogoEmissao";
import type { ErrosLinha } from "@/components/op-form/CredorOpLinha";

const getLocalDate = () => {
  const tzOffset = new Date().getTimezoneOffset() * 60000;
  return new Date(Date.now() - tzOffset).toISOString().split("T")[0];
};

interface EmissaoForm {
  empenho: string;
  neCarregada: string;
  historicoNe: string;
  unidadeOrcamentaria: string;
  gestao: string;
  elemento: string;
  subelemento: string;
  dataEmissao: string;
  credores: CredorLinha[];
}

// Usada no defaultValues E no "Nova emissão", pra os dois nunca divergirem.
const valoresIniciais = (): EmissaoForm => ({
  empenho: "",
  neCarregada: "",
  historicoNe: "",
  unidadeOrcamentaria: "",
  gestao: "",
  elemento: "",
  subelemento: "",
  dataEmissao: getLocalDate(),
  credores: [],
});

/**
 * Emissão de Ordens de Pagamento (T35-B): uma NE, uma lista de credores, uma
 * OP por credor, tudo pelo lote (POST /api/ordens-pagamento/lote, T34-C) —
 * inclusive quando é um credor só. A edição de OP não é feita nesta tela.
 */
export default function OrdemPagamento() {
  const [ops, setOps] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string>("GESTOR");
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [errosLinhas, setErrosLinhas] = useState<Record<string, ErrosLinha>>({});
  const [emitindo, setEmitindo] = useState(false);
  const [resultado, setResultado] = useState<ResultadoEmissao | null>(null);
  const [confirmarLimpar, setConfirmarLimpar] = useState(false);

  const { config: configRetencoes, erro: erroConfigRetencoes } = useRetencoesConfig({
    comElementos: false,
    recarregarNoFoco: true,
  });

  const methods = useForm<EmissaoForm>({ defaultValues: valoresIniciais() });
  const { control, getValues, reset, setError, clearErrors, formState: { errors } } = methods;
  const { fields, append, remove, replace } = useFieldArray({ control, name: "credores" });
  const neCarregada: string = useWatch({ control, name: "neCarregada" }) || "";

  const { saldo, erro: erroSaldo, recarregar: recarregarSaldo } = useSaldoNe(neCarregada);
  const { numeros, recarregar: recarregarNumeros } = useNumerosPrevistos(neCarregada, fields.length);
  const saldoRestanteCents = saldo ? toCents(saldo.restante) : null;
  const perfil = userRole as Perfil;

  const fetchOps = useCallback(async (busca: string = "") => {
    try {
      const url = busca ? `/api/ordens-pagamento?busca=${encodeURIComponent(busca)}` : "/api/ordens-pagamento";
      const data = await apiClient.get(url);
      setOps(data.ordens || []);
    } catch (error: any) {
      toast.error(error.message || "Erro ao carregar Ordens.");
    }
  }, []);

  const fetchUserRole = useCallback(async () => {
    try {
      const data = await apiClient.get("/api/perfil");
      if (data && data.usuario) setUserRole(data.usuario.perfil);
    } catch (e) {
      console.error("Erro ao buscar perfil", e);
    }
  }, []);

  useEffect(() => {
    fetchOps();
    fetchUserRole();
  }, [fetchOps, fetchUserRole]);

  const esquecerEstadoDasLinhas = () => {
    setErrosLinhas({});
    setAbertos(new Set());
  };

  const limparLista = () => {
    replace([]);
    esquecerEstadoDasLinhas();
  };

  const novaEmissao = () => {
    reset(valoresIniciais());
    esquecerEstadoDasLinhas();
  };

  const adicionarCredor = (credor: CredorApi) => {
    const atuais = getValues("credores") || [];
    const cpf = credor.cpfCnpj || credor.cpf_cnpj;
    if (credorNaLista(atuais, cpf)) {
      toast.warning(`${credor.nome || cpf} já está nesta emissão.`);
      return;
    }
    append(linhaDoCredor(credor, getValues("historicoNe"), getValues("neCarregada")));
    // Foco no valor a pagar da linha nova: é o próximo campo a preencher.
    const idValor = idNaLinha(`credores.${atuais.length}`, "op-valor-pagamento");
    setTimeout(() => document.getElementById(idValor)?.focus(), 0);
  };

  const removerLinha = (indice: number) => {
    const chave = getValues(`credores.${indice}.chave`);
    remove(indice);
    setErrosLinhas((prev) => {
      const novo = { ...prev };
      delete novo[chave];
      return novo;
    });
    setAbertos((prev) => {
      const novo = new Set(prev);
      novo.delete(chave);
      return novo;
    });
  };

  const alternarPainel = (chave: string) =>
    setAbertos((prev) => {
      const novo = new Set(prev);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });

  const limparErrosLinha = useCallback(
    (chave: string) =>
      setErrosLinhas((prev) => {
        if (!prev[chave]) return prev;
        const novo = { ...prev };
        delete novo[chave];
        return novo;
      }),
    []
  );

  // Acessibilidade: o foco vai para o 1º campo inválido da linha (ou para a
  // própria linha, cujo alerta é lido pelo leitor de tela). Espera o React
  // desenhar os erros antes de procurar o campo.
  const focarLinha = (indice: number) =>
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-testid="linha-credor-${indice}"]`);
      if (!el) return;
      el.scrollIntoView?.({ behavior: "smooth", block: "center" });
      (el.querySelector<HTMLElement>('[aria-invalid="true"]') ?? el).focus();
    }, 50);

  const emitir = async () => {
    clearErrors();
    const valores = getValues();
    const credores = valores.credores || [];
    const erros = validarEmissao(valores, { config: configRetencoes, perfil, saldoRestanteCents });

    if (!valores.neCarregada) setError("empenho", { message: "Carregue a Nota de Empenho." });
    if (!valores.dataEmissao) setError("dataEmissao", { message: "Obrigatório" });

    if (temErros(erros)) {
      const porChave: Record<string, ErrosLinha> = {};
      const abrir = new Set(abertos);
      for (const [i, errosDaLinha] of Object.entries(erros.linhas)) {
        const chave = credores[Number(i)]?.chave;
        if (!chave) continue;
        porChave[chave] = errosDaLinha;
        if (errosDaLinha.itens || errosDaLinha.retencoes) abrir.add(chave); // o erro está dentro do painel
      }
      setErrosLinhas(porChave);
      setAbertos(abrir);
      const indices = Object.keys(erros.linhas).map(Number);
      if (indices.length > 0) focarLinha(Math.min(...indices));
      toast.error(
        erros.gerais[0] ||
          (indices.length === 1 ? `O credor ${indices[0] + 1} precisa de atenção.` : `${indices.length} credores precisam de atenção.`)
      );
      return;
    }

    setEmitindo(true);
    try {
      const r = await apiClient.post<{ numeroNe: string; ops: OpEmitida[]; resumo: ResultadoEmissao["resumo"] }>(
        "/api/ordens-pagamento/lote",
        montarPayloadLote(valores)
      );
      const recalculadas = r.ops.filter(
        (op, i) => credores[i] && toCents(op.valorLiquido) !== liquidoLinhaCents(credores[i], valores.elemento)
      );
      setResultado({ ...r, mudaram: numerosQueMudaram(numeros, r.ops) });
      toast.success(r.ops.length === 1 ? `OP ${r.ops[0].numeroOp} emitida.` : `${r.ops.length} OPs emitidas.`);
      if (recalculadas.length > 0) {
        toast.warning(
          `Valores recalculados pelo servidor: ${recalculadas
            .map((op) => `${op.credorNome} líquido R$ ${formatarBRL(toCents(op.valorLiquido))}`)
            .join("; ")}.`
        );
      }
      limparLista(); // mantém a NE carregada para a próxima emissão
      recarregarSaldo();
      recarregarNumeros();
      await fetchOps();
    } catch (error: any) {
      const daLinha = linhaDoErroServidor(error?.message);
      const credor = daLinha ? credores[daLinha.indice] : undefined;
      if (daLinha && credor) {
        setErrosLinhas({ [credor.chave]: { linha: daLinha.mensagem } });
        setAbertos((prev) => new Set(prev).add(credor.chave));
        focarLinha(daLinha.indice);
        toast.error(`Credor ${daLinha.indice + 1} (${credor.nomeCredor}): ${daLinha.mensagem}`);
      } else {
        toast.error(error?.message || "Erro de conexão ao emitir.");
      }
    } finally {
      setEmitindo(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="p-4 md:p-8 max-w-[1400px] mx-auto w-full flex-1 space-y-8 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-end justify-between">
          <div>
            <div className="flex items-center text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">
              Início &gt; Gestão Financeira &gt; <span className="text-blue-900 ml-1">Ordem de Pagamento</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight">Emissão de Ordem de Pagamento</h1>
          </div>
          <div className="mt-6 md:mt-0 flex items-center gap-3">
            <button
              type="button"
              onClick={novaEmissao}
              className="bg-blue-900 hover:bg-blue-800 text-white text-sm font-bold py-2.5 px-5 rounded-xl shadow-sm transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Nova emissão
            </button>
          </div>
        </div>

        <FormProvider {...methods}>
          {/* Enter num campo não emite: só o botão Emitir. */}
          <form onSubmit={(e) => e.preventDefault()}>
            <OpPaymentData errors={errors} saldo={saldo} erroSaldo={erroSaldo} quantidadeCredores={fields.length} onTrocarNe={limparLista} />
            <CredoresOpLista
              chaves={fields.map((f) => f.chave)}
              neCarregada={neCarregada}
              numeros={numeros}
              config={configRetencoes}
              erroConfig={erroConfigRetencoes}
              perfil={perfil}
              abertos={abertos}
              errosLinhas={errosLinhas}
              onAdicionar={adicionarCredor}
              onRemover={removerLinha}
              onAlternar={alternarPainel}
              onLimparErros={limparErrosLinha}
            />
            {configRetencoes && <PreviaLoteEffect config={configRetencoes} perfil={perfil} />}
          </form>

          <BarraTotaisEmissao
            saldoRestanteCents={saldoRestanteCents}
            emitindo={emitindo}
            podeEmitir={!!neCarregada}
            onEmitir={emitir}
            onLimpar={() => setConfirmarLimpar(true)}
          />
        </FormProvider>

        <OpRecentTable ops={ops} onSearch={fetchOps} />
      </div>

      <DialogoEmissao resultado={resultado} onFechar={() => setResultado(null)} />

      <AlertDialog open={confirmarLimpar} onOpenChange={setConfirmarLimpar}>
        <AlertDialogContent>
          <AlertDialogTitle>Limpar a lista de credores?</AlertDialogTitle>
          <AlertDialogDescription>Todos os credores desta emissão serão removidos. A NE continua carregada.</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={limparLista}>Limpar lista</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
