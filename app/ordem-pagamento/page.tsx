"use client";
import { useState, useEffect, useCallback } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Save, Printer } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { parseFormNumber } from "@/lib/utils";

import OpPaymentData from "@/components/op-form/OpPaymentData";
import OpItemsTable from "@/components/op-form/OpItemsTable";
import OpTaxesSection from "@/components/op-form/OpTaxesSection";
import OpRecentTable from "@/components/op-form/OpRecentTable";

const getLocalDate = () => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  return (new Date(Date.now() - tzOffset)).toISOString().split('T')[0];
};

const transformNumber = z.union([z.string(), z.number()]).transform(val => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const clean = String(val).replace(/[^\d,-]/g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}).optional();

const ordemPagamentoSchema = z.object({
  numeroNe: z.string().optional(),
  empenho: z.string().min(1, "Obrigatório"),
  numeroCheque: z.string().optional(),
  nomeCredor: z.string().min(1, "Obrigatório"),
  cpfCnpj: z.string().min(1, "Obrigatório"),
  rgCredor: z.string().optional(),
  enderecoCredor: z.string().optional(),
  unidadeOrcamentaria: z.string().optional(),
  elemento: z.string().optional(),
  subelemento: z.string().optional(),
  gestao: z.string().optional(),
  historico: z.string().optional(),
  dataEmissao: z.string().min(1, "Obrigatório"),
  dataPagamento: z.string().optional(),
  contaBancaria: z.string().optional(),
  itens: z.array(z.object({
    especificacao: z.string().min(1, "Obrigatório"),
    quantidade: z.union([z.string(), z.number()]).transform(v => Number(v) || 0),
    unidade: z.string().min(1, "Obrigatório"),
    valorUnitario: z.union([z.string(), z.number()]).transform(val => {
      if (typeof val === 'number') return val;
      const clean = String(val).replace(/[^\d,-]/g, '').replace(',', '.');
      return parseFloat(clean) || 0;
    })
  })).optional(),

  valorPagamento: z.union([z.string(), z.number()]).transform(val => {
    if (typeof val === 'number') return val;
    const clean = String(val).replace(/[^\d,-]/g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  }).refine(val => val > 0, { message: "Deve ser maior que zero." }),

  saldoAnterior: z.number().optional(),
  valorEmpenho: z.number().optional(),

  irrf: transformNumber,
  iss: transformNumber,
  inss: transformNumber,
  sestSenat: transformNumber,
  patronal: transformNumber,
  outrosDescontos: transformNumber,

  autoCalculate: z.boolean().optional(),
  appliedTax_irrf: z.boolean().optional(),
  appliedTax_iss: z.boolean().optional(),
  appliedTax_inss: z.boolean().optional(),
  appliedTax_sestSenat: z.boolean().optional(),
  appliedTax_patronal: z.boolean().optional(),
});

type OpFormValues = z.input<typeof ordemPagamentoSchema>;

export default function OrdemPagamento() {
  const [isLoading, setIsLoading] = useState(false);
  const [ops, setOps] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("GESTOR");
  const [lastSavedNe, setLastSavedNe] = useState<string | null>(null);



  const methods = useForm<OpFormValues>({
    resolver: zodResolver(ordemPagamentoSchema),
    defaultValues: {
      numeroNe: "",
      empenho: "",
      numeroCheque: "",
      nomeCredor: "",
      cpfCnpj: "",
      rgCredor: "",
      enderecoCredor: "",
      unidadeOrcamentaria: "",
      elemento: "", subelemento: "",
      gestao: "",
      historico: "",
      itens: [{ especificacao: "", quantidade: 1, unidade: "UN", valorUnitario: 0 }],
      dataEmissao: getLocalDate(),
      dataPagamento: "",
      contaBancaria: "",
      valorPagamento: 0,
      saldoAnterior: 0,
      valorEmpenho: 0,
      irrf: "", iss: "", inss: "", sestSenat: "", patronal: "", outrosDescontos: "",
      autoCalculate: true,
      appliedTax_irrf: true, appliedTax_iss: true, appliedTax_inss: true, appliedTax_patronal: true, appliedTax_sestSenat: true,
    }
  });

  const { reset, handleSubmit, formState: { errors } } = methods;

  const fetchOps = useCallback(async (busca: string = "") => {
    setIsLoading(true);
    try {
      const url = busca ? `/api/ordens-pagamento?busca=${encodeURIComponent(busca)}` : "/api/ordens-pagamento";
      const data = await apiClient.get(url);
      setOps(data.ordens || []);
    } catch (error: any) {
      toast.error(error.message || "Erro ao carregar Ordens.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchUserRole = useCallback(async () => {
    try {
      const data = await apiClient.get("/api/perfil");
      if (data && data.usuario) {
        setUserRole(data.usuario.perfil);
      }
    } catch (e) {
      console.error("Erro ao buscar perfil", e);
    }
  }, []);

  useEffect(() => {
    fetchOps();
    fetchUserRole();
  }, [fetchOps, fetchUserRole]);

  const handleNovaOp = () => {
    reset({
      numeroNe: "", empenho: "", numeroCheque: "", nomeCredor: "", cpfCnpj: "", rgCredor: "", enderecoCredor: "",
      unidadeOrcamentaria: "", elemento: "", subelemento: "", gestao: "", historico: "",
      itens: [{ especificacao: "", quantidade: 1, unidade: "UN", valorUnitario: 0 }],
      dataEmissao: getLocalDate(), dataPagamento: "", contaBancaria: "",
      valorPagamento: 0, saldoAnterior: 0, valorEmpenho: 0,
      irrf: 0, iss: 0, inss: 0, sestSenat: 0, patronal: 0, outrosDescontos: 0,
      autoCalculate: true, appliedTax_irrf: true, appliedTax_iss: true, appliedTax_inss: true,
    });
    setEditingId(null);
  };

  const onSubmit = async (data: any) => {
    setIsSaving(true);
    try {
      const vp = parseFormNumber(data.valorPagamento);
      const saldo = parseFormNumber(data.saldoAnterior);

      if (vp <= 0) {
        toast.error('O valor a pagar deve ser maior que zero.');
        setIsSaving(false);
        return;
      }

      if (vp > saldo && saldo > 0) {
        toast.error(`O valor do pagamento não pode ser maior que o saldo anterior da NE.`);
        setIsSaving(false);
        return;
      }

      const totalDesc = parseFormNumber(data.irrf) + parseFormNumber(data.iss) + parseFormNumber(data.inss) +
        parseFormNumber(data.sestSenat) + parseFormNumber(data.patronal) + parseFormNumber(data.outrosDescontos);

      if (totalDesc > vp) {
        toast.error(`Total de descontos não pode ser maior que o valor a pagar.`);
        setIsSaving(false);
        return;
      }

      let totalItens = 0;
      if (data.itens && data.itens.length > 0) {
        data.itens.forEach((item: any) => {
          totalItens += Number(item.quantidade || 0) * parseFormNumber(item.valorUnitario);
        });
      }

      if (totalItens !== vp && totalItens > 0) {
        toast.error(`O valor total dos itens especificados deve ser exatamente igual ao valor a pagar.`);
        setIsSaving(false);
        return;
      }

      const vLiquido = vp - totalDesc;

      const payload = {
        numeroNe: data.numeroNe,
        numeroEmpenho: data.empenho,
        numeroCheque: data.numeroCheque,
        credorNome: data.nomeCredor,
        credorCpfCnpj: data.cpfCnpj,
        credorRg: data.rgCredor,
        credorEndereco: data.enderecoCredor,
        unidadeOrcamentaria: data.unidadeOrcamentaria,
        elemento: data.elemento,
        subelemento: data.subelemento,
        gestao: data.gestao,
        saldoAnterior: data.saldoAnterior,
        valorEmpenho: data.valorEmpenho,
        valorPagamento: vp,
        irrf: parseFormNumber(data.irrf),
        iss: parseFormNumber(data.iss),
        inss: parseFormNumber(data.inss),
        sestSenat: parseFormNumber(data.sestSenat),
        patronal: parseFormNumber(data.patronal),
        outrosDescontos: parseFormNumber(data.outrosDescontos),
        totalDescontos: totalDesc,
        valorLiquido: vLiquido,
        dataEmissao: data.dataEmissao,
        dataPagamento: data.dataPagamento,
        historico: data.itens && data.itens.length > 0 ? data.itens.map((i: any) => i.especificacao).join(' | ') : data.historico,
        itens: data.itens ? data.itens.map((i: any) => ({
          especificacao: i.especificacao,
          unidade: i.unidade,
          quantidade: parseFormNumber(i.quantidade),
          valorUnitario: parseFormNumber(i.valorUnitario)
        })) : [],
        liquidacao_id: null,
      };

      let responseData: any;
      if (editingId) {
        responseData = await apiClient.put(`/api/ordens-pagamento/${editingId}`, payload);
      } else {
        responseData = await apiClient.post("/api/ordens-pagamento", payload);
      }

      toast.success(editingId ? "OP atualizada com sucesso!" : "Ordem de Pagamento salva com sucesso!");
      setLastSavedNe(data.empenho);
      handleNovaOp();
      await fetchOps();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro de conexão ao salvar.");
      setIsSaving(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFormError = (erros: any) => {
    const primeiroErro = Object.values(erros)[0] as any;
    const msg = primeiroErro?.message || primeiroErro?.root?.message || 'Preencha todos os campos obrigatórios.';
    toast.error(`Erro de validação: ${msg}`);
  };

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="p-8 max-w-[1400px] mx-auto w-full flex-1 space-y-8 animate-fade-in">

        <div className="flex flex-col md:flex-row md:items-end justify-between">
          <div>
            <div className="flex items-center text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">
              Início &gt; Gestão Financeira &gt; <span className="text-blue-900 ml-1">Ordem de Pagamento</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight">
              Emissão de Ordem de Pagamento
            </h1>
          </div>
          <div className="mt-6 md:mt-0 flex items-center gap-3">
            <button onClick={handleNovaOp} className="bg-blue-900 hover:bg-blue-800 text-white text-sm font-bold py-2.5 px-5 rounded-xl shadow-sm transition-all flex items-center gap-2">
              <Plus className="w-4 h-4" /> Nova OP
            </button>
            <button onClick={handleSubmit(onSubmit, handleFormError)} disabled={isSaving} className="bg-blue-900 hover:bg-blue-800 text-white text-sm font-bold py-2.5 px-5 rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50">
              <Save className="w-4 h-4" /> {isSaving ? "Salvando..." : "Salvar"}
            </button>
            {lastSavedNe && (
              <a href={`/consulta-impressao?ne=${lastSavedNe}`} target="_blank" className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-2.5 px-5 rounded-xl shadow-sm transition-all flex items-center gap-2">
                <Printer className="w-4 h-4" /> Imprimir OP
              </a>
            )}
          </div>
        </div>

        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit, handleFormError)}>
            <OpPaymentData errors={errors} />
            <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] mb-8">
              <OpItemsTable />
            </div>
            <OpTaxesSection userRole={userRole} />
          </form>
        </FormProvider>

        {/* BARRA DE AÇÕES INFERIOR - sticky */}
        <div className="sticky bottom-4 z-40">
          <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10 px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 ml-auto">
              <button type="button" onClick={handleNovaOp} className="bg-white/10 hover:bg-white/20 text-white text-sm font-bold py-2.5 px-5 rounded-xl transition-all flex items-center gap-2 border border-white/10">
                <Plus className="w-4 h-4" /> Nova OP
              </button>
              <button onClick={handleSubmit(onSubmit, handleFormError)} disabled={isSaving} className="bg-blue-500 hover:bg-blue-400 text-white text-sm font-bold py-2.5 px-6 rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50">
                <Save className="w-4 h-4" /> {isSaving ? "Salvando..." : "Salvar OP"}
              </button>
              {lastSavedNe && (
                <a href={`/consulta-impressao?ne=${lastSavedNe}`} target="_blank" className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold py-2.5 px-5 rounded-xl shadow-lg transition-all flex items-center gap-2">
                  <Printer className="w-4 h-4" /> Imprimir
                </a>
              )}
            </div>
          </div>
        </div>

        <OpRecentTable ops={ops} onSearch={fetchOps} />

      </div>
    </div>
  );
}
