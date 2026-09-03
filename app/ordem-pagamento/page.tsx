"use client";
import { useState, useEffect, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Save, Search, Wallet, Calculator, Eye, Printer, AlertTriangle, XCircle, User, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { maskCurrency } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";

const transformNumber = z.union([z.string(), z.number()]).transform(val => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const clean = String(val).replace(/[^\d,-]/g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}).optional();

const ordemPagamentoSchema = z.object({
  numeroNe: z.string().min(1, "Obrigatório"),
  empenho: z.string().min(1, "Obrigatório"),
  numeroCheque: z.string().optional(),
  nomeCredor: z.string().min(1, "Obrigatório"),
  cpfCnpj: z.string().min(1, "Obrigatório"),
  rgCredor: z.string().optional(),
  enderecoCredor: z.string().optional(),
  unidadeOrcamentaria: z.string().optional(),
  elementoSubelemento: z.string().optional(),
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
  const [searchTerm, setSearchTerm] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);

  const { register, handleSubmit, watch, reset, setValue, control, formState: { errors } } = useForm<OpFormValues>({
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
      elementoSubelemento: "",
      gestao: "",
      historico: "",
      itens: [{ especificacao: "", quantidade: 1, unidade: "UN", valorUnitario: 0 }],
      dataEmissao: new Date().toISOString().split('T')[0],
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

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "itens"
  });

  const fetchOps = useCallback(async (busca = "") => {
    setIsLoading(true);
    try {
      const data = await apiClient.get("/api/ordens-pagamento");
      setOps(data.ordens || []);
    } catch (error: any) {
      toast.error(error.message || "Erro ao carregar Ordens.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOps();
  }, [fetchOps]);

  // quando o cpf/cnpj muda, tenta buscar o credor no banco
  const wCpfCnpj = watch("cpfCnpj");
  useEffect(() => {
    const clean = wCpfCnpj ? wCpfCnpj.replace(/\D/g, '') : '';
    if (clean.length === 11 || clean.length === 14) {
      const fetchCredor = async () => {
        try {
          const res = await apiClient.get(`/api/credores?busca=${encodeURIComponent(clean)}`);
          if (res && res.credores && res.credores.length > 0) {
            const credorEncontrado = res.credores[0];
            setValue("nomeCredor", credorEncontrado.nome);
            setValue("rgCredor", credorEncontrado.rg || '');
            setValue("enderecoCredor", credorEncontrado.endereco || '');
          }
        } catch (err) {
          // se nao achar nada, ignora
        }
      };
      fetchCredor();
    }
  }, [wCpfCnpj, setValue]);

  // watches dos campos de calculo dos impostos
  const wValorPagamento = watch("valorPagamento");
  const wAutoCalculate = watch("autoCalculate");
  const wApplied = {
    irrf: watch("appliedTax_irrf"),
    iss: watch("appliedTax_iss"),
    inss: watch("appliedTax_inss"),
    sestSenat: watch("appliedTax_sestSenat"),
    patronal: watch("appliedTax_patronal"),
  };

  const wDesc = {
    irrf: watch("irrf") || 0,
    iss: watch("iss") || 0,
    inss: watch("inss") || 0,
    sestSenat: watch("sestSenat") || 0,
    patronal: watch("patronal") || 0,
    outrosDescontos: watch("outrosDescontos") || 0
  };

  useEffect(() => {
    const vp = Number(wValorPagamento) || 0;
    if (wAutoCalculate && vp > 0) {
      setValue("irrf", wApplied.irrf ? maskCurrency(Math.round(vp * 0.015 * 100)) : "");
      setValue("iss", wApplied.iss ? maskCurrency(Math.round(vp * 0.05 * 100)) : "");
      setValue("inss", wApplied.inss ? maskCurrency(Math.round(vp * 0.11 * 100)) : "");
      setValue("sestSenat", wApplied.sestSenat ? maskCurrency(Math.round(vp * 0.025 * 100)) : "");
      setValue("patronal", wApplied.patronal ? maskCurrency(Math.round(vp * 0.20 * 100)) : "");
    } else if (wAutoCalculate && vp === 0) {
      setValue("irrf", ""); setValue("iss", ""); setValue("inss", ""); setValue("sestSenat", ""); setValue("patronal", "");
    }
  }, [wValorPagamento, wAutoCalculate, wApplied.irrf, wApplied.iss, wApplied.inss, wApplied.sestSenat, wApplied.patronal, setValue]);

  const loadNe = async () => {
    const numero = watch("empenho");
    if (!numero?.trim()) { toast.error("Digite o número da NE para buscar."); return; }
    try {
      const apiData = await apiClient.get(`/api/notas-empenho?numero=${encodeURIComponent(numero.trim())}`);
      if (apiData && apiData.ne) {
        const ne = apiData.ne;
        setValue("empenho", ne.numero);
        setValue("saldoAnterior", Number(ne.saldoDisponivel) || 0); // pega o saldo ja com os pagamentos abatidos
        setValue("valorEmpenho", Number(ne.valor) || 0);
        setValue("historico", ne.historico || '');
        setValue("unidadeOrcamentaria", ne.unidadeOrcamentaria || '');
        setValue("gestao", ne.gestao || '');

        // se ainda tiver saldo disponivel, pre-preenche o valor sugerido
        setValue("valorPagamento", Number(ne.saldoDisponivel) || 0);

        // preenche o primeiro item do formulario com o historico da NE
        replace([{
          especificacao: ne.historico || 'Pagamento referente ao empenho ' + ne.numero,
          quantidade: 1,
          unidade: 'UN',
          valorUnitario: Number(ne.saldoDisponivel) || 0
        }]);

        toast.success(`Dados da NE ${ne.numero} carregados.`);
        return;
      }
    } catch { }
    toast.error('NE não encontrada.');
  };

  const handleNovaOp = () => {
    reset({
      numeroNe: "", empenho: "", numeroCheque: "", nomeCredor: "", cpfCnpj: "", rgCredor: "", enderecoCredor: "",
      unidadeOrcamentaria: "", elementoSubelemento: "", gestao: "", historico: "",
      itens: [{ especificacao: "", quantidade: 1, unidade: "UN", valorUnitario: 0 }],
      dataEmissao: new Date().toISOString().split('T')[0], dataPagamento: "", contaBancaria: "",
      valorPagamento: 0, saldoAnterior: 0, valorEmpenho: 0,
      irrf: 0, iss: 0, inss: 0, sestSenat: 0, patronal: 0, outrosDescontos: 0,
      autoCalculate: true, appliedTax_irrf: true, appliedTax_iss: true, appliedTax_inss: true,
    });
    setEditingId(null);
    setSelecionadoId(null);
  };

  const onSubmit = async (data: any) => {
    setIsSaving(true);
    try {
      const vp = Number(data.valorPagamento);
      const saldo = Number(data.saldoAnterior);

      if (vp > saldo) {
        toast.error(`O valor do pagamento (R$ ${vp.toFixed(2)}) não pode ser maior que o saldo anterior da NE (R$ ${saldo.toFixed(2)})`);
        setIsSaving(false);
        return;
      }

      const totalDesc = Number(data.irrf || 0) + Number(data.iss || 0) + Number(data.inss || 0) +
        Number(data.sestSenat || 0) + Number(data.patronal || 0) + Number(data.outrosDescontos || 0);
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
        elementoSubelemento: data.elementoSubelemento,
        gestao: data.gestao,
        saldoAnterior: data.saldoAnterior,
        valorEmpenho: data.valorEmpenho,
        valorPagamento: data.valorPagamento,
        irrf: data.irrf,
        iss: data.iss,
        inss: data.inss,
        sestSenat: data.sestSenat,
        patronal: data.patronal,
        outrosDescontos: data.outrosDescontos,
        totalDescontos: totalDesc,
        valorLiquido: vLiquido,
        dataEmissao: data.dataEmissao,
        dataPagamento: data.dataPagamento,
        historico: data.itens && data.itens.length > 0 ? data.itens.map((i: any) => i.especificacao).join(' | ') : data.historico,
        itemUnidade: data.itens && data.itens[0] ? data.itens[0].unidade : undefined,
        itemQuantidade: data.itens && data.itens[0] ? data.itens[0].quantidade : undefined,
        itemValorUnitario: data.itens && data.itens[0] ? data.itens[0].valorUnitario : undefined,
        itemUnidade2: data.itens && data.itens[1] ? data.itens[1].unidade : undefined,
        itemQuantidade2: data.itens && data.itens[1] ? data.itens[1].quantidade : undefined,
        itemValorUnitario2: data.itens && data.itens[1] ? data.itens[1].valorUnitario : undefined,
        liquidacao_id: null,
      };

      let responseData: any;
      if (editingId) {
        responseData = await apiClient.put(`/api/ordens-pagamento/${editingId}`, payload);
      } else {
        responseData = await apiClient.post("/api/ordens-pagamento", payload);
      }

      toast.success(editingId ? "OP atualizada com sucesso!" : "Ordem de Pagamento salva com sucesso!");
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

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const parseLocalNumber = (val: any) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const clean = String(val).replace(/[^\d,-]/g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  };

  const totalDescontos = parseLocalNumber(wDesc.irrf) + parseLocalNumber(wDesc.iss) + parseLocalNumber(wDesc.inss) + parseLocalNumber(wDesc.sestSenat) + parseLocalNumber(wDesc.patronal) + parseLocalNumber(wDesc.outrosDescontos);
  const liquidoOrdem = (Number(wValorPagamento) || 0) - totalDescontos;
  const saldoAtual = Number(watch("saldoAnterior")) || 0;
  const valorPg = Number(wValorPagamento) || 0;
  const ultrapassouSaldo = valorPg > saldoAtual;

  const filteredOps = ops.filter(o =>
    (o.credorNome || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.numeroNe || "").includes(searchTerm)
  );

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
            <button
              onClick={handleNovaOp}
              className="bg-blue-900 hover:bg-blue-800 text-white text-sm font-bold py-2.5 px-5 rounded-xl shadow-sm transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Nova OP
            </button>
            <button
              onClick={handleSubmit(onSubmit)}
              disabled={isSaving}
              className="bg-blue-900 hover:bg-blue-800 text-white text-sm font-bold py-2.5 px-5 rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {isSaving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>

        {/* INDICADOR DE SALDO */}
        {watch("empenho") && (
          <div className={`p-4 rounded-xl border flex items-center gap-4 ${ultrapassouSaldo ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
            {ultrapassouSaldo ? <AlertTriangle className="w-6 h-6" /> : <Wallet className="w-6 h-6" />}
            <div>
              <p className="text-sm font-bold uppercase tracking-widest opacity-80">Saldo Anterior da NE</p>
              <p className="text-2xl font-black">{formatCurrency(saldoAtual)}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-sm font-bold uppercase tracking-widest opacity-80">Saldo Restante Após Pagamento</p>
              <p className="text-xl font-bold">{formatCurrency(saldoAtual - valorPg)}</p>
            </div>
          </div>
        )}

        {/* DADOS DO PAGAMENTO (Glass Panel) */}
        <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
          <div className="flex items-center mb-8 pb-4 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-900 mr-3">
              <Wallet className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">
              Dados do Pagamento
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

            <div className="col-span-12 md:col-span-3">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Número da OP</label>
              <input type="text" placeholder="2024.OP.00452" {...register("numeroNe")} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-800 transition-all duration-300" />
            </div>
            <div className="col-span-12 md:col-span-3">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Data Emissão OP</label>
              <input type="date" {...register("dataEmissao")} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-800 transition-all duration-300" />
            </div>
            <div className="col-span-12 md:col-span-3">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Nº do Cheque</label>
              <input type="text" placeholder="Ex: 852963" {...register("numeroCheque")} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-800 transition-all duration-300" />
            </div>
            <div className="col-span-12 md:col-span-3">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Data do Pagamento</label>
              <input type="date" {...register("dataPagamento")} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-800 transition-all duration-300" />
            </div>

            <div className="col-span-12 md:col-span-4">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Nota de Empenho (NE)</label>
              <div className="relative flex">
                <input type="text" placeholder="Buscar NE..." {...register("empenho")} className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-800 transition-all duration-300" />
                <button onClick={loadNe} type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Search className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="col-span-12 md:col-span-4">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Unid. Orçamentária</label>
              <input type="text" {...register("unidadeOrcamentaria")} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-800 transition-all duration-300" />
            </div>

            <div className="col-span-12 md:col-span-4">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Gestão</label>
              <input type="text" {...register("gestao")} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-800 transition-all duration-300" />
            </div>

            <div className="col-span-12">
              <div className="flex items-center mb-4 mt-4 pb-2 border-b border-slate-100">
                <div className="w-6 h-6 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 mr-2"><User className="w-3 h-3" /></div>
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest">Favorecido</h3>
              </div>
            </div>

            <div className="col-span-12 md:col-span-3">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">CPF/CNPJ</label>
              <input type="text" placeholder="Apenas números..." {...register("cpfCnpj")} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-800 transition-all duration-300" />
            </div>

            <div className="col-span-12 md:col-span-5">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Nome do Credor</label>
              <input type="text" {...register("nomeCredor")} className="w-full px-4 py-3 rounded-xl border border-blue-100 bg-blue-50 text-blue-900 font-bold focus:border-blue-800 transition-all duration-300" />
            </div>

            <div className="col-span-12 md:col-span-2">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">RG</label>
              <input type="text" {...register("rgCredor")} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-800 transition-all duration-300" />
            </div>

            <div className="col-span-12 md:col-span-2">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Endereço</label>
              <input type="text" {...register("enderecoCredor")} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-800 transition-all duration-300" />
            </div>

            <div className="col-span-12 md:col-span-4 mt-4">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Valor a Pagar R$</label>
              <input type="text" placeholder="0.00" {...register("valorPagamento")} className={`w-full px-4 py-3 rounded-xl border text-lg font-black focus:outline-none focus:ring-4 transition-all duration-300 ${ultrapassouSaldo ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-emerald-700 focus:border-emerald-400 focus:ring-emerald-500/10'}`} />
            </div>

            <div className="col-span-12 mt-4">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest">Especificação do que está sendo pago</h3>
                <button
                  type="button"
                  onClick={() => append({ especificacao: "", quantidade: 1, unidade: "UN", valorUnitario: 0 })}
                  className="bg-blue-50 text-blue-900 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Adicionar Item
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest w-12">Item</th>
                      <th className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest">Especificação</th>
                      <th className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest w-24">Quant.</th>
                      <th className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest w-24">Unid.</th>
                      <th className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest w-32">V. Unitário</th>
                      <th className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest w-32">V. Total</th>
                      <th className="pb-2 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, index) => {
                      const qty = watch(`itens.${index}.quantidade`) || 0;
                      const unitVal = watch(`itens.${index}.valorUnitario`) || 0;
                      const total = Number(qty) * Number(unitVal);
                      return (
                        <tr key={field.id} className="border-b border-slate-50 last:border-0">
                          <td className="py-3 font-bold text-slate-400">{index + 1}</td>
                          <td className="py-3 pr-2">
                            <input
                              type="text"
                              {...register(`itens.${index}.especificacao` as const)}
                              placeholder="Descrição do item"
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:border-blue-800 transition-colors text-sm"
                            />
                          </td>
                          <td className="py-3 pr-2">
                            <input
                              type="number"
                              {...register(`itens.${index}.quantidade` as const)}
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:border-blue-800 transition-colors text-sm"
                            />
                          </td>
                          <td className="py-3 pr-2">
                            <input
                              type="text"
                              {...register(`itens.${index}.unidade` as const)}
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:border-blue-800 transition-colors text-sm"
                            />
                          </td>
                          <td className="py-3 pr-2">
                            <input
                              type="text"
                              placeholder="0,00"
                              {...register(`itens.${index}.valorUnitario` as const, {
                                onChange: (e) => e.target.value = maskCurrency(e.target.value)
                              })}
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:border-blue-800 transition-colors text-sm"
                            />
                          </td>
                          <td className="py-3 font-bold text-slate-700">
                            {formatCurrency(total)}
                          </td>
                          <td className="py-3 text-right">
                            <button
                              type="button"
                              onClick={() => remove(index)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* RETENÇÕES E DESCONTOS */}
        <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 mr-3"><Calculator className="w-4 h-4" /></div>
              <h2 className="text-lg font-bold text-slate-800">Retenções e Descontos</h2>
            </div>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
              <label className="flex items-center cursor-pointer">
                <input type="checkbox" {...register("autoCalculate")} className="mr-2 rounded text-indigo-600 focus:ring-indigo-500" /> Cálculo Automático
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
            <div>
              <label className="flex items-center text-sm font-black text-slate-500 uppercase tracking-widest mb-2"><input type="checkbox" {...register("appliedTax_irrf")} className="mr-1.5 rounded text-blue-900" /> IRRF</label>
              <input type="text" placeholder="0,00" {...register("irrf", { onChange: e => e.target.value = maskCurrency(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-400" />
            </div>
            <div>
              <label className="flex items-center text-sm font-black text-slate-500 uppercase tracking-widest mb-2"><input type="checkbox" {...register("appliedTax_iss")} className="mr-1.5 rounded text-blue-900" /> ISS</label>
              <input type="text" placeholder="0,00" {...register("iss", { onChange: e => e.target.value = maskCurrency(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-400" />
            </div>
            <div>
              <label className="flex items-center text-sm font-black text-slate-500 uppercase tracking-widest mb-2"><input type="checkbox" {...register("appliedTax_inss")} className="mr-1.5 rounded text-blue-900" /> INSS</label>
              <input type="text" placeholder="0,00" {...register("inss", { onChange: e => e.target.value = maskCurrency(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-400" />
            </div>
            <div>
              <label className="flex items-center text-sm font-black text-slate-500 uppercase tracking-widest mb-2"><input type="checkbox" {...register("appliedTax_patronal")} className="mr-1.5 rounded text-blue-900" /> PATRONAL</label>
              <input type="text" placeholder="0,00" {...register("patronal", { onChange: e => e.target.value = maskCurrency(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-400" />
            </div>
            <div>
              <label className="flex items-center text-sm font-black text-slate-500 uppercase tracking-widest mb-2"><input type="checkbox" {...register("appliedTax_sestSenat")} className="mr-1.5 rounded text-blue-900" /> SEST/SENAT</label>
              <input type="text" placeholder="0,00" {...register("sestSenat", { onChange: e => e.target.value = maskCurrency(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-400" />
            </div>
            <div>
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Outros</label>
              <input type="text" placeholder="0,00" {...register("outrosDescontos", { onChange: e => e.target.value = maskCurrency(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-400" />
            </div>
          </div>

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
        </div>

        {/* DATA TABLE */}
        <div className="pb-12 mt-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800 text-xl tracking-tight">Ordens Recentes</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-4 pl-2 text-sm font-black text-slate-500 uppercase tracking-widest">Número OP</th>
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">NE Ref.</th>
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">Favorecido</th>
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">Data Pgto</th>
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest text-right">Valor (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ops.map((op) => (
                  <tr key={op.id} className="group hover:bg-blue-50/50 transition-colors">
                    <td className="py-5 font-bold text-blue-900 rounded-l-lg pl-2">{op.numeroNe || "-"}</td>
                    <td className="py-5 font-semibold text-slate-500">{op.numeroEmpenho || "-"}</td>
                    <td className="py-5 font-semibold text-slate-700">{op.credorNome || "-"}</td>
                    <td className="py-5 font-medium text-slate-500">{op.dataPagamento ? new Date(op.dataPagamento).toLocaleDateString('pt-BR') : "-"}</td>
                    <td className="py-5 font-black text-slate-800 text-right">{formatCurrency(Number(op.valorPagamento) || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
