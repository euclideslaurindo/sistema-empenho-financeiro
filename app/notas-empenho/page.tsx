"use client";
import { useState, useEffect, useCallback } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Save,
  Search,
  Trash2,
  Eye,
  Pencil,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { maskCurrency } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";

interface NotaEmpenho {
  id: string;
  codigo: string;
  numero: string;
  valor: number;
  dataPagamento: string;
  unidadeOrcamentaria: string;
  elementoSubelemento: string;
  gestao: string;
  status: string;
  historico: string;
  dataProvisaoConcedida?: string;
  dataEmissao?: string;
}

const notaEmpenhoSchema = z.object({
  codigoNE: z.string().min(1, "Código é obrigatório"),
  numeroNE: z.string().min(1, "Número da NE é obrigatório"),
  valorNE: z.union([z.string(), z.number()]).transform(val => {
    const clean = String(val).replace(/[^\d,-]/g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  }).refine(val => val > 0, { message: "O valor da NE deve ser maior que zero." }),
  dataPagamento: z.string().min(1, "Data é obrigatória").refine(val => {
    const y = parseInt(val.split('-')[0], 10);
    return y >= 2000 && y <= 2100;
  }, "Ano inválido"),
  unidadeOrcamentaria: z.string().optional(),
  elementoSubelemento: z.string().optional(),
  gestao: z.string().optional(),
  historico: z.string().optional(),
  dataProvisaoConcedida: z.string().optional().refine(val => {
    if (!val) return true;
    const y = parseInt(val.split('-')[0], 10);
    return y >= 2000 && y <= 2100;
  }, "Ano inválido"),
  dataEmissao: z.string().optional().refine(val => {
    if (!val) return true;
    const y = parseInt(val.split('-')[0], 10);
    return y >= 2000 && y <= 2100;
  }, "Ano inválido"),
});

type NotaEmpenhoFormValues = z.input<typeof notaEmpenhoSchema>;

export default function NotasEmpenho() {
  const router = useRouter();
  const [notas, setNotas] = useState<NotaEmpenho[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // estado do formulario
  const { register, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<NotaEmpenhoFormValues>({
    resolver: zodResolver(notaEmpenhoSchema),
    defaultValues: {
      codigoNE: "",
      numeroNE: "",
      valorNE: "",
      dataPagamento: "",
      unidadeOrcamentaria: "Secretaria de Educação",
      elementoSubelemento: "",
      gestao: "140101",
      historico: "",
    }
  });

  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [formEnabled, setFormEnabled] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const filterItems = () => notas;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchNotas = useCallback(async (busca = "") => {
    setIsLoading(true);
    try {
      const url = busca ? `/api/notas-empenho?busca=${encodeURIComponent(busca)}` : "/api/notas-empenho";
      const data = await apiClient.get(url);
      setNotas(data.notas || []);
    } catch (error: any) {
      toast.error(error.message || "Erro ao carregar Notas de Empenho.");
      setNotas([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotas();
  }, [fetchNotas]);

  // avisa quando a data ta passada de 60 dias
  let showAlerta = false;
  const dataPagamentoWatch = watch("dataPagamento");
  if (dataPagamentoWatch) {
    const parts = dataPagamentoWatch.split("-");
    if (parts.length === 3) {
      const selectedDate = new Date(
        parseInt(parts[0]),
        parseInt(parts[1]) - 1,
        parseInt(parts[2])
      );
      const today = new Date();
      const diffDays = Math.ceil(
        Math.abs(today.getTime() - selectedDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (selectedDate < today && diffDays >= 60) {
        showAlerta = true;
      }
    }
  }

  // detecta se ja tem uma NE com o mesmo valor no banco (possivel duplicata)
  const valorNEWatch = watch("valorNE");
  const getDuplicatedNE = () => {
    if (!valorNEWatch) return null;
    const clean = String(valorNEWatch).replace(/\D/g, "");
    if (clean.length < 3) return null;
    return notas.find((ne) => {
      const neValStr = String(Math.round(ne.valor)).replace(/\D/g, "");
      return clean.includes(neValStr) && neValStr.length >= 3;
    }) || null;
  };

  const handleLoadDuplicate = (ne: NotaEmpenho) => {
    reset({
      codigoNE: ne.codigo,
      numeroNE: ne.numero,
      dataPagamento: ne.dataPagamento ? ne.dataPagamento.split('T')[0] : "",
      valorNE: String(ne.valor),
      unidadeOrcamentaria: ne.unidadeOrcamentaria || "",
      elementoSubelemento: ne.elementoSubelemento || "",
      gestao: ne.gestao || "",
      historico: ne.historico || "",
      dataProvisaoConcedida: ne.dataProvisaoConcedida ? ne.dataProvisaoConcedida.split('T')[0] : "",
      dataEmissao: ne.dataEmissao ? ne.dataEmissao.split('T')[0] : "",
    });
    setEditingId(ne.id);
    toast.success("Dados preenchidos com base na NE " + ne.numero);
  };

  const duplicatedNe = getDuplicatedNE();

  const handleIncluir = () => {
    reset({
      codigoNE: "",
      numeroNE: "",
      valorNE: "",
      dataPagamento: "",
      unidadeOrcamentaria: "Secretaria de Educação",
      elementoSubelemento: "",
      gestao: "140101",
      historico: "",
      dataProvisaoConcedida: "",
      dataEmissao: "",
    });
    setEditingId(null);
  };

  const onSubmit = async (data: any) => {
    const payload = {
      codigo: data.codigoNE,
      numero: data.numeroNE,
      valor: data.valorNE,
      dataPagamento: data.dataPagamento || null,
      unidadeOrcamentaria: data.unidadeOrcamentaria,
      elementoSubelemento: data.elementoSubelemento,
      gestao: data.gestao,
      historico: data.historico,
      dataProvisaoConcedida: data.dataProvisaoConcedida || null,
      dataEmissao: data.dataEmissao || null,
      status: "EMITIDO",
    };

    try {
      if (editingId) {
        await apiClient.put(`/api/notas-empenho/${editingId}`, payload);
      } else {
        await apiClient.post("/api/notas-empenho", payload);
      }

      toast.success(editingId ? "NE atualizada com sucesso!" : "NE cadastrada com sucesso!");
      handleIncluir();
      await fetchNotas();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar NE.");
    }
  };

  const handleExcluir = async () => {
    if (!editingId) {
      toast.error("Nenhuma NE selecionada. Clique em uma NE da tabela primeiro.");
      return;
    }
    try {
      await apiClient.delete(`/api/notas-empenho/${editingId}`);
      toast.success("NE cancelada com sucesso!");
      handleIncluir();
      await fetchNotas();
    } catch (error: any) {
      toast.error(error.message || "Erro ao cancelar NE.");
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'LIQUIDADO') return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase bg-emerald-50 text-emerald-600">LIQUIDADO</span>;
    if (status === 'CANCELADO') return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase bg-slate-100 text-slate-500">CANCELADO</span>;
    if (status === 'Processando') return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase bg-amber-50 text-amber-600">Processando</span>;
    return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase bg-blue-50 text-blue-900">EMITIDO</span>;
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  };
  
  const onError = (errors: any) => {
    toast.error("Preencha os campos obrigatórios corretamente.");
  };

  const handleSalvar = handleSubmit(onSubmit, onError);

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="p-8 max-w-[1400px] mx-auto w-full flex-1 space-y-8 animate-fade-in">
        
        {/* HEADER & ACTION BUTTONS */}
        <div className="flex flex-col md:flex-row md:items-end justify-between">
          <div>
            <div className="flex items-center text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">
              Início &gt; Gestão Financeira &gt; <span className="text-blue-900 ml-1">Notas de Empenho</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight">
              Emissão de Notas de Empenho
            </h1>
          </div>
          <div className="mt-6 md:mt-0 flex items-center gap-3">
            <button 
              onClick={handleIncluir}
              className="bg-blue-900 hover:bg-blue-800 text-white text-sm font-bold py-2.5 px-5 rounded-xl shadow-sm transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Limpar
            </button>
            <button 
              onClick={handleSalvar}
              className="bg-blue-900 hover:bg-blue-800 text-white text-sm font-bold py-2.5 px-5 rounded-xl shadow-sm transition-all flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Salvar
            </button>
            <button 
              onClick={() => { document.getElementById('search-notas')?.focus(); }}
              className="bg-white hover:bg-slate-50 text-blue-900 text-sm font-bold py-2.5 px-5 rounded-xl shadow-sm border border-slate-200 transition-all flex items-center gap-2"
            >
              <Search className="w-4 h-4" /> Localizar
            </button>
            <button 
              onClick={handleExcluir}
              className="bg-white hover:bg-red-50 text-red-500 text-sm font-bold py-2.5 px-5 rounded-xl shadow-sm border border-slate-200 hover:border-red-200 transition-all flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Excluir
            </button>
          </div>
        </div>

        {showAlerta && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-start gap-3 shadow-sm">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="text-red-800 font-bold text-sm">
                Atenção: Prazo de Execução Expirado
              </h3>
              <p className="text-red-700 text-sm mt-1">
                O recurso desta Nota de Empenho já percorreu o prazo de 60 dias
                para ser executado. Verifique a situação da Ordem de Pagamento.
              </p>
            </div>
          </div>
        )}

        {/* FORM SECTION (Glass Panel) */}
        <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
          <div className="flex items-center mb-8 pb-4 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-900 mr-3">
              <FileText className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">
              {editingId ? "Editando Dados da Nota" : "Dados da Nota"}
            </h2>
            {editingId && (
              <span className="ml-4 text-xs font-black uppercase tracking-widest bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-full">
                Modo Edição
              </span>
            )}
          </div>

          <form className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                Código NE
              </label>
              <input
                type="text"
                placeholder="Ex: 001/2024"
                {...register("codigoNE")}
                className={`w-full px-4 py-3 rounded-xl border text-sm font-bold focus:outline-none focus:ring-4 transition-all duration-300 ${errors.codigoNE ? 'border-red-300 bg-red-50/50 focus:border-red-500 focus:ring-red-500/20' : 'bg-slate-50 border-slate-200/50 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10 text-slate-700'}`}
              />
              {errors.codigoNE && <p className="text-red-500 text-xs mt-1.5 font-bold">{errors.codigoNE.message as string}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                Número da NE
              </label>
              <input
                type="text"
                placeholder="Ex: 2024NE000123"
                {...register("numeroNE")}
                className={`w-full px-4 py-3 rounded-xl border text-sm font-bold focus:outline-none focus:ring-4 transition-all duration-300 ${errors.numeroNE ? 'border-red-300 bg-red-50/50 focus:border-red-500 focus:ring-red-500/20' : 'bg-slate-50 border-slate-200/50 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10 text-slate-700'}`}
              />
              {errors.numeroNE && <p className="text-red-500 text-xs mt-1.5 font-bold">{errors.numeroNE.message as string}</p>}
            </div>
            <div>
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                Valor R$
              </label>
              <input
                type="text"
                placeholder="0,00"
                {...register("valorNE", {
                  onChange: (e) => {
                    e.target.value = maskCurrency(e.target.value);
                  }
                })}
                className={`w-full px-4 py-3 rounded-xl border text-sm font-black focus:outline-none focus:ring-4 transition-all duration-300 ${errors.valorNE ? 'border-red-300 bg-red-50/50 focus:border-red-500 focus:ring-red-500/20 text-red-700' : 'bg-slate-50 border-slate-200/50 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10 text-slate-800'}`}
              />
              {errors.valorNE && <p className="text-red-500 text-xs mt-1.5 font-bold">{errors.valorNE.message as string}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                Data de Provisão
              </label>
              <input
                type="date"
                {...register("dataProvisaoConcedida")}
                className={`w-full px-4 py-3 rounded-xl border text-sm font-bold text-slate-500 focus:outline-none focus:ring-4 transition-all duration-300 ${errors.dataProvisaoConcedida ? 'border-red-300 bg-red-50/50 focus:border-red-500 focus:ring-red-500/20' : 'bg-slate-50 border-slate-200/50 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10'}`}
              />
              {errors.dataProvisaoConcedida && <p className="text-red-500 text-xs mt-1.5 font-bold">{errors.dataProvisaoConcedida.message as string}</p>}
            </div>
            <div>
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                Data de Emissão
              </label>
              <input
                type="date"
                {...register("dataEmissao")}
                className={`w-full px-4 py-3 rounded-xl border text-sm font-bold text-slate-500 focus:outline-none focus:ring-4 transition-all duration-300 ${errors.dataEmissao ? 'border-red-300 bg-red-50/50 focus:border-red-500 focus:ring-red-500/20' : 'bg-slate-50 border-slate-200/50 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10'}`}
              />
              {errors.dataEmissao && <p className="text-red-500 text-xs mt-1.5 font-bold">{errors.dataEmissao.message as string}</p>}
            </div>

            <div className="md:col-span-1">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Unidade Orçamentária</label>
              <select
                {...register("unidadeOrcamentaria")}
                className="w-full px-4 py-3 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-bold text-slate-600 focus:outline-none focus:bg-white focus:ring-4 focus:ring-blue-900/10 focus:border-blue-800 transition-all duration-300"
              >
                <option value="Secretaria de Educação">Secretaria de Educação</option>
                <option value="Sec. Saúde">Sec. Saúde</option>
                <option value="Sec. Administração">Sec. Administração</option>
                <option value="Sec. Finanças">Sec. Finanças</option>
                <option value="Sec. Obras">Sec. Obras</option>
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Elemento/Subelemento</label>
              <input
                type="text"
                placeholder="Ex: 3.3.90.30/01"
                {...register("elementoSubelemento")}
                className="w-full px-4 py-3 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-bold focus:outline-none focus:ring-4 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10 text-slate-700 transition-all duration-300"
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Gestão</label>
              <select
                {...register("gestao")}
                className="w-full px-4 py-3 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-bold text-slate-600 focus:outline-none focus:bg-white focus:ring-4 focus:ring-blue-900/10 focus:border-blue-800 transition-all duration-300"
              >
                <option value="140101">140101</option>
                <option value="140102">140102</option>
              </select>
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                Data de Pagamento
              </label>
              <input
                type="date"
                {...register("dataPagamento")}
                className={`w-full px-4 py-3 rounded-xl border text-sm font-bold text-slate-500 focus:outline-none focus:ring-4 transition-all duration-300 ${errors.dataPagamento ? 'border-red-300 bg-red-50/50 focus:border-red-500 focus:ring-red-500/20' : 'bg-slate-50 border-slate-200/50 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10'}`}
              />
              {errors.dataPagamento && <p className="text-red-500 text-xs mt-1.5 font-bold">{errors.dataPagamento.message as string}</p>}
            </div>

            <div className="md:col-span-4">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Histórico</label>
              <textarea
                rows={3}
                placeholder="Descreva o histórico do empenho..."
                {...register("historico")}
                className="w-full px-4 py-3 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-medium focus:outline-none focus:bg-white focus:ring-4 focus:ring-blue-900/10 focus:border-blue-800 transition-all duration-300 resize-none text-slate-700"
              ></textarea>
            </div>
          </form>

          {duplicatedNe && (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl flex items-start gap-3 shadow-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-bold text-sm">Possível Duplicação de Valores</h3>
                <p className="text-xs mt-1 text-amber-700">
                  Encontramos a NE <strong>{duplicatedNe.numero}</strong> com valor similar.
                </p>
                <button
                  type="button"
                  onClick={() => handleLoadDuplicate(duplicatedNe)}
                  className="mt-3 text-xs font-black uppercase tracking-widest px-4 py-2 bg-amber-200 hover:bg-amber-300 rounded-lg transition-colors text-amber-900 shadow-sm"
                >
                  Carregar dados da NE {duplicatedNe.numero}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* DATA TABLE (Borderless) */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800 text-xl tracking-tight">
              Notas Recentes
            </h3>
            <div className="relative w-64 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                id="search-notas"
                type="text"
                placeholder="Buscar nota..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  fetchNotas(e.target.value);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-full text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-900/10 focus:border-blue-800 transition-all duration-300"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
             <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-4 pl-2 text-sm font-black text-slate-500 uppercase tracking-widest">Número</th>
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">Data</th>
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">Unidade/Gestão</th>
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">Histórico</th>
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest text-right">Valor</th>
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest text-center">Status</th>
                  <th className="pb-4 pr-2 text-sm font-black text-slate-500 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">
                       Carregando...
                    </td>
                  </tr>
                ) : notas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">
                      Nenhuma nota encontrada.
                    </td>
                  </tr>
                ) : (
                  notas.map((ne, index) => (
                    <tr
                      key={ne.id}
                      onClick={() => setSelecionadoId(ne.id)}
                      className={`group hover:bg-blue-50/50 transition-colors cursor-pointer ${selecionadoId === ne.id ? 'bg-blue-50/50' : ''}`}
                    >
                      <td className="py-5 font-bold text-slate-800 rounded-l-lg pl-2">
                        {ne.numero}
                      </td>
                      <td className="py-5 font-semibold text-slate-500">
                        {formatDate(ne.dataPagamento)}
                      </td>
                      <td className="py-5 font-semibold text-slate-600">
                        {ne.unidadeOrcamentaria || "-"}
                      </td>
                      <td className="py-5 font-medium text-slate-500 truncate max-w-[200px]">
                        {ne.historico || "-"}
                      </td>
                      <td className="py-5 font-black text-slate-700 text-right">
                        {Number(ne.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="py-5 text-center">
                        {getStatusBadge(ne.status)}
                      </td>
                      <td className="py-5 text-right rounded-r-lg pr-2">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            title="Editar"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelecionadoId(ne.id);
                              setEditingId(ne.id);
                              reset({
                                codigoNE: ne.codigo,
                                numeroNE: ne.numero,
                                valorNE: String(ne.valor),
                                dataPagamento: ne.dataPagamento ? ne.dataPagamento.split('T')[0] : "",
                                unidadeOrcamentaria: ne.unidadeOrcamentaria,
                                elementoSubelemento: ne.elementoSubelemento,
                                gestao: ne.gestao,
                                historico: ne.historico,
                                dataProvisaoConcedida: ne.dataProvisaoConcedida ? ne.dataProvisaoConcedida.split('T')[0] : "",
                                dataEmissao: ne.dataEmissao ? ne.dataEmissao.split('T')[0] : "",
                              });
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-900 hover:bg-white rounded-md transition-all"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
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
            <span className="hover:text-slate-600 cursor-pointer">Privacidade</span>
            <span className="hover:text-slate-600 cursor-pointer">Termos de Uso</span>
            <span className="hover:text-slate-600 cursor-pointer">Suporte Técnico</span>
          </div>
        </div>
      </div>
    </div>
  );
}
