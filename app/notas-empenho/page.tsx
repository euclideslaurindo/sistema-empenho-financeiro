"use client";
import { useState, useEffect, useCallback } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { ELEMENTOS, SUBELEMENTOS } from "@/lib/constants";
import { notaEmpenhoSchema, type NotaEmpenhoFormValues } from "@/lib/schemas";
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
  elemento: string;
  subelemento: string;
  gestao: string;
  status: string;
  historico: string;
  dataProvisaoConcedida?: string;
  dataEmissao?: string;
  quemAtualizou?: string;
  credorNome?: string;
  cpfCnpj?: string;
}

export default function NotasEmpenho() {
  const router = useRouter();
  const [notas, setNotas] = useState<NotaEmpenho[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [duplicatedNe, setDuplicatedNe] = useState<NotaEmpenho | null>(null);

  // estado do formulario
  const { register, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<NotaEmpenhoFormValues>({
    resolver: zodResolver(notaEmpenhoSchema),
    defaultValues: {
      numeroNE: "",
      valorNE: "",
      dataPagamento: "",
      unidadeOrcamentaria: "Secretaria de Educação",
      elemento: "",
      subelemento: "",
      gestao: "140101",
      historico: "",
      credorNome: "",
      cpfCnpj: ""
    }
  });

  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [formEnabled, setFormEnabled] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const filterItems = () => notas;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchNotas = useCallback(async (busca = "", page = 1) => {
    setIsLoading(true);
    try {
      let url = `/api/notas-empenho?page=${page}`;
      if (busca) url += `&busca=${encodeURIComponent(busca)}`;
      
      const data = await apiClient.get(url);
      setNotas(data.notas || []);
      if (data.pagination) {
        setTotalPages(data.pagination.totalPages || 1);
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao carregar Notas de Empenho.");
      setNotas([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotas(searchTerm, currentPage);
  }, [fetchNotas, currentPage]);

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
  // Debounce API check para duplicidade
  const valorNEWatch = watch("valorNE");
  const credorNomeWatch = watch("credorNome");
  const subelementoWatch = watch("subelemento");
  
  useEffect(() => {
    if (!valorNEWatch) {
      setDuplicatedNe(null);
      return;
    }
    const clean = String(valorNEWatch).replace(/\D/g, "");
    if (clean.length < 3) {
      setDuplicatedNe(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const num = parseFloat(String(valorNEWatch).replace(/[^\d,]/g, '').replace(',', '.'));
        if (isNaN(num)) return;
        const params = new URLSearchParams({ valor: String(num) });
        if (credorNomeWatch) params.append('credor', credorNomeWatch);
        if (subelementoWatch) params.append('subelemento', subelementoWatch);
        const res = await fetch(`/api/notas-empenho/duplicidade?${params.toString()}`);
        const data = await res.json();
        if (data.duplicado && data.nota) {
          setDuplicatedNe(data.nota);
        } else {
          setDuplicatedNe(null);
        }
      } catch (e) {
        console.error("Erro check duplicidade", e);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [valorNEWatch, credorNomeWatch, subelementoWatch]);

  const handleLoadDuplicate = (ne: NotaEmpenho) => {
    reset({
      numeroNE: ne.numero,
      dataPagamento: ne.dataPagamento ? ne.dataPagamento.split('T')[0] : "",
      valorNE: String(ne.valor),
      unidadeOrcamentaria: ne.unidadeOrcamentaria || "",
      elemento: ne.elemento || "",
      subelemento: ne.subelemento || "",
      gestao: ne.gestao || "",
      historico: ne.historico || "",
      dataProvisaoConcedida: ne.dataProvisaoConcedida ? ne.dataProvisaoConcedida.split('T')[0] : "",
      dataEmissao: ne.dataEmissao ? ne.dataEmissao.split('T')[0] : "",
      credorNome: ne.credorNome || "",
      cpfCnpj: ne.cpfCnpj || "",
    });
    setEditingId(ne.id || "");
    toast.success("Dados preenchidos com base na NE " + ne.numero);
  };

  const handleIncluir = () => {
    reset({
      numeroNE: "",
      valorNE: "",
      dataPagamento: "",
      unidadeOrcamentaria: "Secretaria de Educação",
      elemento: "",
      subelemento: "",
      gestao: "140101",
      historico: "",
      dataProvisaoConcedida: "",
      dataEmissao: "",
      credorNome: "",
      cpfCnpj: "",
    });
    setEditingId(null);
  };

  const onSubmit = async (data: any) => {
    const payload = {
      numero: data.numeroNE,
      valor: data.valorNE,
      dataPagamento: data.dataPagamento || null,
      unidadeOrcamentaria: data.unidadeOrcamentaria,
      elemento: data.elemento,
      subelemento: data.subelemento,
      gestao: data.gestao,
      historico: data.historico,
      dataProvisaoConcedida: data.dataProvisaoConcedida || null,
      dataEmissao: data.dataEmissao || null,
      credorNome: data.credorNome || null,
      cpfCnpj: data.cpfCnpj || null,
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
    if (status === 'LIQUIDADO') return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase bg-green-100 text-green-800 border border-green-300">PAGO</span>;
    if (status === 'CANCELADO') return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase bg-red-100 text-red-700 border border-red-200">CANCELADO</span>;
    if (status === 'Processando') return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase bg-amber-100 text-amber-700 border border-amber-200">PROCESSANDO</span>;
    return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase bg-orange-100 text-orange-800 border border-orange-300">A PAGAR</span>;
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

  const maskCpfCnpj = (v: string) => {
    v = v.replace(/\D/g, "");
    if (v.length <= 11) {
      v = v.replace(/(\d{3})(\d)/, "$1.$2");
      v = v.replace(/(\d{3})(\d)/, "$1.$2");
      v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
      v = v.replace(/^(\d{2})(\d)/, "$1.$2");
      v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
      v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
      v = v.replace(/(\d{4})(\d)/, "$1-$2");
    }
    return v;
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
            <div className="md:col-span-1">
              <label htmlFor="ne-numero" className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                Número da NE
              </label>
              <input
                id="ne-numero"
                type="text"
                placeholder=""
                {...register("numeroNE")}
                aria-invalid={!!errors.numeroNE}
                aria-describedby={errors.numeroNE ? "ne-numero-error" : undefined}
                className={`w-full px-4 py-3 rounded-xl border text-sm font-bold focus:outline-none focus:ring-4 transition-all duration-300 ${errors.numeroNE ? 'border-red-300 bg-red-50/50 focus:border-red-500 focus:ring-red-500/20' : 'bg-slate-50 border-slate-200/50 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10 text-slate-700'}`}
              />
              {errors.numeroNE && <p id="ne-numero-error" className="text-red-500 text-xs mt-1.5 font-bold">{errors.numeroNE.message as string}</p>}
            </div>

            <div>
              <label htmlFor="ne-valor" className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                Valor R$
              </label>
              <input
                id="ne-valor"
                type="text"
                placeholder="0,00"
                {...register("valorNE", {
                  onChange: (e) => {
                    e.target.value = maskCurrency(e.target.value);
                  }
                })}
                aria-invalid={!!errors.valorNE}
                aria-describedby={errors.valorNE ? "ne-valor-error" : undefined}
                className={`w-full px-4 py-3 rounded-xl border text-sm font-black focus:outline-none focus:ring-4 transition-all duration-300 ${errors.valorNE ? 'border-red-300 bg-red-50/50 focus:border-red-500 focus:ring-red-500/20 text-red-700' : 'bg-slate-50 border-slate-200/50 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10 text-slate-800'}`}
              />
              {errors.valorNE && <p id="ne-valor-error" className="text-red-500 text-xs mt-1.5 font-bold">{errors.valorNE.message as string}</p>}
            </div>

            <div>
              <label htmlFor="ne-data-provisao" className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                Data de Provisão
              </label>
              <input
                id="ne-data-provisao"
                type="date"
                {...register("dataProvisaoConcedida")}
                aria-invalid={!!errors.dataProvisaoConcedida}
                aria-describedby={errors.dataProvisaoConcedida ? "ne-data-provisao-error" : undefined}
                className={`w-full px-4 py-3 rounded-xl border text-sm font-bold text-slate-500 focus:outline-none focus:ring-4 transition-all duration-300 ${errors.dataProvisaoConcedida ? 'border-red-300 bg-red-50/50 focus:border-red-500 focus:ring-red-500/20' : 'bg-slate-50 border-slate-200/50 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10'}`}
              />
              {errors.dataProvisaoConcedida && <p id="ne-data-provisao-error" className="text-red-500 text-xs mt-1.5 font-bold">{errors.dataProvisaoConcedida.message as string}</p>}
            </div>
            <div>
              <label htmlFor="ne-data-emissao" className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                Data de Emissão
              </label>
              <input
                id="ne-data-emissao"
                type="date"
                {...register("dataEmissao")}
                aria-invalid={!!errors.dataEmissao}
                aria-describedby={errors.dataEmissao ? "ne-data-emissao-error" : undefined}
                className={`w-full px-4 py-3 rounded-xl border text-sm font-bold text-slate-500 focus:outline-none focus:ring-4 transition-all duration-300 ${errors.dataEmissao ? 'border-red-300 bg-red-50/50 focus:border-red-500 focus:ring-red-500/20' : 'bg-slate-50 border-slate-200/50 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10'}`}
              />
              {errors.dataEmissao && <p id="ne-data-emissao-error" className="text-red-500 text-xs mt-1.5 font-bold">{errors.dataEmissao.message as string}</p>}
            </div>

            <div className="md:col-span-2">
              <label htmlFor="ne-credor-nome" className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                Credor (Nome/Razão Social)
              </label>
              <input
                id="ne-credor-nome"
                type="text"
                placeholder="Nome do credor"
                {...register("credorNome")}
                className="w-full px-4 py-3 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10 transition-all duration-300"
              />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="ne-cpf-cnpj" className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                CPF / CNPJ
              </label>
              <input
                id="ne-cpf-cnpj"
                type="text"
                placeholder="000.000.000-00"
                {...register("cpfCnpj", {
                  onChange: (e) => {
                    e.target.value = maskCpfCnpj(e.target.value);
                  }
                })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10 transition-all duration-300"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="ne-unidade" className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Unidade Orçamentária</label>
              <select
                id="ne-unidade"
                {...register("unidadeOrcamentaria")}
                disabled
                className="w-full px-4 py-3 rounded-xl border border-slate-200/50 bg-slate-100 text-sm font-bold text-slate-600 opacity-80 cursor-not-allowed"
              >
                <option value="Secretaria de Educação">Secretaria de Educação</option>
                <option value="Sec. Saúde">Sec. Saúde</option>
                <option value="Sec. Administração">Sec. Administração</option>
                <option value="Sec. Finanças">Sec. Finanças</option>
                <option value="Sec. Obras">Sec. Obras</option>
              </select>
            </div>
            <div className="md:col-span-1">
              <label htmlFor="ne-gestao" className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Gestão</label>
              <select
                id="ne-gestao"
                {...register("gestao")}
                disabled
                className="w-full px-4 py-3 rounded-xl border border-slate-200/50 bg-slate-100 text-sm font-bold text-slate-600 opacity-80 cursor-not-allowed"
              >
                <option value="140101">140101</option>
                <option value="140102">140102</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="ne-elemento" className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Elemento</label>
              <select
                id="ne-elemento"
                {...register("elemento")}
                className="w-full px-4 py-3 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-bold focus:outline-none focus:ring-4 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10 text-slate-700 transition-all duration-300"
              >
                <option value="">Selecione o Elemento</option>
                {ELEMENTOS.map((el) => (
                  <option key={el} value={el}>{el}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="ne-subelemento" className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Subelemento</label>
              <select
                id="ne-subelemento"
                {...register("subelemento")}
                className="w-full px-4 py-3 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-bold focus:outline-none focus:ring-4 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10 text-slate-700 transition-all duration-300"
              >
                <option value="">Selecione o Subelemento</option>
                {SUBELEMENTOS.map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-1">
              <label htmlFor="ne-data-pagamento" className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                Data de Pagamento
              </label>
              <input
                id="ne-data-pagamento"
                type="date"
                {...register("dataPagamento")}
                aria-invalid={!!errors.dataPagamento}
                aria-describedby={errors.dataPagamento ? "ne-data-pagamento-error" : undefined}
                className={`w-full px-4 py-3 rounded-xl border text-sm font-bold text-slate-500 focus:outline-none focus:ring-4 transition-all duration-300 ${errors.dataPagamento ? 'border-red-300 bg-red-50/50 focus:border-red-500 focus:ring-red-500/20' : 'bg-slate-50 border-slate-200/50 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10'}`}
              />
              {errors.dataPagamento && <p id="ne-data-pagamento-error" className="text-red-500 text-xs mt-1.5 font-bold">{errors.dataPagamento.message as string}</p>}
            </div>

            <div className="md:col-span-4">
              <label htmlFor="ne-historico" className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Especificação</label>
              <textarea
                id="ne-historico"
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
                  setCurrentPage(1); // Reseta para a pagina 1 ao buscar
                  fetchNotas(e.target.value, 1);
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
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">Quem Atualizou</th>
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">Especificação</th>
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
                  notas.map((ne, index) => {
                    const isCancelado = ne.status === 'CANCELADO';
                    const baseRowStyle = isCancelado 
                      ? 'bg-red-50/30 hover:bg-red-50/60 opacity-80' 
                      : (selecionadoId === ne.id ? 'bg-blue-50/50' : 'hover:bg-blue-50/50');
                    const textStyle = isCancelado ? 'line-through decoration-red-300 text-red-400' : '';

                    return (
                    <tr
                      key={ne.id}
                      onClick={() => setSelecionadoId(ne.id)}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelecionadoId(ne.id);
                        }
                      }}
                      className={`group transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset ${baseRowStyle}`}
                    >
                      <td className={`py-5 font-bold rounded-l-lg pl-2 ${isCancelado ? textStyle : 'text-slate-800'}`}>
                        {ne.numero}
                      </td>
                      <td className={`py-5 font-semibold ${isCancelado ? textStyle : 'text-slate-500'}`}>
                        {formatDate(ne.dataPagamento)}
                      </td>
                      <td className={`py-5 font-semibold ${isCancelado ? textStyle : 'text-slate-600'}`}>
                        {ne.quemAtualizou || "Sistema"}
                      </td>
                      <td className={`py-5 font-medium truncate max-w-[200px] ${isCancelado ? textStyle : 'text-slate-500'}`}>
                        {ne.historico || "-"}
                      </td>
                      <td className={`py-5 font-black text-right ${isCancelado ? textStyle : 'text-slate-700'}`}>
                        {Number(ne.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="py-5 text-center">
                        {getStatusBadge(ne.status)}
                      </td>
                      <td className="py-5 text-right rounded-r-lg pr-2">
                        <div className="flex items-center justify-end gap-2">
                          {!isCancelado && (
                            <button
                              title="Editar"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelecionadoId(ne.id);
                                setEditingId(ne.id);
                                reset({
                                  numeroNE: ne.numero,
                                  valorNE: String(ne.valor),
                                  dataPagamento: ne.dataPagamento ? ne.dataPagamento.split('T')[0] : "",
                                  unidadeOrcamentaria: ne.unidadeOrcamentaria,
                                  elemento: ne.elemento,
                                  subelemento: ne.subelemento,
                                  gestao: ne.gestao,
                                  historico: ne.historico,
                                  dataProvisaoConcedida: ne.dataProvisaoConcedida ? ne.dataProvisaoConcedida.split('T')[0] : "",
                                  dataEmissao: ne.dataEmissao ? ne.dataEmissao.split('T')[0] : "",
                                  credorNome: ne.credorNome || "",
                                  cpfCnpj: ne.cpfCnpj || "",
                                });
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="p-1.5 text-slate-400 hover:text-blue-900 hover:bg-white rounded-md transition-all"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              </tbody>
            </table>
          </div>
          
          {/* Paginação */}
          <div className="flex justify-between items-center mt-6">
            <span className="text-sm font-semibold text-slate-500">
              Página {currentPage} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-sm"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-sm"
              >
                Próxima
              </button>
            </div>
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
