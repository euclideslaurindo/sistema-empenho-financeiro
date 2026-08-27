"use client";
import { useState, useEffect, useCallback } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Save,
  Search,
  Wallet,
  Calculator,
  Eye,
  Printer,
  AlertTriangle,
  XCircle
} from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";

const ordemPagamentoSchema = z.object({
  numeroNe: z.string().min(1, "Obrigatório"),
  empenho: z.string().min(1, "Obrigatório"),
  nomeCredor: z.string().min(1, "Obrigatório"),
  cpfCnpj: z.string().min(1, "Obrigatório"),
  valorEmpenho: z.number().optional(),
  saldoAnterior: z.number().optional(),
  historico: z.string().optional(),
  dataEmissao: z.string().min(1, "Obrigatório"),
  contaBancaria: z.string().optional(),
  
  valorPagamento: z.union([z.string(), z.number()]).transform(val => {
    if (typeof val === 'number') return val;
    const clean = String(val).replace(/[^\d,-]/g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  }).refine(val => val > 0, { message: "Deve ser maior que zero." }),

  irrf: z.number().optional(),
  iss: z.number().optional(),
  inss: z.number().optional(),
  sestSenat: z.number().optional(),
  patronal: z.number().optional(),
  outrosDescontos: z.number().optional(),

  autoCalculate: z.boolean().optional(),
  appliedTax_irrf: z.boolean().optional(),
  appliedTax_iss: z.boolean().optional(),
  appliedTax_inss: z.boolean().optional(),
});

type OpFormValues = z.input<typeof ordemPagamentoSchema>;

export default function OrdemPagamento() {
  const { credores } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [ops, setOps] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  
  const { register, handleSubmit, watch, control, reset, setValue, formState: { errors } } = useForm<OpFormValues>({
    resolver: zodResolver(ordemPagamentoSchema),
    defaultValues: {
      numeroNe: "",
      empenho: "",
      nomeCredor: "",
      cpfCnpj: "",
      valorEmpenho: 0,
      saldoAnterior: 0,
      historico: "",
      dataEmissao: new Date().toISOString().split('T')[0],
      contaBancaria: "",
      valorPagamento: 0,
      irrf: 0, iss: 0, inss: 0, sestSenat: 0, patronal: 0, outrosDescontos: 0,
      autoCalculate: true,
      appliedTax_irrf: true, appliedTax_iss: true, appliedTax_inss: true,
    }
  });

  const fetchOps = useCallback(async (busca = "") => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/ordens-pagamento");
      const data = await res.json();
      if (res.ok) {
        setOps(data.ordens || []);
      } else {
        toast.error("Erro ao carregar Ordens.");
      }
    } catch {
      toast.error("Modo offline: Carregando dados Mock.");
      setOps([
        {
          id: "mock-1",
          numeroNe: "2024.00450",
          numeroEmpenho: "NE-0012/24",
          credorNome: "Construtora Alfa SA",
          dataEmissao: "2024-05-15",
          valorPagamento: 150000.00,
          status: "PAGO"
        },
        {
          id: "mock-2",
          numeroNe: "2024.00451",
          numeroEmpenho: "NE-0088/24",
          credorNome: "TechCorp Soluções em TI",
          dataEmissao: "2024-05-16",
          valorPagamento: 45200.00,
          status: "PENDENTE"
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOps();
  }, [fetchOps]);

  // Watches for calculation
  const wValorPagamento = watch("valorPagamento");
  const wAutoCalculate = watch("autoCalculate");
  const wApplied = {
    irrf: watch("appliedTax_irrf"),
    iss: watch("appliedTax_iss"),
    inss: watch("appliedTax_inss"),
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
      setValue("irrf", wApplied.irrf ? Number((vp * 0.015).toFixed(2)) : 0);
      setValue("iss", wApplied.iss ? Number((vp * 0.05).toFixed(2)) : 0);
      setValue("inss", wApplied.inss ? Number((vp * 0.11).toFixed(2)) : 0);
    } else if (wAutoCalculate && vp === 0) {
      setValue("irrf", 0); setValue("iss", 0); setValue("inss", 0);
    }
  }, [wValorPagamento, wAutoCalculate, wApplied.irrf, wApplied.iss, wApplied.inss, setValue]);

  const loadNe = async () => {
    const numero = watch("empenho");
    if (!numero?.trim()) { toast.error("Digite o número da NE para buscar."); return; }
    try {
      const res = await fetch(`/api/notas-empenho?numero=${encodeURIComponent(numero.trim())}`);
      const apiData = await res.json();
      if (res.ok && apiData.ne) {
        const ne = apiData.ne;
        setValue("empenho", ne.numero); 
        setValue("saldoAnterior", ne.valor || 0); 
        setValue("valorEmpenho", ne.valor || 0);
        setValue("historico", ne.historico || ''); 
        setValue("valorPagamento", ne.valor || 0);
        toast.success(`Dados da NE ${ne.numero} carregados.`);
        return;
      }
    } catch {}
    toast.error('NE não encontrada.');
  };

  const handleNovaOp = () => {
    reset({
      numeroNe: "", empenho: "", nomeCredor: "", cpfCnpj: "", valorEmpenho: 0,
      saldoAnterior: 0, historico: "", dataEmissao: new Date().toISOString().split('T')[0],
      contaBancaria: "", valorPagamento: 0, irrf: 0, iss: 0, inss: 0, sestSenat: 0, patronal: 0, outrosDescontos: 0,
      autoCalculate: true, appliedTax_irrf: true, appliedTax_iss: true, appliedTax_inss: true,
    });
    setEditingId(null);
    setSelecionadoId(null);
  };

  const handleCancelar = async () => {
    if (!editingId) {
      toast.error("Selecione uma OP na tabela primeiro para cancelar.");
      return;
    }
    if (!confirm("Tem certeza que deseja cancelar esta Ordem de Pagamento?")) return;
    
    try {
      const res = await fetch(`/api/ordens-pagamento/${editingId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast.success("Ordem de Pagamento cancelada com sucesso!");
      handleNovaOp();
      await fetchOps();
    } catch (err: any) {
      toast.error(err.message || "Erro ao cancelar a Ordem de Pagamento.");
    }
  };

  const onSubmit = async (data: any) => {
    setIsSaving(true);
    try {
      const payload = {
          numeroNe: data.numeroNe,
          numeroEmpenho: data.empenho,
          credorNome: data.nomeCredor,
          credorCpfCnpj: data.cpfCnpj,
          saldoAnterior: data.saldoAnterior,
          valorEmpenho: data.valorEmpenho,
          valorPagamento: data.valorPagamento,
          irrf: data.irrf, iss: data.iss, inss: data.inss,
          sestSenat: data.sestSenat, patronal: data.patronal, outrosDescontos: data.outrosDescontos,
          historico: data.historico,
          dataEmissao: data.dataEmissao,
      };

      let res: Response;
      if (editingId) {
        res = await fetch(`/api/ordens-pagamento/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/ordens-pagamento", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error);
      
      toast.success(editingId ? "OP atualizada com sucesso!" : "Ordem de Pagamento salva com sucesso!");
      handleNovaOp();
      await fetchOps();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar a Ordem de Pagamento.");
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  const totalDescontos = Number(wDesc.irrf) + Number(wDesc.iss) + Number(wDesc.inss) + Number(wDesc.sestSenat) + Number(wDesc.patronal) + Number(wDesc.outrosDescontos);
  const liquidoOrdem = (Number(wValorPagamento) || 0) - totalDescontos;

  const filteredOps = ops.filter(o => 
    (o.credorNome || "").toLowerCase().includes(searchTerm.toLowerCase()) || 
    (o.numeroNe || "").includes(searchTerm)
  );

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="p-8 max-w-[1400px] mx-auto w-full flex-1 space-y-8 animate-fade-in">
        
        {/* HEADER & ACTION BUTTONS */}
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
            <button 
              onClick={() => { document.getElementById('search-op-table')?.focus(); }}
              className="bg-white hover:bg-slate-50 text-blue-900 text-sm font-bold py-2.5 px-5 rounded-xl shadow-sm border border-slate-200 transition-all flex items-center gap-2"
            >
              <Search className="w-4 h-4" /> Localizar
            </button>
            <button 
              onClick={handleCancelar}
              className="bg-white hover:bg-red-50 text-red-500 text-sm font-bold py-2.5 px-5 rounded-xl shadow-sm border border-slate-200 hover:border-red-200 transition-all flex items-center gap-2"
            >
              <XCircle className="w-4 h-4" /> Cancelar OP
            </button>
          </div>
        </div>

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
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                Número da OP
              </label>
              <input
                type="text"
                placeholder="2024.OP.00452"
                {...register("numeroNe")}
                className="w-full px-4 py-3 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-bold focus:outline-none focus:ring-4 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10 text-slate-700 transition-all duration-300"
              />
              {errors.numeroNe && <p className="text-red-500 text-xs mt-1 font-bold">{errors.numeroNe.message as string}</p>}
            </div>

            <div className="col-span-12 md:col-span-3">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                Data de Emissão
              </label>
              <input
                type="date"
                {...register("dataEmissao")}
                className="w-full px-4 py-3 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-bold focus:outline-none focus:ring-4 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10 text-slate-500 transition-all duration-300"
              />
            </div>

            <div className="col-span-12 md:col-span-6">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                Nota de Empenho (NE) Vinculada
              </label>
              <div className="relative flex">
                <input
                  type="text"
                  placeholder="Buscar NE..."
                  {...register("empenho")}
                  className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-bold focus:outline-none focus:ring-4 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10 text-slate-700 transition-all duration-300"
                />
                <button onClick={loadNe} type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="col-span-12 md:col-span-5">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                Credor/Favorecido
              </label>
              <input
                type="text"
                placeholder="TechCorp Soluções em TI Ltda"
                {...register("nomeCredor")}
                className="w-full px-4 py-3 rounded-xl border border-blue-100 bg-blue-50/50 text-sm font-bold focus:outline-none focus:ring-4 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10 text-blue-900 transition-all duration-300"
              />
            </div>

            <div className="col-span-12 md:col-span-3">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                Valor a Pagar R$
              </label>
              <input
                type="text"
                placeholder="0,00"
                {...register("valorPagamento")}
                className="w-full px-4 py-3 rounded-xl border border-slate-200/50 bg-white shadow-sm text-lg font-black focus:outline-none focus:ring-4 focus:border-emerald-400 focus:bg-white focus:ring-emerald-500/10 text-slate-800 transition-all duration-300"
              />
            </div>

            <div className="col-span-12 md:col-span-4">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                Conta Bancária Origem
              </label>
              <select
                {...register("contaBancaria")}
                className="w-full px-4 py-3 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-bold text-slate-600 focus:outline-none focus:bg-white focus:ring-4 focus:ring-blue-900/10 focus:border-blue-800 transition-all duration-300"
              >
                <option value="">Selecione a conta...</option>
                <option value="BB">BB - C/C 12345-6</option>
                <option value="CAIXA">CAIXA - C/C 0987-6</option>
              </select>
            </div>

            <div className="col-span-12">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                Histórico do Pagamento
              </label>
              <textarea
                rows={2}
                placeholder="Descrição detalhada do pagamento..."
                {...register("historico")}
                className="w-full px-4 py-3 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-medium focus:outline-none focus:bg-white focus:ring-4 focus:ring-blue-900/10 focus:border-blue-800 transition-all duration-300 resize-none text-slate-700"
              ></textarea>
            </div>
          </div>
        </div>

        {/* RETENÇÕES E DESCONTOS (Glass Panel secundário visível) */}
        <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 mr-3">
                <Calculator className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">
                Retenções e Descontos
              </h2>
            </div>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
              <label className="flex items-center cursor-pointer">
                <input type="checkbox" {...register("autoCalculate")} className="mr-2 rounded text-indigo-600 focus:ring-indigo-500" />
                Cálculo Automático
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div>
              <label className="flex items-center text-sm font-black text-slate-500 uppercase tracking-widest mb-2 cursor-pointer">
                <input type="checkbox" {...register("appliedTax_irrf")} className="mr-1.5 rounded text-blue-900" />
                IRRF
              </label>
              <input type="number" step="0.01" {...register("irrf")} className="w-full px-4 py-2.5 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-bold text-slate-700 focus:outline-none focus:bg-white focus:border-indigo-400" />
            </div>
            <div>
              <label className="flex items-center text-sm font-black text-slate-500 uppercase tracking-widest mb-2 cursor-pointer">
                <input type="checkbox" {...register("appliedTax_iss")} className="mr-1.5 rounded text-blue-900" />
                ISS
              </label>
              <input type="number" step="0.01" {...register("iss")} className="w-full px-4 py-2.5 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-bold text-slate-700 focus:outline-none focus:bg-white focus:border-indigo-400" />
            </div>
            <div>
              <label className="flex items-center text-sm font-black text-slate-500 uppercase tracking-widest mb-2 cursor-pointer">
                <input type="checkbox" {...register("appliedTax_inss")} className="mr-1.5 rounded text-blue-900" />
                INSS
              </label>
              <input type="number" step="0.01" {...register("inss")} className="w-full px-4 py-2.5 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-bold text-slate-700 focus:outline-none focus:bg-white focus:border-indigo-400" />
            </div>
            <div>
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                SEST/SENAT
              </label>
              <input type="number" step="0.01" {...register("sestSenat")} className="w-full px-4 py-2.5 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-bold text-slate-700 focus:outline-none focus:bg-white focus:border-indigo-400" />
            </div>
            <div>
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                Outros Descontos
              </label>
              <input type="number" step="0.01" {...register("outrosDescontos")} className="w-full px-4 py-2.5 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-bold text-slate-700 focus:outline-none focus:bg-white focus:border-indigo-400" />
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

        {/* DATA TABLE (Borderless) */}
        <div className="pb-12 mt-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800 text-xl tracking-tight">
              Ordens Recentes
            </h3>
            <div className="relative w-64 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                id="search-op-table"
                type="text"
                placeholder="Buscar Ordem..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-full text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-900/10 focus:border-blue-800 transition-all duration-300"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
             <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-4 pl-2 text-sm font-black text-slate-500 uppercase tracking-widest">Número OP</th>
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">NE Ref.</th>
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">Favorecido</th>
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">Data</th>
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest text-right">Valor (R$)</th>
                  <th className="pb-4 pr-2 text-sm font-black text-slate-500 uppercase tracking-widest text-right">Status / Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                       Carregando...
                    </td>
                  </tr>
                ) : filteredOps.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                      Nenhuma ordem encontrada.
                    </td>
                  </tr>
                ) : (
                  filteredOps.map((op) => (
                    <tr
                      key={op.id}
                      onClick={() => {
                        setSelecionadoId(op.id);
                        setEditingId(op.id);
                        reset({
                          numeroNe: op.numeroNe,
                          empenho: op.numeroEmpenho,
                          nomeCredor: op.credorNome,
                          cpfCnpj: op.credorCpfCnpj,
                          valorPagamento: op.valorPagamento,
                          dataEmissao: op.dataEmissao,
                          irrf: op.irrf || 0,
                          iss: op.iss || 0,
                          inss: op.inss || 0,
                          autoCalculate: false,
                        });
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`group hover:bg-blue-50/50 transition-colors cursor-pointer ${selecionadoId === op.id ? 'bg-blue-50/50' : ''}`}
                    >
                      <td className="py-5 font-bold text-blue-900 rounded-l-lg pl-2">
                        {op.numeroNe || op.numeroOp || "-"}
                      </td>
                      <td className="py-5 font-semibold text-slate-500">
                        {op.numeroEmpenho || "-"}
                      </td>
                      <td className="py-5 font-semibold text-slate-700">
                        {op.credorNome || "-"}
                      </td>
                      <td className="py-5 font-medium text-slate-500">
                        {op.dataEmissao ? new Date(op.dataEmissao).toLocaleDateString('pt-BR') : "-"}
                      </td>
                      <td className="py-5 font-black text-slate-800 text-right">
                        {formatCurrency(Number(op.valorPagamento) || 0).replace("R$", "").trim()}
                      </td>
                      <td className="py-5 text-right rounded-r-lg pr-2">
                        <div className="flex items-center justify-end gap-4">
                          {op.status === 'PAGO' || op.status === 'Pago' ? (
                             <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase bg-emerald-50 text-emerald-600">PAGO</span>
                          ) : (
                             <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase bg-amber-50 text-amber-600">PENDENTE</span>
                          )}
                          
                          <div className="flex items-center gap-1 border-l border-slate-200 pl-4">
                            <button
                              title="Visualizar"
                              className="p-1.5 text-slate-400 hover:text-blue-900 hover:bg-white rounded-md transition-all"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              title="Imprimir"
                              className="p-1.5 text-slate-400 hover:text-blue-900 hover:bg-white rounded-md transition-all"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 pt-4 flex justify-between items-center text-sm font-bold text-slate-500 uppercase tracking-widest pb-8">
          <p>© 2026 Gestão de Empenho. Todos os direitos reservados.</p>
          <div className="flex gap-4">
            <span className="hover:text-slate-600 cursor-pointer">Termos de Uso</span>
            <span className="hover:text-slate-600 cursor-pointer">Política de Privacidade</span>
            <span className="hover:text-slate-600 cursor-pointer">Suporte</span>
          </div>
        </div>
      </div>
    </div>
  );
}
