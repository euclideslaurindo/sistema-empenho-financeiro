import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ActionToolbar, ActionButton } from "@/components/action-toolbar";
import {
  Plus,
  Save,
  Edit2,
  Search,
  Trash2,
  Eye,
  Pencil,
  FileText,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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
}

const notaEmpenhoSchema = z.object({
  codigoNE: z.string().min(1, "Código é obrigatório"),
  numeroNE: z.string().min(1, "Número da NE é obrigatório"),
  valorNE: z.union([z.string(), z.number()]).transform(val => {
    const clean = String(val).replace(/[^\d,-]/g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  }).refine(val => val > 0, { message: "O valor da NE deve ser maior que zero." }),
  dataPagamento: z.string().min(1, "Data é obrigatória"),
  unidadeOrcamentaria: z.string().optional(),
  elementoSubelemento: z.string().optional(),
  gestao: z.string().optional(),
  historico: z.string().optional(),
});

type NotaEmpenhoFormValues = z.input<typeof notaEmpenhoSchema>;

export default function NotasEmpenho() {
  const router = useRouter();
  const [notas, setNotas] = useState<NotaEmpenho[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form state via React Hook Form
  const { register, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<NotaEmpenhoFormValues>({
    resolver: zodResolver(notaEmpenhoSchema),
    defaultValues: {
      codigoNE: "",
      numeroNE: "",
      valorNE: "",
      dataPagamento: "",
      unidadeOrcamentaria: "",
      elementoSubelemento: "",
      gestao: "",
      historico: "",
    }
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchNotas = useCallback(async (busca = "") => {
    setIsLoading(true);
    try {
      const url = busca ? `/api/notas-empenho?busca=${encodeURIComponent(busca)}` : "/api/notas-empenho";
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setNotas(data.notas || []);
      } else {
        // Fallback p/ Teste Visual quando o BD está offline
        toast.error("Banco de dados offline. Carregando dados de teste (Mock)...");
        setNotas([
          {
            id: "mock-1",
            codigo: "2024NE00142",
            numero: "8421/2024",
            valor: 12450.0,
            dataPagamento: "2024-03-10",
            unidadeOrcamentaria: "Secretaria de Educação",
            elementoSubelemento: "3.3.90.30",
            gestao: "140101",
            historico: "Referente à aquisição de materiais de escritório.",
            status: "ATIVO"
          },
          {
            id: "mock-2",
            codigo: "2024NE00143",
            numero: "8422/2024",
            valor: 25000.0,
            dataPagamento: "2024-05-20",
            unidadeOrcamentaria: "Secretaria de Saúde",
            elementoSubelemento: "3.3.90.32",
            gestao: "140102",
            historico: "Aquisição de medicamentos hospitalares.",
            status: "ATIVO"
          }
        ]);
      }
    } catch {
      toast.error("Erro de conexão. Carregando dados de teste (Mock)...");
      setNotas([
        {
          id: "mock-1",
          codigo: "2024NE00142",
          numero: "8421/2024",
          valor: 12450.0,
          dataPagamento: "2024-03-10",
          unidadeOrcamentaria: "Secretaria de Educação",
          elementoSubelemento: "3.3.90.30",
          gestao: "140101",
          historico: "Referente à aquisição de materiais de escritório.",
          status: "ATIVO"
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotas();
  }, [fetchNotas]);

  // Alerta de prazo: data > 60 dias atrás
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

  // Detecção de duplicata por valor
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
      dataPagamento: ne.dataPagamento || "",
      valorNE: String(ne.valor),
      unidadeOrcamentaria: ne.unidadeOrcamentaria || "",
      elementoSubelemento: ne.elementoSubelemento || "",
      gestao: ne.gestao || "",
      historico: ne.historico || "",
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
      unidadeOrcamentaria: "",
      elementoSubelemento: "",
      gestao: "",
      historico: "",
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
      status: "EMITIDO",
    };

    try {
      let res: Response;
      if (editingId) {
        res = await fetch(`/api/notas-empenho/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/notas-empenho", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erro ao salvar NE.");
        return;
      }

      toast.success(editingId ? "NE atualizada com sucesso!" : "NE cadastrada com sucesso!");
      handleIncluir();
      await fetchNotas();
    } catch {
      toast.error("Erro de conexão com o servidor.");
    }
  };

  const handleExcluir = async () => {
    if (!editingId) {
      toast.error("Nenhuma NE selecionada. Clique em uma NE da tabela primeiro.");
      return;
    }
    try {
      const res = await fetch(`/api/notas-empenho/${editingId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erro ao cancelar NE.");
        return;
      }
      toast.success("NE cancelada com sucesso!");
      handleIncluir();
      await fetchNotas();
    } catch {
      toast.error("Erro de conexão com o servidor.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "LIQUIDADO":
        return (
          <span className="inline-block px-2.5 py-1 rounded border border-[#bbf7d0] bg-[#f0fdf4] text-xs font-semibold text-[#166534]">
            Efetivado
          </span>
        );
      case "CANCELADO":
        return (
          <span className="inline-block px-2.5 py-1 rounded border border-indigo-200 bg-indigo-50 text-xs font-semibold text-indigo-700">
            Cancelado
          </span>
        );
      default:
        return (
          <span className="inline-block px-2.5 py-1 rounded border border-[#a7c8ff] bg-[#f0f4ff] text-xs font-semibold text-[#1e293b]">
            Processando
          </span>
        );
    }
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
    <div className="flex flex-col h-full bg-[#f4f4f5]">
      <ActionToolbar>
        <ActionButton icon={Plus} label="Incluir" onClick={handleIncluir} />
        <ActionButton icon={Save} label="Salvar" onClick={handleSalvar} />
        <ActionButton
          icon={Edit2}
          label="Editar"
          onClick={() => {
            if (!editingId) toast.info("Clique em uma NE da tabela para editar.");
            else toast.success("Modo edição ativado.");
          }}
        />
        <ActionButton
          icon={Trash2}
          label="Cancelar NE"
          warning
          onClick={handleExcluir}
        />
        <ActionButton
          icon={RefreshCw}
          label="Atualizar"
          onClick={() => fetchNotas()}
        />
      </ActionToolbar>

      <div className="p-8 max-w-[1280px] mx-auto w-full flex-1">
        <div className="mb-8">
          <p className="text-xs font-medium text-zinc-500 mb-2 tracking-wider">
            Início &gt; Notas de Empenho &gt; Cadastro de NE
          </p>
        </div>

        {showAlerta && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-start gap-3 shadow-sm">
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

        {/* Formulário */}
        <div className="bg-[#fafafa] rounded-lg border border-[#e4e4e7] shadow-sm p-8 mb-8 relative w-full">
          <div className="flex items-center mb-6 border-b border-[#e4e4e7] pb-4">
            <div className="w-8 h-8 rounded-md bg-[#e3f2fd] flex items-center justify-center text-[#003366] mr-3">
              <FileText className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-[#1e293b]">
              {editingId ? "Editando NE" : "Cadastro de Número de Empenho (NE)"}
            </h2>
            {editingId && (
              <span className="ml-3 text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                Modo Edição
              </span>
            )}
          </div>

          <form className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">
                Código <span className="text-[#ba1a1a]">*</span>
              </label>
              <input
                type="text"
                placeholder="NE-2024-001"
                {...register("codigoNE")}
                className={`w-full p-2.5 border rounded text-sm focus:outline-none focus:border-[#1e293b] text-slate-800 ${errors.codigoNE ? 'border-red-500 bg-red-50' : 'border-[#d9dadb] bg-[#f4f4f5]'}`}
              />
              {errors.codigoNE && <p className="text-red-500 text-xs mt-1">{errors.codigoNE.message as string}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">
                Número da NE <span className="text-[#ba1a1a]">*</span>
              </label>
              <input
                type="text"
                placeholder="Ex: 2024NE000123"
                {...register("numeroNE")}
                className={`w-full p-2.5 border rounded text-sm focus:outline-none focus:border-[#1e293b] text-slate-800 ${errors.numeroNE ? 'border-red-500 bg-red-50' : 'border-[#d9dadb]'}`}
              />
              {errors.numeroNE && <p className="text-red-500 text-xs mt-1">{errors.numeroNE.message as string}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">
                Valor (R$) <span className="text-[#ba1a1a]">*</span>
              </label>
              <input
                type="text"
                placeholder="R$ 0,00"
                {...register("valorNE")}
                className={`w-full p-2.5 border rounded text-sm focus:outline-none text-slate-800 ${
                  errors.valorNE
                    ? 'border-red-500 bg-red-50 focus:border-red-600'
                    : duplicatedNe
                    ? "border-amber-500 bg-amber-50 focus:border-amber-600"
                    : "border-[#d9dadb] focus:border-[#1e293b]"
                }`}
              />
              {errors.valorNE && <p className="text-red-500 text-xs mt-1">{errors.valorNE.message as string}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">
                Data de Pagamento <span className="text-[#ba1a1a]">*</span>
              </label>
              <input
                type="date"
                {...register("dataPagamento")}
                className={`w-full p-2.5 border rounded text-sm focus:outline-none focus:border-[#1e293b] text-slate-800 ${errors.dataPagamento ? 'border-red-500 bg-red-50' : 'border-[#d9dadb]'}`}
              />
              {errors.dataPagamento && <p className="text-red-500 text-xs mt-1">{errors.dataPagamento.message as string}</p>}
            </div>
          </form>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">
                Unidade Orçamentária
              </label>
              <input
                type="text"
                {...register("unidadeOrcamentaria")}
                className="w-full p-2.5 border border-[#d9dadb] rounded text-sm focus:outline-none focus:border-[#1e293b] text-slate-800"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">
                Gestão
              </label>
              <input
                type="text"
                {...register("gestao")}
                className="w-full p-2.5 border border-[#d9dadb] rounded text-sm focus:outline-none focus:border-[#1e293b] text-slate-800"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1">
                Elemento/Subelemento
              </label>
              <input
                type="text"
                {...register("elementoSubelemento")}
                className="w-full p-2.5 border border-[#d9dadb] rounded text-sm focus:outline-none focus:border-[#1e293b] text-slate-800"
              />
            </div>
          </div>
          <div className="mt-6">
            <label className="block text-sm font-semibold text-slate-800 mb-1">
              Histórico / Especificação
            </label>
            <textarea
              rows={3}
              {...register("historico")}
              className="w-full p-2.5 border border-[#d9dadb] rounded text-sm focus:outline-none focus:border-[#1e293b] text-slate-800"
            />
          </div>

          {duplicatedNe && (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-md flex items-start gap-3 shadow-sm">
              <span className="text-xl">⚠️</span>
              <div className="flex-1">
                <h3 className="font-bold text-sm">Possível Duplicação de Valores</h3>
                <p className="text-xs mt-1">
                  Encontramos a NE <strong>{duplicatedNe.numero}</strong> com valor similar.
                </p>
                <button
                  type="button"
                  onClick={() => handleLoadDuplicate(duplicatedNe)}
                  className="mt-2 text-xs font-semibold px-3 py-1.5 bg-amber-200 hover:bg-amber-300 rounded transition-colors text-amber-900 border border-amber-300"
                >
                  Carregar dados da NE {duplicatedNe.numero}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tabela */}
        <div className="mb-4 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
          <div>
            <h3 className="text-lg font-bold text-[#1e293b]">
              Notas de Empenho
            </h3>
            <p className="text-zinc-600 text-sm">
              {isLoading ? "Carregando..." : `${notas.length} nota(s) encontrada(s)`}
            </p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar por número ou código..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                fetchNotas(e.target.value);
              }}
              className="w-full pl-9 pr-3 py-2 border border-[#d9dadb] rounded text-sm focus:outline-none focus:border-[#1e293b]"
            />
          </div>
        </div>

        <div className="bg-[#fafafa] rounded-lg border border-[#e4e4e7] shadow-sm overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#f4f4f5] text-zinc-600 font-semibold border-b border-[#e4e4e7]">
                <tr>
                  <th className="px-6 py-4">Número da NE</th>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Unidade / Gestão</th>
                  <th className="px-6 py-4">Histórico</th>
                  <th className="px-6 py-4">Valor</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                      Carregando...
                    </td>
                  </tr>
                ) : notas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                      Nenhuma nota de empenho cadastrada.
                    </td>
                  </tr>
                ) : (
                  notas.map((ne) => (
                    <tr
                      key={ne.id}
                      className={`border-b border-[#e4e4e7] hover:bg-[#f4f4f5] cursor-pointer ${
                        editingId === ne.id ? "bg-amber-50" : ""
                      }`}
                      onClick={() => {
                        setCodigoNE(ne.codigo || "");
                        setNumeroNE(ne.numero);
                        setValorNE(String(ne.valor));
                        setDataPagamento(ne.dataPagamento || "");
                        setUnidadeOrcamentaria(ne.unidadeOrcamentaria || "");
                        setElementoSubelemento(ne.elementoSubelemento || "");
                        setGestao(ne.gestao || "");
                        setHistorico(ne.historico || "");
                        setEditingId(ne.id);
                      }}
                    >
                      <td className="px-6 py-4 font-medium">{ne.numero}</td>
                      <td className="px-6 py-4 text-zinc-600">{formatDate(ne.dataPagamento)}</td>
                      <td className="px-6 py-4 text-zinc-600 max-w-[150px] truncate" title={`${ne.unidadeOrcamentaria || "-"} / ${ne.gestao || "-"}`}>
                        {ne.unidadeOrcamentaria || "-"} / {ne.gestao || "-"}
                      </td>
                      <td className="px-6 py-4 text-zinc-600 max-w-[200px] truncate" title={ne.historico}>
                        {ne.historico || "-"}
                      </td>
                      <td className="px-6 py-4 font-medium">{formatCurrency(ne.valor)}</td>
                      <td className="px-6 py-4">{getStatusBadge(ne.status)}</td>
                      <td className="px-6 py-4 flex gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toast.info(`NE ${ne.numero} — ${ne.status}`);
                          }}
                          className="text-zinc-600 hover:text-[#1e293b]"
                          title="Visualizar"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/ordem-pagamento?ne=${ne.numero}`);
                          }}
                          className="text-zinc-600 hover:text-[#1e293b]"
                          title="Gerar Ordem de Pagamento"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 pt-4 flex justify-center text-xs text-zinc-500">
          <p>
            © 2024 Sistema de Empenho - Gestão de Pagamentos. Todos os direitos
            reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
