"use client";
import { useState, useEffect, useCallback } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { useElementos } from "@/hooks/use-elementos";
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
import { SubelementoCampo } from "@/components/ne-form/SubelementoCampo";
import { FaixaSaldoNe, percentualDaBarra } from "@/components/ne-form/FaixaSaldoNe";
import { formatarBRL, lerValorMonetario, toCents } from "@/lib/money";

interface NotaEmpenho {
  id: string;
  codigo: string;
  numero: string;
  valor: number;
  /** Data de cadastro (created_at), 'YYYY-MM-DD' — coluna "Cadastro" da lista (T29). */
  criadaEm?: string;
  unidadeOrcamentaria: string;
  elemento: string;
  subelemento: string;
  gestao: string;
  status: string;
  historico: string;
  dataProvisaoConcedida?: string;
  quemAtualizou?: string;
  /** T31: valor, gasto (soma das OPs), restante, % gasto e quantidade de OPs. */
  saldo?: { valor: number; gasto: number; restante: number; percentualGasto: number; qtdOps: number };
}

/** Valores do formulário a partir de uma NE gravada (editar ou "carregar dados da NE"). */
const formularioDaNe = (ne: NotaEmpenho) => ({
  numeroNE: ne.numero,
  // O banco devolve "100.00": no campo vai "100,00", como quando se digita
  // (antes ia o texto cru e o formulário lia ×100 ao salvar).
  valorNE: maskCurrency(lerValorMonetario(ne.valor)),
  unidadeOrcamentaria: ne.unidadeOrcamentaria || "",
  elemento: ne.elemento || "",
  subelemento: ne.subelemento || "",
  gestao: ne.gestao || "",
  historico: ne.historico || "",
  dataProvisaoConcedida: ne.dataProvisaoConcedida ? ne.dataProvisaoConcedida.split("T")[0] : "",
});

export default function NotasEmpenho() {
  const router = useRouter();
  const [notas, setNotas] = useState<NotaEmpenho[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [duplicatedNe, setDuplicatedNe] = useState<NotaEmpenho | null>(null);

  // estado do formulario
  const methods = useForm<NotaEmpenhoFormValues>({
    resolver: zodResolver(notaEmpenhoSchema),
    defaultValues: {
      numeroNE: "",
      valorNE: "",
      unidadeOrcamentaria: "Secretaria de Educação",
      elemento: "",
      subelemento: "",
      gestao: "140101",
      historico: "",
    }
  });
  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = methods;

  const { elementos, loading: elementosLoading, erro: elementosErro, recarregar: recarregarElementos } = useElementos();

  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [formEnabled, setFormEnabled] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const filterItems = () => notas;
  const [editingId, setEditingId] = useState<string | null>(null);
  // Gasto (OPs já emitidas) da NE aberta no formulário; 0 em NE nova (T31).
  const [gastoNeCents, setGastoNeCents] = useState(0);
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

  // Aviso de NE parecida (D33, T30): mesmo valor + elemento + subelemento.
  // Debounce de 500 ms na consulta.
  const valorNEWatch = useWatch({ control, name: "valorNE" });
  const subelementoWatch = useWatch({ control, name: "subelemento" });
  const elementoWatch = useWatch({ control, name: "elemento" });

  // Cascata elemento -> subelemento: com subelementos cadastrados, lista (e
  // "(legado) ..." para valor antigo fora dela, D9); sem lista, texto livre.
  // O campo aparece sempre (T29, D26) — ver SubelementoCampo.
  const elementoAtual = elementos.find((el) => el.valor === elementoWatch);
  const subelementosDisponiveis = elementoAtual?.subelementos ?? [];
  const elementoReconhecido = !!elementoAtual;

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
        const num = lerValorMonetario(valorNEWatch);
        if (!(num > 0)) return;
        const params = new URLSearchParams({ valor: String(num) });
        if (elementoWatch) params.append('elemento', elementoWatch);
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
  }, [valorNEWatch, elementoWatch, subelementoWatch]);

  // A consulta de duplicidade devolve os dados da NE parecida (T30); antes
  // vinham só número e data, e o formulário ficava quase vazio.
  const handleLoadDuplicate = (ne: NotaEmpenho) => {
    reset(formularioDaNe(ne));
    setEditingId(ne.id || "");
    setGastoNeCents(0);
    // A consulta de duplicidade não traz o saldo: busca o da NE carregada.
    apiClient
      .get(`/api/notas-empenho/saldo?numero=${encodeURIComponent(ne.numero)}`)
      .then((d: any) => setGastoNeCents(toCents(d?.saldo?.gasto ?? 0)))
      .catch(() => setGastoNeCents(0));
    toast.success("Dados preenchidos com base na NE " + ne.numero);
  };

  const handleIncluir = () => {
    reset({
      numeroNE: "",
      valorNE: "",
      unidadeOrcamentaria: "Secretaria de Educação",
      elemento: "",
      subelemento: "",
      gestao: "140101",
      historico: "",
      dataProvisaoConcedida: "",
    });
    setEditingId(null);
    setGastoNeCents(0);
  };

  const onSubmit = async (data: any) => {
    // O resolver já converteu valorNE em número. Sem credor (T30): a NE pode
    // ser salva sem credor e sem consumir o valor todo; os credores são
    // escolhidos na Ordem de Pagamento. Sem dataPagamento/dataEmissao (T29):
    // o servidor preserva as já gravadas em NEs antigas.
    const payload = {
      numero: data.numeroNE,
      valor: data.valorNE,
      unidadeOrcamentaria: data.unidadeOrcamentaria,
      elemento: data.elemento,
      subelemento: data.subelemento,
      gestao: data.gestao,
      historico: data.historico,
      dataProvisaoConcedida: data.dataProvisaoConcedida || null,
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

  const handleSalvar = handleSubmit(onSubmit, onError);

  return (
    <FormProvider {...methods}>
    <div className="flex flex-col h-full bg-transparent">
      <div className="p-8 max-w-[1400px] mx-auto w-full flex-1 space-y-8 animate-fade-in">
        
        {/* HEADER & ACTION BUTTONS */}
        <div className="flex flex-col md:flex-row md:items-end justify-between">
          <div>
            <div className="flex items-center text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">
              Início &gt; Gestão Financeira &gt; <span className="text-blue-900 ml-1">Notas de Empenho</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight">
              Cadastro de Nota de Empenho
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
              type="button"
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
                {...register("valorNE")}
                onChange={(e) => {
                  const masked = maskCurrency(e.target.value);
                  e.target.value = masked;
                  setValue("valorNE", masked, { shouldValidate: true, shouldDirty: true });
                }}
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
                onChange={(e) => {
                  setValue("elemento", e.target.value, { shouldValidate: true, shouldDirty: true });
                  // Só limpa o subelemento numa troca manual do usuário (onChange
                  // real do select) — nunca num reset() programático de edição,
                  // que carrega elemento e subelemento juntos.
                  setValue("subelemento", "", { shouldValidate: true, shouldDirty: true });
                }}
                disabled={elementosLoading}
                aria-describedby={elementosErro ? "ne-elemento-erro" : undefined}
                className="w-full px-4 py-3 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-bold focus:outline-none focus:ring-4 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10 text-slate-700 transition-all duration-300 disabled:opacity-60 disabled:cursor-wait"
              >
                <option value="">{elementosLoading ? "Carregando elementos..." : "Selecione o Elemento"}</option>
                {elementos.map((el) => (
                  <option key={el.codigo} value={el.valor}>
                    {el.valor}{el.legado ? " (legado)" : ""}
                  </option>
                ))}
                {!!elementoWatch && !elementoReconhecido && (
                  <option value={elementoWatch}>(legado) {elementoWatch}</option>
                )}
              </select>
              {elementosErro && (
                <p id="ne-elemento-erro" className="text-red-500 text-xs mt-1.5 font-bold">
                  Erro ao carregar elementos: {elementosErro}{" "}
                  <button type="button" onClick={recarregarElementos} className="underline">Tentar de novo</button>
                </p>
              )}
            </div>
            <SubelementoCampo subelementos={subelementosDisponiveis} />

            <div className="md:col-span-4">
              <label htmlFor="ne-historico" className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Observações</label>
              <textarea
                id="ne-historico"
                rows={3}
                placeholder="Observações do empenho..."
                {...register("historico")}
                className="w-full px-4 py-3 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-medium focus:outline-none focus:bg-white focus:ring-4 focus:ring-blue-900/10 focus:border-blue-800 transition-all duration-300 resize-none text-slate-700"
              ></textarea>
            </div>

            <FaixaSaldoNe valorCents={toCents(valorNEWatch ?? "")} gastoCents={gastoNeCents} />
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
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">Cadastro</th>
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">Quem Atualizou</th>
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">Observações</th>
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest text-right">Valor</th>
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest text-right">Gasto</th>
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest text-right">Restante</th>
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest text-center">Status</th>
                  <th className="pb-4 pr-2 text-sm font-black text-slate-500 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
                       Carregando...
                    </td>
                  </tr>
                ) : notas.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
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
                        {formatDate(ne.criadaEm || "")}
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
                      <td className={`py-5 font-semibold text-right ${isCancelado ? textStyle : 'text-slate-600'}`}>
                        {ne.saldo ? `R$ ${formatarBRL(toCents(ne.saldo.gasto))}` : "-"}
                      </td>
                      <td className={`py-5 text-right ${isCancelado ? textStyle : ''}`}>
                        {ne.saldo ? (
                          <div className="inline-flex flex-col items-end gap-1">
                            <span className={`font-black ${ne.saldo.restante < 0 ? 'text-red-600' : 'text-emerald-700'}`}>R$ {formatarBRL(toCents(ne.saldo.restante))}</span>
                            <span className="block h-1.5 w-20 rounded-full bg-slate-200 overflow-hidden" aria-hidden="true">
                              <span className="block h-full bg-blue-800" style={{ width: `${percentualDaBarra(toCents(ne.saldo.valor), toCents(ne.saldo.gasto))}%` }} />
                            </span>
                          </div>
                        ) : (
                          "-"
                        )}
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
                                reset(formularioDaNe(ne));
                                setGastoNeCents(toCents(ne.saldo?.gasto ?? 0));
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
    </FormProvider>
  );
}
