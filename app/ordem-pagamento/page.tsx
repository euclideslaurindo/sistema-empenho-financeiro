"use client";
import { useState, useEffect, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Save, Search, Wallet, Calculator, Eye, Printer, AlertTriangle, XCircle, User, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { maskCurrency, parseFormNumber } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";

const transformNumber = z.union([z.string(), z.number()]).transform(val => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  const clean = String(val).replace(/[^\d,-]/g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}).optional();

const ordemPagamentoSchema = z.object({
  numeroNe: z.string().optional(), // Gerado automaticamente pelo backend
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

  const [neSuggestions, setNeSuggestions] = useState<any[]>([]);
  const [showNeSuggestions, setShowNeSuggestions] = useState(false);
  const [searchNeTimeout, setSearchNeTimeout] = useState<NodeJS.Timeout | null>(null);

  const [credorSuggestions, setCredorSuggestions] = useState<any[]>([]);
  const [showCredorSuggestions, setShowCredorSuggestions] = useState(false);
  const [searchCredorTimeout, setSearchCredorTimeout] = useState<NodeJS.Timeout | null>(null);

  // estados para o autocomplete do campo CPF/CNPJ (busca credores por documento)
  const [cpfSuggestions, setCpfSuggestions] = useState<any[]>([]);
  const [showCpfSuggestions, setShowCpfSuggestions] = useState(false);

  const [userRole, setUserRole] = useState<string>("GESTOR");
  const [lastSavedNe, setLastSavedNe] = useState<string | null>(null);

  // helper que converte string mascarada (ex: "1.500,00") para number corretamente
  const parseFormNumber = (val: any): number => {
    if (!val && val !== 0) return 0;
    if (typeof val === 'number') return val;
    const clean = String(val).replace(/\./g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  };

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

  // busca credor pelo CPF/CNPJ enquanto o usuario digita (a partir de 4 digitos)
  const handleCpfChange = (val: string) => {
    setValue("cpfCnpj", val);
    setCpfSuggestions([]);
    setShowCpfSuggestions(false);
    if (searchCredorTimeout) clearTimeout(searchCredorTimeout);
    const digits = val.replace(/\D/g, '');
    if (digits.length >= 4) {
      setSearchCredorTimeout(setTimeout(async () => {
        try {
          const data = await apiClient.get(`/api/credores?busca=${encodeURIComponent(val)}&limit=8`);
          if (data?.credores?.length > 0) {
            setCpfSuggestions(data.credores);
            setShowCpfSuggestions(true);
          }
        } catch {}
      }, 350));
    }
  };

  // busca sugestoes de credores conforme o usuario digita o nome
  const handleCredorNameChange = (val: string) => {
    setValue("nomeCredor", val);
    if (searchCredorTimeout) clearTimeout(searchCredorTimeout);
    if (val.length >= 2) {
      setSearchCredorTimeout(setTimeout(async () => {
        try {
          const data = await apiClient.get(`/api/credores?busca=${encodeURIComponent(val)}&limit=8`);
          if (data && data.credores && data.credores.length > 0) {
            setCredorSuggestions(data.credores);
            setShowCredorSuggestions(true);
          } else {
            setCredorSuggestions([]);
            setShowCredorSuggestions(false);
          }
        } catch (err) {}
      }, 350));
    } else {
      setCredorSuggestions([]);
      setShowCredorSuggestions(false);
    }
  };

  const selectCredor = (credor: any) => {
    setValue("nomeCredor", credor.nome);
    setValue("cpfCnpj", credor.cpf_cnpj || credor.cpfCnpj || '');
    setValue("rgCredor", credor.rg || '');
    setValue("enderecoCredor", credor.endereco || '');
    setCredorSuggestions([]);
    setShowCredorSuggestions(false);
  };

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

  // watch reativo dos itens para calcular o total em tempo real
  const wItens = watch("itens") || [];
  const totalItens = wItens.reduce((acc: number, item: any) => {
    return acc + (Number(item?.quantidade) || 0) * parseFormNumber(item?.valorUnitario);
  }, 0);

  // propaga o total dos itens para o campo valorPagamento e recalcula descontos
  const handleConfirmarItens = () => {
    if (totalItens <= 0) {
      toast.error('Preencha ao menos um item com quantidade e valor unitário.');
      return;
    }
    const formatado = maskCurrency(totalItens);
    setValue('valorPagamento', formatado as any, { shouldDirty: true, shouldValidate: true });
    toast.success(`Valor a Pagar atualizado para ${formatCurrency(totalItens)}`);
  };

  useEffect(() => {
    // debounce de 350ms: so recalcula quando usuario para de digitar
    // evita valores intermediarios bugados ao apagar digito por digito
    const timer = setTimeout(() => {
      const vp = parseFormNumber(wValorPagamento);
      if (wAutoCalculate && vp > 0) {
        // maskCurrency recebe number em REAIS (ex: 150.0) e formata corretamente
        setValue("irrf",      wApplied.irrf      ? maskCurrency(vp * 0.015)  : "");
        setValue("iss",       wApplied.iss       ? maskCurrency(vp * 0.05)   : "");
        setValue("inss",      wApplied.inss      ? maskCurrency(vp * 0.11)   : "");
        setValue("sestSenat", wApplied.sestSenat ? maskCurrency(vp * 0.025)  : "");
        setValue("patronal",  wApplied.patronal  ? maskCurrency(vp * 0.20)   : "");
      } else if (wAutoCalculate && vp === 0) {
        setValue("irrf", ""); setValue("iss", ""); setValue("inss", "");
        setValue("sestSenat", ""); setValue("patronal", "");
      }
    }, 350);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wValorPagamento, wAutoCalculate, wApplied.irrf, wApplied.iss, wApplied.inss, wApplied.sestSenat, wApplied.patronal, setValue]);

  // aceita numero opcional para evitar race condition quando chamado do selectNe
  const loadNe = async (overrideNumero?: string) => {
    const raw = overrideNumero || watch("empenho");
    const numero = raw != null ? String(raw).trim() : '';
    if (!numero) { toast.error("Digite o número da NE para buscar."); return; }
    try {
      const apiData = await apiClient.get(`/api/notas-empenho?numero=${encodeURIComponent(numero)}`);
      if (apiData && apiData.ne) {
        const ne = apiData.ne;
        setValue("empenho", ne.numero);
        setValue("saldoAnterior", Number(ne.saldoDisponivel) || 0);
        setValue("valorEmpenho", Number(ne.valor) || 0);
        setValue("historico", ne.historico || '');
        setValue("unidadeOrcamentaria", ne.unidadeOrcamentaria || '');
        setValue("gestao", ne.gestao || '');

        // formata o valor como moeda BR para o input exibir corretamente
        const saldoFormatado = maskCurrency(Number(ne.saldoDisponivel) || 0);
        setValue("valorPagamento", saldoFormatado as any);

        // preenche o primeiro item com valores ja formatados (parseFormNumber lida corretamente)
        replace([{
          especificacao: ne.historico || 'Pagamento referente ao empenho ' + ne.numero,
          quantidade: 1,
          unidade: 'UN',
          valorUnitario: saldoFormatado as any
        }]);

        toast.success(`Dados da NE ${ne.numero} carregados.`);
        return;
      }
    } catch { }
    toast.error('NE não encontrada.');
  };

  const handleNeSearchChange = (val: string) => {
    setValue("empenho", val);
    
    if (searchNeTimeout) clearTimeout(searchNeTimeout);
    
    if (val.length >= 2) {
      setSearchNeTimeout(setTimeout(async () => {
        try {
          const data = await apiClient.get(`/api/notas-empenho?busca=${encodeURIComponent(val)}&limit=10`);
          if (data && data.notas) {
            setNeSuggestions(data.notas);
            setShowNeSuggestions(true);
          }
        } catch (err) {}
      }, 400));
    } else {
      setNeSuggestions([]);
      setShowNeSuggestions(false);
    }
  };

  const selectNe = (ne: any) => {
    setValue("empenho", ne.numero);
    setNeSuggestions([]);
    setShowNeSuggestions(false);
    // passa o numero diretamente para evitar race condition com o watch("empenho")
    loadNe(ne.numero);
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
      const vp = parseFormNumber(data.valorPagamento);
      const saldo = parseFormNumber(data.saldoAnterior);

      if (vp <= 0) {
        toast.error('O valor a pagar deve ser maior que zero.');
        setIsSaving(false);
        return;
      }

      if (vp > saldo && saldo > 0) {
        toast.error(`O valor do pagamento (${formatCurrency(vp)}) não pode ser maior que o saldo anterior da NE (${formatCurrency(saldo)})`);
        setIsSaving(false);
        return;
      }

      const totalDesc = parseFormNumber(data.irrf) + parseFormNumber(data.iss) + parseFormNumber(data.inss) +
        parseFormNumber(data.sestSenat) + parseFormNumber(data.patronal) + parseFormNumber(data.outrosDescontos);

      if (totalDesc > vp) {
        toast.error(`Total de descontos (${formatCurrency(totalDesc)}) não pode ser maior que o valor a pagar (${formatCurrency(vp)}).`);
        setIsSaving(false);
        return;
      }

      // Validação da Especificação (Itens)
      let totalItens = 0;
      if (data.itens && data.itens.length > 0) {
        data.itens.forEach((item: any) => {
          totalItens += Number(item.quantidade || 0) * parseFormNumber(item.valorUnitario);
        });
      }

      if (totalItens !== vp && totalItens > 0) {
        toast.error(`O valor total dos itens especificados (${formatCurrency(totalItens)}) deve ser exatamente igual ao valor a pagar (${formatCurrency(vp)}).`);
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
        elementoSubelemento: data.elementoSubelemento,
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
        itemUnidade: data.itens && data.itens[0] ? data.itens[0].unidade : undefined,
        itemQuantidade: data.itens && data.itens[0] ? parseFormNumber(data.itens[0].quantidade) : undefined,
        itemValorUnitario: data.itens && data.itens[0] ? parseFormNumber(data.itens[0].valorUnitario) : undefined,
        itemUnidade2: data.itens && data.itens[1] ? data.itens[1].unidade : undefined,
        itemQuantidade2: data.itens && data.itens[1] ? parseFormNumber(data.itens[1].quantidade) : undefined,
        itemValorUnitario2: data.itens && data.itens[1] ? parseFormNumber(data.itens[1].valorUnitario) : undefined,
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

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const parseLocalNumber = (val: any) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const clean = String(val).replace(/[^\d,-]/g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  };

  const totalDescontos = parseFormNumber(wDesc.irrf) + parseFormNumber(wDesc.iss) + parseFormNumber(wDesc.inss) + parseFormNumber(wDesc.sestSenat) + parseFormNumber(wDesc.patronal) + parseFormNumber(wDesc.outrosDescontos);
  const valorPg = parseFormNumber(wValorPagamento);
  // usa o total dos itens como base se estiver preenchido, caso contrário usa valorPagamento
  const baseCalculo = totalItens > 0 ? totalItens : valorPg;
  const liquidoOrdem = baseCalculo - totalDescontos;
  const saldoAtual = Number(watch("saldoAnterior")) || 0;
  const ultrapassouSaldo = valorPg > saldoAtual && saldoAtual > 0;

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
              onClick={handleSubmit(onSubmit, (erros) => {
                const primeiroErro = Object.values(erros)[0] as any;
                const msg = primeiroErro?.message || primeiroErro?.root?.message || 'Preencha todos os campos obrigatórios.';
                toast.error(`Erro de validação: ${msg}`);
              })}
              disabled={isSaving}
              className="bg-blue-900 hover:bg-blue-800 text-white text-sm font-bold py-2.5 px-5 rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {isSaving ? "Salvando..." : "Salvar"}
            </button>
            {lastSavedNe && (
              <a
                href={`/consulta-impressao?ne=${lastSavedNe}`}
                target="_blank"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-2.5 px-5 rounded-xl shadow-sm transition-all flex items-center gap-2"
              >
                <Printer className="w-4 h-4" /> Imprimir OP
              </a>
            )}
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
              <input type="text" placeholder="Gerado automaticamente" disabled className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed transition-all duration-300" />
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

            <div className="col-span-12 md:col-span-4 relative">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Nota de Empenho (NE)</label>
              <div className="relative flex">
                <input 
                  type="text" 
                  placeholder="Buscar NE (ex: 2024NE000123)" 
                  {...register("empenho")}
                  onChange={(e) => handleNeSearchChange(e.target.value)}
                  onFocus={() => { if(watch("empenho")?.length >= 2) setShowNeSuggestions(true); }}
                  onBlur={() => setTimeout(() => setShowNeSuggestions(false), 200)}
                  className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-800 transition-all duration-300" 
                />
                <button onClick={loadNe} type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Search className="w-4 h-4" /></button>
              </div>
              {showNeSuggestions && neSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 max-h-60 overflow-y-auto">
                  {neSuggestions.map(ne => (
                    <div 
                      key={ne.id} 
                      onClick={() => selectNe(ne)}
                      className="p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors"
                    >
                      <div className="font-bold text-slate-700">{ne.numero}</div>
                      <div className="text-xs text-slate-500 truncate">{ne.historico || 'Sem especificação'}</div>
                      <div className="text-xs font-black text-emerald-600 mt-1">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(ne.saldoDisponivel)} disponível</div>
                    </div>
                  ))}
                </div>
              )}
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

            <div className="col-span-12 md:col-span-3 relative">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">CPF/CNPJ</label>
              <input
                type="text"
                placeholder="Digite para buscar..."
                {...register("cpfCnpj")}
                onChange={(e) => handleCpfChange(e.target.value)}
                onBlur={() => setTimeout(() => setShowCpfSuggestions(false), 200)}
                onFocus={() => { if (watch("cpfCnpj")?.replace(/\D/g,'').length >= 4) setShowCpfSuggestions(true); }}
                className={`w-full px-4 py-3 rounded-xl border bg-slate-50 focus:border-blue-800 transition-all duration-300 ${errors.cpfCnpj ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
              />
              {errors.cpfCnpj && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.cpfCnpj.message}</p>}
              {showCpfSuggestions && cpfSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-xl border border-slate-100 max-h-52 overflow-y-auto">
                  {cpfSuggestions.map((c: any) => (
                    <div
                      key={c.id}
                      onMouseDown={() => { selectCredor(c); setCpfSuggestions([]); setShowCpfSuggestions(false); }}
                      className="p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors"
                    >
                      <div className="font-bold text-slate-800 text-sm">{c.nome}</div>
                      <div className="text-xs text-slate-500">{c.cpf_cnpj || c.cpfCnpj}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="col-span-12 md:col-span-5 relative">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Nome do Credor</label>
              <input
                type="text"
                placeholder="Digite o nome para buscar..."
                {...register("nomeCredor")}
                onChange={(e) => handleCredorNameChange(e.target.value)}
                onBlur={() => setTimeout(() => setShowCredorSuggestions(false), 200)}
                onFocus={() => { if (watch("nomeCredor")?.length >= 2) setShowCredorSuggestions(true); }}
                className={`w-full px-4 py-3 rounded-xl border bg-blue-50 text-blue-900 font-bold focus:border-blue-800 transition-all duration-300 ${errors.nomeCredor ? 'border-red-400 bg-red-50 text-slate-900' : 'border-blue-100'}`}
              />
              {errors.nomeCredor && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.nomeCredor.message}</p>}
              {showCredorSuggestions && credorSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-xl border border-slate-100 max-h-52 overflow-y-auto">
                  {credorSuggestions.map((c: any) => (
                    <div
                      key={c.id}
                      onMouseDown={() => selectCredor(c)}
                      className="p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors"
                    >
                      <div className="font-bold text-slate-800 text-sm">{c.nome}</div>
                      <div className="text-xs text-slate-500">{c.cpf_cnpj || c.cpfCnpj}</div>
                    </div>
                  ))}
                </div>
              )}
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
              <input 
                type="text" 
                placeholder="0,00" 
                {...register("valorPagamento", {
                  onChange: (e) => {
                    e.target.value = maskCurrency(e.target.value);
                  }
                })} 
                className={`w-full px-4 py-3 rounded-xl border text-lg font-black focus:outline-none focus:ring-4 transition-all duration-300 ${ultrapassouSaldo ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-emerald-700 focus:border-emerald-400 focus:ring-emerald-500/10'}`} 
              />
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
                      // usa parseFormNumber para lidar corretamente com a máscara "1.500,00"
                      const total = Number(qty) * parseFormNumber(unitVal);
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
                              onChange={(e) => {
                                setValue(`itens.${index}.quantidade`, e.target.value, { shouldValidate: true, shouldDirty: true });
                              }}
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
                              {...register(`itens.${index}.valorUnitario` as const)}
                              onChange={(e) => {
                                const val = maskCurrency(e.target.value);
                                e.target.value = val;
                                setValue(`itens.${index}.valorUnitario`, val, { shouldValidate: true, shouldDirty: true });
                              }}
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

                {/* RODAPÉ REATIVO DOS ITENS */}
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-500 uppercase tracking-widest">V. Total dos Itens:</span>
                    <span className={`text-lg font-black ${
                      totalItens !== valorPg && valorPg > 0 ? 'text-red-600' : 'text-slate-800'
                    }`}>
                      {formatCurrency(totalItens)}
                    </span>
                    {totalItens !== valorPg && valorPg > 0 && (
                      <span className="text-xs text-red-500 font-bold ml-1">⚠ Deve ser exatamente igual ao Valor a Pagar</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleConfirmarItens}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest px-4 py-2 rounded-lg shadow-sm transition-all flex items-center gap-2"
                  >
                    ✔ Confirmar Itens
                  </button>
                </div>
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
                <input type="checkbox" disabled={userRole !== 'ADMIN'} {...register("autoCalculate")} className="mr-2 rounded text-indigo-600 focus:ring-indigo-500 disabled:opacity-50" /> Cálculo Automático
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
            <div>
              <label className="flex items-center text-sm font-black text-slate-500 uppercase tracking-widest mb-2"><input type="checkbox" disabled={userRole !== 'ADMIN'} {...register("appliedTax_irrf")} className="mr-1.5 rounded text-blue-900 disabled:opacity-50" /> IRRF</label>
              <input type="text" placeholder="0,00" disabled={userRole !== 'ADMIN'} {...register("irrf", { onChange: e => e.target.value = maskCurrency(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-400 disabled:opacity-70 disabled:cursor-not-allowed" />
            </div>
            <div>
              <label className="flex items-center text-sm font-black text-slate-500 uppercase tracking-widest mb-2"><input type="checkbox" disabled={userRole !== 'ADMIN'} {...register("appliedTax_iss")} className="mr-1.5 rounded text-blue-900 disabled:opacity-50" /> ISS</label>
              <input type="text" placeholder="0,00" disabled={userRole !== 'ADMIN'} {...register("iss", { onChange: e => e.target.value = maskCurrency(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-400 disabled:opacity-70 disabled:cursor-not-allowed" />
            </div>
            <div>
              <label className="flex items-center text-sm font-black text-slate-500 uppercase tracking-widest mb-2"><input type="checkbox" disabled={userRole !== 'ADMIN'} {...register("appliedTax_inss")} className="mr-1.5 rounded text-blue-900 disabled:opacity-50" /> INSS</label>
              <input type="text" placeholder="0,00" disabled={userRole !== 'ADMIN'} {...register("inss", { onChange: e => e.target.value = maskCurrency(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-400 disabled:opacity-70 disabled:cursor-not-allowed" />
            </div>
            <div>
              <label className="flex items-center text-sm font-black text-slate-500 uppercase tracking-widest mb-2"><input type="checkbox" disabled={userRole !== 'ADMIN'} {...register("appliedTax_patronal")} className="mr-1.5 rounded text-blue-900 disabled:opacity-50" /> PATRONAL</label>
              <input type="text" placeholder="0,00" disabled={userRole !== 'ADMIN'} {...register("patronal", { onChange: e => e.target.value = maskCurrency(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-400 disabled:opacity-70 disabled:cursor-not-allowed" />
            </div>
            <div>
              <label className="flex items-center text-sm font-black text-slate-500 uppercase tracking-widest mb-2"><input type="checkbox" disabled={userRole !== 'ADMIN'} {...register("appliedTax_sestSenat")} className="mr-1.5 rounded text-blue-900 disabled:opacity-50" /> SEST/SENAT</label>
              <input type="text" placeholder="0,00" disabled={userRole !== 'ADMIN'} {...register("sestSenat", { onChange: e => e.target.value = maskCurrency(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-400 disabled:opacity-70 disabled:cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Outros</label>
              <input type="text" placeholder="0,00" disabled={userRole !== 'ADMIN'} {...register("outrosDescontos", { onChange: e => e.target.value = maskCurrency(e.target.value) })} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-400 disabled:opacity-70 disabled:cursor-not-allowed" />
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

        {/* BARRA DE AÇÕES INFERIOR - sticky para facilitar navegação */}
        <div className="sticky bottom-4 z-40">
          <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/10 px-6 py-4 flex items-center justify-between gap-4">

            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={handleNovaOp}
                className="bg-white/10 hover:bg-white/20 text-white text-sm font-bold py-2.5 px-5 rounded-xl transition-all flex items-center gap-2 border border-white/10"
              >
                <Plus className="w-4 h-4" /> Nova OP
              </button>
              <button
                onClick={handleSubmit(onSubmit, (erros) => {
                  const primeiroErro = Object.values(erros)[0] as any;
                  const msg = primeiroErro?.message || primeiroErro?.root?.message || 'Preencha todos os campos obrigatórios.';
                  toast.error(`Erro de validação: ${msg}`);
                })}
                disabled={isSaving}
                className="bg-blue-500 hover:bg-blue-400 text-white text-sm font-bold py-2.5 px-6 rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> {isSaving ? "Salvando..." : "Salvar OP"}
              </button>
              {lastSavedNe && (
                <a
                  href={`/consulta-impressao?ne=${lastSavedNe}`}
                  target="_blank"
                  className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold py-2.5 px-5 rounded-xl shadow-lg transition-all flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" /> Imprimir
                </a>
              )}
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
