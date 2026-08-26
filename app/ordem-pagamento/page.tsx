"use client";
import { useState, useEffect, Suspense, useCallback } from "react";
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
  Calendar,
  ShieldAlert,
  ExternalLink,
  FileText,
  Calculator,
  AlertTriangle,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { toast } from "sonner";


const ordemPagamentoSchema = z.object({
  numeroNe: z.string().min(1, "Obrigatório"),
  empenho: z.string().min(1, "Obrigatório"),
  gestao: z.string().optional(),
  unidade: z.string().optional(),
  elementoSubelemento: z.string().optional(),
  sub: z.string().optional(),
  nomeCredor: z.string().min(1, "Obrigatório"),
  cpfCnpj: z.string().min(1, "Obrigatório"),
  rgIe: z.string().optional(),
  endereco: z.string().optional(),
  saldoAnterior: z.number().optional(),
  valorEmpenho: z.number().optional(),
  historico: z.string().min(1, "Obrigatório"),
  dataPagamento: z.string().optional(),
  dataEmissao: z.string().optional(),
  dataPagamentoNE: z.string().min(1, "Obrigatório"),
  
  itemUnidade: z.string().optional(),
  itemQuantidade: z.union([z.string(), z.number()]).optional(),
  itemValorUnitario: z.string().optional(),
  itemUnidade2: z.string().optional(),
  itemQuantidade2: z.union([z.string(), z.number()]).optional(),
  itemValorUnitario2: z.string().optional(),
  
  valorPagamento: z.union([z.string(), z.number()]).transform(val => {
    if (typeof val === 'number') return val;
    const clean = String(val).replace(/[^\d,-]/g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  }).refine(val => val > 0, { message: "Deve ser maior que zero." }),

  numeroCheque: z.string().min(1, "Obrigatório"),
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
  appliedTax_sestSenat: z.boolean().optional(),
  appliedTax_patronal: z.boolean().optional(),
  appliedTax_outrosDescontos: z.boolean().optional(),
});

type OpFormValues = z.input<typeof ordemPagamentoSchema>;

function OrdemPagamentoContent() {
  
  const searchParams = useSearchParams();
  const initialNe = searchParams?.get("ne") || "2024NE00142";
  const { credores } = useAppStore();

  const { register, handleSubmit, watch, reset, setValue, getValues, formState: { errors } } = useForm<OpFormValues>({
    resolver: zodResolver(ordemPagamentoSchema),
    defaultValues: {
      numeroNe: initialNe,
      empenho: "", gestao: "", unidade: "", elementoSubelemento: "", sub: "01",
      nomeCredor: "", cpfCnpj: "", rgIe: "", endereco: "",
      saldoAnterior: 0, valorEmpenho: 0, historico: "", 
      dataPagamentoNE: "", dataEmissao: "2024-05-15",
      itemUnidade: "UN", itemQuantidade: "1", itemValorUnitario: "0",
      itemUnidade2: "", itemQuantidade2: "", itemValorUnitario2: "",
      valorPagamento: 0,
      numeroCheque: "",
      irrf: 0, iss: 0, inss: 0, sestSenat: 0, patronal: 0, outrosDescontos: 0,
      autoCalculate: true,
      appliedTax_irrf: true, appliedTax_iss: true, appliedTax_inss: true,
      appliedTax_sestSenat: false, appliedTax_patronal: false, appliedTax_outrosDescontos: false
    }
  });

  const [neData, setNeData] = useState<any>({});
  const [descontos, setDescontos] = useState<any>({ numeroCheque: "" });
  const [appliedTaxes, setAppliedTaxes] = useState<any>({
    irrf: true, iss: true, inss: true, sestSenat: false, patronal: false, outrosDescontos: false
  });
  const [autoCalculate, setAutoCalculate] = useState(true);
  const saldoAtual = Number(watch("saldoAnterior") || 0) - Number(watch("valorPagamento") || 0);
  const [activeTab, setActiveTab] = useState<"geral" | "descontos">("geral");
  const [showAlertaPrazo, setShowAlertaPrazo] = useState(false);
  const [showCredorModal, setShowCredorModal] = useState(false);
  const [showNeModal, setShowNeModal] = useState(false);
  const [searchCredorQuery, setSearchCredorQuery] = useState("");
  const [searchNeQuery, setSearchNeQuery] = useState("");
  const [nesDB, setNesDB] = useState<any[]>([]);
  const [credoresDB, setCredoresDB] = useState<any[]>([]);
  const [editingOpId, setEditingOpId] = useState<string | null>(null);
  const [showOpModal, setShowOpModal] = useState(false);
  const [opsDB, setOpsDB] = useState<any[]>([]);
  const [searchOpQuery, setSearchOpQuery] = useState("");

  const [chequesEmitidos, setChequesEmitidos] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("chequesEmitidos");
        if (stored) return JSON.parse(stored);
        return ["040496", "040497", "040498"];
      } catch (e) { return ["040496", "040497", "040498"]; }
    }
    return ["040496", "040497", "040498"];
  });

  // Watches
  const wNumeroNe = watch("numeroNe");
  const wCpfCnpj = watch("cpfCnpj");
  const wNomeCredor = watch("nomeCredor");
  const wDataPagamentoNE = watch("dataPagamentoNE");
  const wValorPagamento = watch("valorPagamento");
  const wAutoCalculate = watch("autoCalculate");
  const wCheque = watch("numeroCheque");
  const wApplied = {
    irrf: watch("appliedTax_irrf"), iss: watch("appliedTax_iss"),
    inss: watch("appliedTax_inss"), sestSenat: watch("appliedTax_sestSenat"),
    patronal: watch("appliedTax_patronal"), outrosDescontos: watch("appliedTax_outrosDescontos")
  };
  const wDesc = {
    irrf: watch("irrf")||0, iss: watch("iss")||0, inss: watch("inss")||0,
    sestSenat: watch("sestSenat")||0, patronal: watch("patronal")||0, outrosDescontos: watch("outrosDescontos")||0
  };
  const wSaldoAnterior = watch("saldoAnterior") || 0;

  // Calculos itens
  const wQ1 = watch("itemQuantidade");
  const wV1 = watch("itemValorUnitario");
  const wQ2 = watch("itemQuantidade2");
  const wV2 = watch("itemValorUnitario2");
  
  const parsedQuantidade = parseFloat(String(wQ1||"").replace(",", ".")) || 0;
  const parsedUnitario = parseFloat(String(wV1||"").replace(",", ".")) || 0;
  const calculatedTotal1 = parsedQuantidade * parsedUnitario;

  const parsedQuantidade2 = parseFloat(String(wQ2||"").replace(",", ".")) || 0;
  const parsedUnitario2 = parseFloat(String(wV2||"").replace(",", ".")) || 0;
  const calculatedTotal2 = parsedQuantidade2 * parsedUnitario2;

  const calculatedTotal = calculatedTotal1 + calculatedTotal2;

  useEffect(() => {
    if (calculatedTotal > 0) setValue("valorPagamento", calculatedTotal);
  }, [calculatedTotal, setValue]);

  const handleCpfCnpjChange = async (value: string) => {
    setValue("cpfCnpj", value);
    const strippedValue = value.replace(/\D/g, "");
    if (strippedValue.length >= 11) {
      const res = await fetch(`/api/credores?busca=${strippedValue}`);
      const data = await res.json();
      const match = data.credores?.find((c: any) => c.cpfCnpj.replace(/\D/g, "") === strippedValue);
      if (match) {
        setValue("nomeCredor", match.nome);
        setValue("rgIe", match.rg);
        setValue("endereco", match.endereco);
        toast.success("Credor preenchido automaticamente");
      }
    }
  };

  useEffect(() => {
    if (showNeModal && nesDB.length === 0) fetch('/api/notas-empenho').then(r => r.json()).then(d => { if (d.notas) setNesDB(d.notas); }).catch(() => {});
  }, [showNeModal]);
  useEffect(() => {
    if (showCredorModal && credoresDB.length === 0) fetch('/api/credores').then(r => r.json()).then(d => { if (d.credores) setCredoresDB(d.credores); }).catch(() => {});
  }, [showCredorModal]);
  useEffect(() => {
    if (showOpModal && opsDB.length === 0) fetch('/api/ordens-pagamento').then(r => r.json()).then(d => { if (d.ordens) setOpsDB(d.ordens); }).catch(() => {});
  }, [showOpModal]);

  const getCreditorDiagnose = () => {
    const inputCpfClean = (wCpfCnpj || "").replace(/\D/g, "");
    const inputNomeClean = (wNomeCredor || "").trim().toLowerCase();
    if (!inputCpfClean && !inputNomeClean) return null;
    if (inputCpfClean) {
      const matchByCpf = credores.find((c) => c.cpfCnpj.replace(/\D/g, "") === inputCpfClean);
      if (matchByCpf && matchByCpf.nome.trim().toLowerCase() !== inputNomeClean) return { type: "warning", message: `Erro: CPF/CNPJ pertence a "${matchByCpf.nome}".` };
    }
    if (inputNomeClean) {
      const matchByNome = credores.find((c) => c.nome.trim().toLowerCase() === inputNomeClean);
      if (matchByNome) {
        const dbCpfClean = matchByNome.cpfCnpj.replace(/\D/g, "");
        if (dbCpfClean !== inputCpfClean && inputCpfClean !== "") return { type: "warning", message: `Erro: Credor "${matchByNome.nome}" tem CPF "${matchByNome.cpfCnpj}".` };
      }
    }
    return null;
  };

  const creditorDiagnose = getCreditorDiagnose();
  const cleanChequeInput = (wCheque || "").trim();
  const isChequeDuplicate = cleanChequeInput ? chequesEmitidos.includes(cleanChequeInput) : false;

  let showAlerta = false;
  if (wDataPagamentoNE) {
    const parts = wDataPagamentoNE.split("-");
    if (parts.length === 3) {
      const selectedDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      const today = new Date();
      const diffTime = Math.abs(today.getTime() - selectedDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (selectedDate < today && diffDays >= 60) showAlerta = true;
    }
  }

  useEffect(() => {
    const vp = Number(wValorPagamento) || 0;
    if (wAutoCalculate && vp > 0) {
      setValue("irrf", wApplied.irrf ? Number((vp * 0.015).toFixed(2)) : 0);
      setValue("iss", wApplied.iss ? Number((vp * 0.05).toFixed(2)) : 0);
      setValue("inss", wApplied.inss ? Number((vp * 0.11).toFixed(2)) : 0);
      setValue("sestSenat", wApplied.sestSenat ? Number((vp * 0.025).toFixed(2)) : 0);
      setValue("patronal", wApplied.patronal ? Number((vp * 0.20).toFixed(2)) : 0);
      // outrosDescontos retains value if applied
      if(!wApplied.outrosDescontos) setValue("outrosDescontos", 0);
    } else if (wAutoCalculate && vp === 0) {
      setValue("irrf", 0); setValue("iss", 0); setValue("inss", 0);
      setValue("sestSenat", 0); setValue("patronal", 0); setValue("outrosDescontos", 0);
    }
  }, [wValorPagamento, wAutoCalculate, wApplied.irrf, wApplied.iss, wApplied.inss, wApplied.sestSenat, wApplied.patronal, wApplied.outrosDescontos, setValue]);

  const loadNe = async () => {
    if (!wNumeroNe.trim()) { toast.error("Digite o número da NE antes de localizar."); return; }
    try {
      const res = await fetch(`/api/notas-empenho?numero=${encodeURIComponent(wNumeroNe.trim())}`);
      const apiData = await res.json();
      if (res.ok && apiData.ne) {
        const ne = apiData.ne;
        setValue("empenho", ne.numero); setValue("gestao", ne.gestao || ''); setValue("unidade", ne.unidadeOrcamentaria || '');
        setValue("elementoSubelemento", ne.elementoSubelemento || ''); setValue("sub", '01');
        setValue("saldoAnterior", ne.valor || 0); setValue("valorEmpenho", ne.valor || 0);
        setValue("historico", ne.historico || ''); setValue("dataPagamentoNE", ne.dataPagamento || '');
        setValue("itemQuantidade", '1'); setValue("itemValorUnitario", String(ne.valor || 0));
        setValue("valorPagamento", ne.valor || 0);
        toast.success(`Dados da NE ${wNumeroNe} carregados.`);
        return;
      }
    } catch {}
    toast.error('NE não encontrada.');
  };

  const handleAction = async (action: string) => {
    if (action === "Incluir") {
      setEditingOpId(null);
      reset({
        numeroNe: "", empenho: "", gestao: "", unidade: "", elementoSubelemento: "", sub: "01",
        nomeCredor: "", cpfCnpj: "", rgIe: "", endereco: "", saldoAnterior: 0, valorEmpenho: 0, historico: "",
        dataPagamentoNE: "", dataEmissao: "2024-05-15", itemUnidade: "UN", itemQuantidade: "1", itemValorUnitario: "0",
        itemUnidade2: "", itemQuantidade2: "", itemValorUnitario2: "", valorPagamento: 0, numeroCheque: "",
        irrf: 0, iss: 0, inss: 0, sestSenat: 0, patronal: 0, outrosDescontos: 0, autoCalculate: true,
        appliedTax_irrf: true, appliedTax_iss: true, appliedTax_inss: true, appliedTax_sestSenat: false, appliedTax_patronal: false, appliedTax_outrosDescontos: false
      });
      toast.success("Formulário limpo.");
    } else if (action === "Localizar" || action === "Modificar") {
      setShowOpModal(true);
    } else if (action === "Excluir") {
      if (!editingOpId) { toast.error("Nenhuma Ordem de Pagamento selecionada."); return; }
      if (confirm("Tem certeza que deseja EXCLUIR esta Ordem?")) {
        fetch(`/api/ordens-pagamento/${editingOpId}`, { method: "DELETE" }).then(async (res) => {
            if (res.ok) { toast.success("Excluída!"); handleAction("Incluir"); }
            else { const data = await res.json(); toast.error(data.error || "Erro ao excluir."); }
        }).catch(() => toast.error("Erro de conexão."));
      }
    }
  };

  const onSubmit = async (data: any) => {
    if (data.valorPagamento > data.saldoAnterior) { toast.error(`O Valor do Pagamento (R$ ${data.valorPagamento}) não pode ser maior que o Saldo Anterior (R$ ${data.saldoAnterior}).`); setActiveTab("geral"); return; }
    if (isChequeDuplicate) { toast.error(`Cheque "${data.numeroCheque}" já utilizado.`); setActiveTab("descontos"); return; }

    const currentSub = parseInt(data.sub || "0", 10);
    const newSub = (currentSub + 1).toString().padStart(2, "0");
    const newSaldoAnterior = data.saldoAnterior - data.valorPagamento;

    try {
      const url = editingOpId ? `/api/ordens-pagamento/${editingOpId}` : "/api/ordens-pagamento";
      const method = editingOpId ? "PUT" : "POST";
      const apiRes = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numeroNe: data.numeroNe, numeroEmpenho: data.empenho, sub: newSub,
          credorNome: data.nomeCredor, credorCpfCnpj: data.cpfCnpj, credorRg: data.rgIe, credorEndereco: data.endereco,
          unidadeOrcamentaria: data.unidade, elementoSubelemento: data.elementoSubelemento, gestao: data.gestao, historico: data.historico,
          itemUnidade: data.itemUnidade, itemQuantidade: data.itemQuantidade, itemValorUnitario: data.itemValorUnitario,
          itemUnidade2: data.itemUnidade2, itemQuantidade2: data.itemQuantidade2, itemValorUnitario2: data.itemValorUnitario2,
          saldoAnterior: data.saldoAnterior, valorEmpenho: data.valorEmpenho, valorPagamento: data.valorPagamento,
          irrf: data.irrf, iss: data.iss, inss: data.inss, sestSenat: data.sestSenat, patronal: data.patronal, outrosDescontos: data.outrosDescontos,
          totalDescontos: Number(data.irrf)+Number(data.iss)+Number(data.inss)+Number(data.sestSenat)+Number(data.patronal)+Number(data.outrosDescontos),
          valorLiquido: data.valorPagamento - (Number(data.irrf)+Number(data.iss)+Number(data.inss)+Number(data.sestSenat)+Number(data.patronal)+Number(data.outrosDescontos)),
          numeroCheque: data.numeroCheque, dataEmissao: data.dataEmissao, dataPagamento: data.dataPagamentoNE,
        }),
      });
      const apiData = await apiRes.json();
      if (!apiRes.ok) { toast.error(apiData.error || "Erro ao salvar ordem no banco."); return; }
      
      setValue("saldoAnterior", newSaldoAnterior);
      setValue("sub", newSub);
      if (!editingOpId) {
         setValue("valorPagamento", 0);
         setValue("numeroCheque", "");
      }
      toast.success(`Ordem de Pagamento (NE ${data.numeroNe} / SUB ${newSub}) salva!`);
    } catch { toast.error("Erro de conexão ao salvar."); }
  };

  const onError = () => { toast.error("Preencha os campos obrigatórios em vermelho."); };
  const handleSubmitForm = handleSubmit(onSubmit, onError);

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  const totalDescontos = wDesc.irrf + wDesc.iss + wDesc.inss + wDesc.sestSenat + wDesc.patronal + wDesc.outrosDescontos;
  const liquidoOrdem = (Number(wValorPagamento) || 0) - totalDescontos;

  return (
    <div className="flex flex-col h-full bg-[#f4f4f5]">
      <ActionToolbar>
        <ActionButton
          icon={Search}
          label="Localizar"
          onClick={() => loadNe()}
        />
        <ActionButton
          icon={Plus}
          label="Incluir"
          onClick={() => handleAction("Incluir")}
        />
        <ActionButton
          icon={Edit2}
          label="Modificar"
          onClick={() => handleAction("Modificar")}
        />
        <ActionButton
          icon={Trash2}
          label="Excluir"
          warning
          onClick={() => handleAction("Excluir")}
        />
        <div className="flex-1"></div>
        <ActionButton
          icon={Save}
          label="Salvar Ordem"
          primary
          onClick={handleSubmitForm}
        />
      </ActionToolbar>

      <div className="p-8 max-w-[1280px] mx-auto w-full flex-1">
        {showAlertaPrazo && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-start gap-3 shadow-sm max-w-4xl mx-auto">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="text-red-800 font-bold text-sm">
                Atenção: Prazo de Execução Expirado
              </h3>
              <p className="text-red-700 text-sm mt-1">
                O recurso desta Nota de Empenho já passou do prazo recomendado
                de 60 dias para execução.
              </p>
            </div>
          </div>
        )}
        <div className="bg-[#fafafa] rounded-2xl border border-[#e4e4e7] shadow-sm p-4 max-w-4xl mx-auto mb-6 transition-all hover:shadow-md">
          {/* Form Header */}
          <div className="flex justify-between items-start">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-[#1e293b] rounded-xl flex items-center justify-center mr-4 text-indigo-600">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-medium text-[#1e293b]">
                  Ordem de Pagamento de Empenhos
                </h1>
                <p className="text-sm text-[#1e293b]/60">
                  Preencha os dados do Anverso e do Verso
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#1e293b]/60 font-semibold uppercase tracking-wider mb-1">
                Número do Empenho
              </p>
              <p className="text-xl font-display font-medium text-[#1e293b] uppercase">
                {wNumeroNe}/EMPENHO –{" "}
                {parseInt(neData.sub || "1", 10)
                  .toString()
                  .padStart(2, "0")}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-4xl mx-auto mb-4 border-b border-[#e4e4e7] flex gap-4">
          <button
            onClick={() => setActiveTab("geral")}
            className={`py-3 px-6 font-bold text-sm tracking-wide border-b-2 transition-colors flex items-center ${activeTab === "geral" ? "border-indigo-500 text-indigo-600" : "border-transparent text-[#1e293b]/60 hover:text-indigo-600"}`}
          >
            <FileText className="w-4 h-4 mr-2" /> DADOS GERAIS (ANVERSO)
          </button>
          <button
            onClick={() => setActiveTab("descontos")}
            className={`py-3 px-6 font-bold text-sm tracking-wide border-b-2 transition-colors flex items-center ${activeTab === "descontos" ? "border-indigo-500 text-indigo-600" : "border-transparent text-[#1e293b]/60 hover:text-indigo-600"}`}
          >
            <Calculator className="w-4 h-4 mr-2" /> DESCONTOS / RECIBO (VERSO)
          </button>
        </div>

        <div className="bg-[#fafafa] rounded-2xl border border-[#e4e4e7] shadow-sm p-8 max-w-4xl mx-auto transition-all hover:shadow-md">
          {activeTab === "geral" ? (
            <>
              {/* Row 1 */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">
                    Número de NE
                  </label>
                  <div className="flex">
                    <input
                      type="text"
                      {...register("numeroNe")} onBlur={loadNe}
                      className="w-full p-2 rounded-l border border-r-0 border-[#d9dadb] focus:outline-none focus:border-[#1e293b] text-sm text-slate-800 uppercase"
                    />\n{errors.numeroNe && <p className="text-red-500 text-xs mt-1">{errors.numeroNe.message as string}</p>}
                    <button
                      onClick={() => setShowNeModal(true)}
                      className="bg-[#e1e3e4] px-3 border border-[#d9dadb] rounded-r border-l-0 text-zinc-600 hover:bg-[#d9dadb] transition-colors"
                    >
                      <Search className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">
                    Número do Empenho
                  </label>
                  <input
                    type="text"
                    {...register("empenho")}
                    className="w-full p-2 border border-[#d9dadb] focus:border-[#1e293b] focus:outline-none rounded text-sm text-slate-800 transition-colors"
                  />\n{errors.empenho && <p className="text-red-500 text-xs mt-1">{errors.empenho.message as string}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">
                    Gestão U.E
                  </label>
                  <input
                    type="text"
                    {...register("gestao")}
                    className="w-full p-2 border border-[#d9dadb] focus:border-[#1e293b] focus:outline-none rounded text-sm text-slate-800 transition-colors"
                  />\n{errors.gestao && <p className="text-red-500 text-xs mt-1">{errors.gestao.message as string}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">
                    Unidade Orçamentária
                  </label>
                  <input
                    type="text"
                    {...register("unidade")}
                    className="w-full p-2 border border-[#d9dadb] focus:border-[#1e293b] focus:outline-none rounded text-sm text-slate-800 transition-colors"
                  />\n{errors.unidade && <p className="text-red-500 text-xs mt-1">{errors.unidade.message as string}</p>}
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-zinc-600 mb-1">
                      Elemento/Subelemento
                    </label>
                    <input
                      type="text"
                      value={neData.elementoSubelemento || ""}
                      onChange={(e) =>
                        setNeData({
                          ...neData,
                          elementoSubelemento: e.target.value,
                        })
                      }
                      className="w-full p-2 border border-[#d9dadb] focus:border-[#1e293b] focus:outline-none rounded text-sm text-slate-800 transition-colors"
                    />
                  </div>
                  <div className="w-16">
                    <label className="block text-xs font-semibold text-zinc-600 mb-1">
                      &nbsp;
                    </label>
                    <input
                      type="text"
                      {...register("sub")}
                      className="w-full p-2 border border-[#d9dadb] focus:border-[#1e293b] focus:outline-none rounded text-sm text-slate-800 text-center transition-colors"
                    />\n{errors.sub && <p className="text-red-500 text-xs mt-1">{errors.sub.message as string}</p>}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">
                    Data de Provisão Concedida
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      defaultValue="2024-05-10"
                      className="w-full p-2 border border-[#d9dadb] bg-[#fafafa] focus:outline-none focus:border-[#1e293b] rounded text-sm text-slate-800 [color-scheme:light]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">
                    Data de Emissão
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      {...register("dataEmissao")}
                      className="w-full p-2 border border-[#d9dadb] bg-[#fafafa] focus:outline-none focus:border-[#1e293b] rounded text-sm text-slate-800 [color-scheme:light]"
                    />\n{errors.dataEmissao && <p className="text-red-500 text-xs mt-1">{errors.dataEmissao.message as string}</p>}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">
                    Data de Pagamento
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      {...register("dataPagamentoNE")}
                      className="w-full p-2 border border-[#d9dadb] bg-[#fafafa] focus:outline-none focus:border-[#1e293b] rounded text-sm text-slate-800 [color-scheme:light]"
                    />\n{errors.dataPagamentoNE && <p className="text-red-500 text-xs mt-1">{errors.dataPagamentoNE.message as string}</p>}
                  </div>
                </div>
              </div>

              {/* Credor Card */}
              <div className="border border-[#e4e4e7] rounded-lg p-5 mb-8 bg-[#fdfdfd]">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-[#1e293b] flex items-center">
                    <span className="w-4 h-4 bg-[#e1e3e4] rounded-full flex items-center justify-center mr-2 text-[10px]">
                      🏢
                    </span>
                    Dados do Credor
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowCredorModal(true)}
                    className="text-xs font-semibold text-[#1e293b] flex items-center hover:underline"
                  >
                    Consultar Base <ExternalLink className="w-3 h-3 ml-1" />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                  <div className="md:col-span-1">
                    <label className="block text-[11px] text-zinc-500 font-semibold mb-0.5">
                      Nome do Credor
                    </label>
                    <input
                      type="text"
                      {...register("nomeCredor")}
                      className="w-full text-sm font-semibold text-slate-800 bg-transparent border-b border-transparent focus:border-slate-300 focus:outline-none transition-colors pb-0.5"
                      placeholder="Nome do credor..."
                    />\n{errors.nomeCredor && <p className="text-red-500 text-xs mt-1">{errors.nomeCredor.message as string}</p>}
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-500 font-semibold mb-0.5">
                      CPF/CNPJ
                    </label>
                    <div className="flex">
                      <input
                        type="text"
                        {...register("cpfCnpj")} onChange={(e) => { register("cpfCnpj").onChange(e); handleCpfCnpjChange(e.target.value); }}
                        className="w-full text-sm text-slate-800 bg-transparent border-b border-zinc-200 focus:border-slate-300 focus:outline-none transition-colors pb-0.5"
                        placeholder="00.000.000/0000-00"
                      />
                      {errors.cpfCnpj && <p className="text-red-500 text-xs mt-1">{errors.cpfCnpj.message as string}</p>}
                      <button
                        onClick={() => setShowNeModal(true)}
                        className="text-zinc-400 hover:text-slate-700 ml-1 pb-0.5 border-b border-zinc-200"
                      >
                        <Search className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-500 font-semibold mb-0.5">
                      RG/IE
                    </label>
                    <input
                      type="text"
                      {...register("rgIe")}
                      className="w-full text-sm text-slate-800 bg-transparent border-b border-transparent focus:border-slate-300 focus:outline-none transition-colors pb-0.5"
                      placeholder="RG ou IE"
                    />\n{errors.rgIe && <p className="text-red-500 text-xs mt-1">{errors.rgIe.message as string}</p>}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-500 font-semibold mb-0.5">
                    Endereço
                  </label>
                  <input
                    type="text"
                    {...register("endereco")}
                    className="w-full text-sm text-slate-800 bg-transparent border-b border-transparent focus:border-slate-300 focus:outline-none transition-colors pb-0.5"
                    placeholder="Endereço completo"
                  />\n{errors.endereco && <p className="text-red-500 text-xs mt-1">{errors.endereco.message as string}</p>}
                </div>
                {creditorDiagnose && (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-md text-xs font-semibold flex items-start gap-2">
                    <span className="text-sm mt-0.5">⚠️</span>
                    <div>{creditorDiagnose.message}</div>
                  </div>
                )}
              </div>

              {/* Values */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-[#f4f4f5] border border-[#e4e4e7] rounded p-4">
                  <p className="text-[11px] text-zinc-500 font-semibold mb-1">
                    Saldo Anterior
                  </p>
                  <p className="text-lg font-medium text-slate-800">
                    {formatCurrency(wSaldoAnterior || 0)}
                  </p>
                </div>
                <div className="bg-[#e3f2fd] border border-[#a7c8ff] rounded p-4">
                  <p className="text-[11px] text-[#003366] font-semibold mb-1">
                    Valor do Pagamento
                  </p>
                  <div className="flex items-center">
                    <span className="text-lg font-bold text-[#1e293b] mr-2">
                      R$
                    </span>
                    <input
                      type="number"
                      {...register("valorPagamento")}
                      className="bg-transparent text-lg font-bold text-[#1e293b] w-full focus:outline-none border-b border-transparent focus:border-[#1e293b]"
                    />\n{errors.valorPagamento && <p className="text-red-500 text-xs mt-1">{errors.valorPagamento.message as string}</p>}
                  </div>
                </div>
                <div className="bg-[#f4f4f5] border border-[#e4e4e7] rounded p-4">
                  <p className="text-[11px] text-zinc-500 font-semibold mb-1">
                    Saldo Atual
                  </p>
                  <p className="text-lg font-medium text-slate-800">
                    {formatCurrency(saldoAtual)}
                  </p>
                </div>
              </div>

              {/* Histórico e Especificação de Itens */}
              <div className="mb-8">
                <label className="block text-xs font-semibold text-zinc-600 mb-2">
                  Especificação ou Histórico
                </label>
                <textarea
                  rows={3}
                  className="w-full p-4 border border-[#d9dadb] focus:border-[#1e293b] outline-none bg-[#fafafa] rounded-t text-sm text-slate-800 leading-relaxed resize-none transition-colors border-b-0"
                  {...register("historico")}
                  placeholder="Digite a especificação ou histórico da ordem..."
                />\n{errors.historico && <p className="text-red-500 text-xs mt-1">{errors.historico.message as string}</p>}
                <div className="grid grid-cols-4 bg-[#fdfdfd] border border-[#d9dadb] border-b-0 p-4 gap-4">
                  <div>
                    <label className="block text-[11px] text-zinc-500 font-bold uppercase mb-1">
                      Unidade 1
                    </label>
                    <input
                      type="text"
                      {...register("itemUnidade")}
                      className="w-full p-2 border border-[#e4e4e7] rounded text-sm text-slate-800 focus:outline-none focus:border-[#1e293b]"
                      placeholder="Ex: UN"
                    />\n{errors.itemUnidade && <p className="text-red-500 text-xs mt-1">{errors.itemUnidade.message as string}</p>}
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-500 font-bold uppercase mb-1">
                      Quantidade 1
                    </label>
                    <input
                      type="number"
                      {...register("itemQuantidade")}
                      className="w-full p-2 border border-[#e4e4e7] rounded text-sm text-slate-800 focus:outline-none focus:border-[#1e293b]"
                      placeholder="Ex: 1"
                      min="0"
                      step="1"
                    />\n{errors.itemQuantidade && <p className="text-red-500 text-xs mt-1">{errors.itemQuantidade.message as string}</p>}
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-500 font-bold uppercase mb-1">
                      Unitário 1 (R$)
                    </label>
                    <input
                      type="text"
                      {...register("itemValorUnitario")}
                      className="w-full p-2 border border-[#e4e4e7] rounded text-sm text-slate-800 focus:outline-none focus:border-[#1e293b]"
                      placeholder="Ex: 1500,00"
                    />\n{errors.itemValorUnitario && <p className="text-red-500 text-xs mt-1">{errors.itemValorUnitario.message as string}</p>}
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-500 font-bold uppercase mb-1">
                      Subtotal 1 (R$)
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={formatCurrency(calculatedTotal1)
                        .replace("R$", "")
                        .trim()}
                      className="w-full p-2 border border-[#e4e4e7] bg-[#f4f4f5] rounded text-sm text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 bg-[#fafafa] border border-[#d9dadb] rounded-b p-4 gap-4">
                  <div>
                    <label className="block text-[11px] text-zinc-500 font-bold uppercase mb-1">
                      Unidade 2 (Opcional)
                    </label>
                    <input
                      type="text"
                      {...register("itemUnidade2")}
                      className="w-full p-2 border border-[#e4e4e7] rounded text-sm text-slate-800 focus:outline-none focus:border-[#1e293b]"
                      placeholder="Ex: Mês"
                    />\n{errors.itemUnidade2 && <p className="text-red-500 text-xs mt-1">{errors.itemUnidade2.message as string}</p>}
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-500 font-bold uppercase mb-1">
                      Quantidade 2
                    </label>
                    <input
                      type="number"
                      {...register("itemQuantidade2")}
                      className="w-full p-2 border border-[#e4e4e7] rounded text-sm text-slate-800 focus:outline-none focus:border-[#1e293b]"
                      placeholder="Ex: 1"
                      min="0"
                      step="1"
                    />\n{errors.itemQuantidade2 && <p className="text-red-500 text-xs mt-1">{errors.itemQuantidade2.message as string}</p>}
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-500 font-bold uppercase mb-1">
                      Unitário 2 (R$)
                    </label>
                    <input
                      type="text"
                      {...register("itemValorUnitario2")}
                      className="w-full p-2 border border-[#e4e4e7] rounded text-sm text-slate-800 focus:outline-none focus:border-[#1e293b]"
                      placeholder="Ex: 500,00"
                    />\n{errors.itemValorUnitario2 && <p className="text-red-500 text-xs mt-1">{errors.itemValorUnitario2.message as string}</p>}
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-500 font-bold uppercase mb-1">
                      Subtotal 2 (R$)
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={formatCurrency(calculatedTotal2)
                        .replace("R$", "")
                        .trim()}
                      className="w-full p-2 border border-[#e4e4e7] bg-[#f4f4f5] rounded text-sm text-slate-800"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-[#e4e4e7]">
                <div>
                  <label className="block text-xs font-bold text-[#1e293b] mb-2 uppercase">
                    Número do Cheque
                  </label>
                  <input
                    type="text"
                    value={descontos.numeroCheque}
                    onChange={(e) =>
                      setDescontos({
                        ...descontos,
                        numeroCheque: e.target.value,
                      })
                    }
                    placeholder="Ex: 123456"
                    className={`w-full p-3 border-2 rounded focus:outline-none text-sm text-slate-800 uppercase font-bold ${
                      isChequeDuplicate
                        ? "border-amber-500 bg-amber-50 focus:border-amber-600"
                        : "border-[#d9dadb] focus:border-[#1e293b]"
                    }`}
                  />
                  {isChequeDuplicate && (
                    <div className="mt-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded flex items-center gap-1.5 animate-pulse">
                      <span>
                        ⚠️ Atenção: Este número de cheque já foi de fato
                        registrado/utilizado anteriormente.
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-600 mb-2 uppercase">
                    Valor Base do Pagamento
                  </label>
                  <div className="w-full p-3 border-2 border-transparent bg-[#f4f4f5] rounded text-sm font-medium text-zinc-500">
                    {formatCurrency(wValorPagamento || 0)}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-[#1e293b] uppercase">
                    Discriminação de Descontos
                  </h3>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      {...register("autoCalculate")}
                      className="w-4 h-4 text-[#1e293b] rounded focus:ring-[#1e293b]"
                    />\n{errors.autoCalculate && <p className="text-red-500 text-xs mt-1">{errors.autoCalculate.message as string}</p>}
                    <span className="text-xs font-bold text-zinc-600">
                      Cálculo Automático de Alíquotas
                    </span>
                  </label>
                </div>
                <div className="bg-[#fdfdfd] border border-[#e4e4e7] rounded-lg p-5">
                  <div className="grid grid-cols-1 gap-3">
                    {/* 1. IRRF */}
                    <div className="flex items-center justify-between py-2 border-b border-[#f1f2f3]">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={appliedTaxes.irrf}
                          onChange={(e) =>
                            setAppliedTaxes({
                              ...appliedTaxes,
                              irrf: e.target.checked,
                            })
                          }
                          className="w-4 h-4 text-[#1e293b] rounded focus:ring-[#1e293b] cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <label className="text-sm font-medium text-slate-800">
                            Imposto de Renda (IRRF)
                          </label>
                          <span className="text-[10px] text-zinc-500">
                            Alíquota 1,5% (Retenção / Reforma Tributária)
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center w-48">
                        <span className="text-sm font-medium text-zinc-500 mr-2">
                          R$
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={descontos.irrf}
                          onChange={(e) => {
                            setAutoCalculate(false);
                            setDescontos({
                              ...descontos,
                              irrf: Number(e.target.value),
                            });
                          }}
                          className="w-full p-2 border border-[#d9dadb] rounded focus:outline-none focus:border-[#1e293b] text-sm text-right font-medium bg-white"
                        />
                      </div>
                    </div>

                    {/* 2. ISS */}
                    <div className="flex items-center justify-between py-2 border-b border-[#f1f2f3]">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={appliedTaxes.iss}
                          onChange={(e) =>
                            setAppliedTaxes({
                              ...appliedTaxes,
                              iss: e.target.checked,
                            })
                          }
                          className="w-4 h-4 text-[#1e293b] rounded focus:ring-[#1e293b] cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <label className="text-sm font-medium text-slate-800">
                            ISS (Imposto Sobre Serviços)
                          </label>
                          <span className="text-[10px] text-zinc-500">
                            Alíquota 5,0% (Atualizado por município)
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center w-48">
                        <span className="text-sm font-medium text-zinc-500 mr-2">
                          R$
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={descontos.iss}
                          onChange={(e) => {
                            setAutoCalculate(false);
                            setDescontos({
                              ...descontos,
                              iss: Number(e.target.value),
                            });
                          }}
                          className="w-full p-2 border border-[#d9dadb] rounded focus:outline-none focus:border-[#1e293b] text-sm text-right font-medium bg-white"
                        />
                      </div>
                    </div>

                    {/* 3. INSS */}
                    <div className="flex items-center justify-between py-2 border-b border-[#f1f2f3]">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={appliedTaxes.inss}
                          onChange={(e) =>
                            setAppliedTaxes({
                              ...appliedTaxes,
                              inss: e.target.checked,
                            })
                          }
                          className="w-4 h-4 text-[#1e293b] rounded focus:ring-[#1e293b] cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <label className="text-sm font-medium text-slate-800">
                            INSS (Contribuição Previdenciária)
                          </label>
                          <span className="text-[10px] text-zinc-500">
                            Alíquota 11,0% (Previdência Social)
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center w-48">
                        <span className="text-sm font-medium text-zinc-500 mr-2">
                          R$
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={descontos.inss}
                          onChange={(e) => {
                            setAutoCalculate(false);
                            setDescontos({
                              ...descontos,
                              inss: Number(e.target.value),
                            });
                          }}
                          className="w-full p-2 border border-[#d9dadb] rounded focus:outline-none focus:border-[#1e293b] text-sm text-right font-medium bg-white"
                        />
                      </div>
                    </div>

                    {/* 4. SEST / SENAT */}
                    <div className="flex items-center justify-between py-2 border-b border-[#f1f2f3]">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={appliedTaxes.sestSenat}
                          onChange={(e) =>
                            setAppliedTaxes({
                              ...appliedTaxes,
                              sestSenat: e.target.checked,
                            })
                          }
                          className="w-4 h-4 text-[#1e293b] rounded focus:ring-[#1e293b] cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <label className="text-sm font-medium text-slate-800">
                            SEST / SENAT
                          </label>
                          <span className="text-[10px] text-zinc-500">
                            Alíquota 2,5% (1,5% SEST + 1,0% SENAT - Opcional)
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center w-48">
                        <span className="text-sm font-medium text-zinc-500 mr-2">
                          R$
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={descontos.sestSenat}
                          onChange={(e) => {
                            setAutoCalculate(false);
                            setDescontos({
                              ...descontos,
                              sestSenat: Number(e.target.value),
                            });
                          }}
                          className="w-full p-2 border border-[#d9dadb] rounded focus:outline-none focus:border-[#1e293b] text-sm text-right font-medium bg-white"
                        />
                      </div>
                    </div>

                    {/* 5. PATRONAL (20%) */}
                    <div className="flex items-center justify-between py-2 border-b border-[#f1f2f3]">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={appliedTaxes.patronal}
                          onChange={(e) =>
                            setAppliedTaxes({
                              ...appliedTaxes,
                              patronal: e.target.checked,
                            })
                          }
                          className="w-4 h-4 text-[#1e293b] rounded focus:ring-[#1e293b] cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <label className="text-sm font-medium text-slate-800">
                            INSS Patronal (20%)
                          </label>
                          <span className="text-[10px] text-zinc-500">
                            Alíquota 20,0% do Valor Bruto (Opcional - Contribuição Patronal)
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center w-48">
                        <span className="text-sm font-medium text-zinc-500 mr-2">
                          R$
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={descontos.patronal}
                          onChange={(e) => {
                            setAutoCalculate(false);
                            setDescontos({
                              ...descontos,
                              patronal: Number(e.target.value),
                            });
                          }}
                          className="w-full p-2 border border-[#d9dadb] rounded focus:outline-none focus:border-[#1e293b] text-sm text-right font-medium bg-white"
                        />
                      </div>
                    </div>

                    {/* 6. OUTROS DESCONTOS / IBS-CBS */}
                    <div className="flex items-center justify-between py-2 border-b border-[#f1f2f3]">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={appliedTaxes.outrosDescontos}
                          onChange={(e) =>
                            setAppliedTaxes({
                              ...appliedTaxes,
                              outrosDescontos: e.target.checked,
                            })
                          }
                          className="w-4 h-4 text-[#1e293b] rounded focus:ring-[#1e293b] cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <label className="text-sm font-medium text-slate-800">
                            Outros Descontos / IBS-CBS
                          </label>
                          <span className="text-[10px] text-zinc-500">
                            Outras Retenções / Transição Tributária (Opcional)
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center w-48">
                        <span className="text-sm font-medium text-zinc-500 mr-2">
                          R$
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={descontos.outrosDescontos}
                          onChange={(e) => {
                            setAutoCalculate(false);
                            setDescontos({
                              ...descontos,
                              outrosDescontos: Number(e.target.value),
                            });
                          }}
                          className="w-full p-2 border border-[#d9dadb] rounded focus:outline-none focus:border-[#1e293b] text-sm text-right font-medium bg-white"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-3 mt-2 bg-[#f4f4f5] px-3 rounded">
                      <label className="text-sm font-bold text-[#1e293b]">
                        Total de Descontos
                      </label>
                      <span className="text-lg font-bold text-[#ea4335]">
                        {formatCurrency(totalDescontos)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#e3f2fd] border border-[#a7c8ff] rounded-lg p-6 mt-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#1e293b] uppercase">
                    Líquido da Ordem
                  </h2>
                  <p className="text-xs text-[#003366] mt-1">
                    Valor final a ser pago ao credor
                  </p>
                </div>
                <span className="text-3xl font-extrabold text-[#1e293b]">
                  {formatCurrency(liquidoOrdem)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCredorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <h2 className="text-lg font-bold text-slate-800">Consultar Credor</h2>
              <button onClick={() => setShowCredorModal(false)} className="text-zinc-500 hover:text-zinc-800 p-1">✕</button>
            </div>
            <div className="p-4 border-b border-zinc-200 bg-white sticky top-0">
              <div className="flex">
                <input
                  type="text"
                  placeholder="Pesquisar por Nome ou CPF/CNPJ..."
                  value={searchCredorQuery}
                  onChange={(e) => setSearchCredorQuery(e.target.value)}
                  className="w-full pl-4 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-l-md text-sm focus:outline-none focus:border-slate-400"
                />
                <button type="button" className="bg-[#e1e3e4] px-4 border border-[#d9dadb] border-l-0 rounded-r-md text-zinc-600 flex items-center justify-center">
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto space-y-3">
              {[...credoresDB, ...credores.map((c) => ({
                nome: c.nome, documento: c.cpfCnpj, rg: c.rg || 'ISENTO', end: c.endereco || 'Não informado'
              }))]
                .filter((c, idx, arr) => arr.findIndex((x) => x.documento === c.documento) === idx)
                .filter((c) =>
                  c.nome.toLowerCase().includes(searchCredorQuery.toLowerCase()) ||
                  c.documento.replace(/[^\d]/g, '').includes(searchCredorQuery.replace(/[^\d]/g, ''))
                )
                .map((c, i) => (
                  <div
                    key={i}
                    className="p-4 border border-zinc-200 hover:border-slate-400 rounded cursor-pointer transition-colors"
                    onClick={() => {
                      setNeData({ ...neData, nomeCredor: c.nome, cpfCnpj: c.documento, rgIe: c.rg, endereco: c.end });
                      setShowCredorModal(false);
                      toast.success(`Credor ${c.nome} selecionado.`);
                    }}
                  >
                    <p className="font-bold text-slate-800 text-sm">{c.nome}</p>
                    <p className="text-xs text-zinc-500 mt-1">CNPJ/CPF: {c.documento} • RG/IE: {c.rg}</p>
                    <p className="text-xs text-zinc-500">{c.end}</p>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}


      {showNeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <h2 className="text-lg font-bold text-slate-800">Consultar NE Cadastrada</h2>
              <button onClick={() => setShowNeModal(false)} className="text-zinc-500 hover:text-zinc-800 p-1">✕</button>
            </div>
            <div className="p-4 border-b border-zinc-100">
              <div className="flex">
                <input
                  type="text"
                  placeholder="Pesquisar por número da NE ou histórico..."
                  value={searchNeQuery}
                  onChange={(e) => setSearchNeQuery(e.target.value)}
                  className="w-full pl-4 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-l-md text-sm focus:outline-none focus:border-slate-400"
                />
                <button type="button" className="bg-[#e1e3e4] px-4 border border-[#d9dadb] border-l-0 rounded-r-md text-zinc-600 hover:bg-[#d9dadb] flex items-center justify-center">
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto space-y-3">
              {nesDB.length === 0 && (
                <p className="text-sm text-zinc-500 text-center py-4">Carregando NEs do banco...</p>
              )}
              {[...nesDB]
                .filter((ne: any, idx, arr) => arr.findIndex((x: any) => x.numero === ne.numero) === idx)
                .filter((ne: any) =>
                  ne.numero.toLowerCase().includes(searchNeQuery.toLowerCase()) ||
                  (ne.historico && ne.historico.toLowerCase().includes(searchNeQuery.toLowerCase()))
                )
                .map((ne: any, i: number) => (
                  <div
                    key={i}
                    className="p-4 border border-zinc-200 hover:border-slate-400 rounded cursor-pointer transition-colors flex justify-between items-center bg-white"
                    onClick={async () => {
                      setValue('numeroNe', ne.numero);
                      // Tentar carregar do banco primeiro
                      try {
                        const res = await fetch(`/api/notas-empenho?numero=${encodeURIComponent(ne.numero)}`);
                        const apiData = await res.json();
                        if (res.ok && apiData.ne) {
                          const n = apiData.ne;
                          const saldo = n.saldoDisponivel !== null && n.saldoDisponivel !== undefined ? Number(n.saldoDisponivel) : Number(n.valor);
                          const mapped = {
                            empenho: n.numero, gestao: n.gestao || '', unidade: n.unidadeOrcamentaria || '',
                            elementoSubelemento: n.elementoSubelemento || '', sub: '01',
                            nomeCredor: '', cpfCnpj: '', rgIe: '', endereco: '',
                            saldoAnterior: saldo || 0, valorEmpenho: Number(n.valor) || 0,
                            historico: n.historico || '', dataPagamento: n.dataPagamento || '',
                          };
                          setNeData(mapped); setValue('historico', mapped.historico);
                          setValue('itemQuantidade', '1'); setValue('itemValorUnitario', String(saldo));
                          setValue('itemQuantidade2', ''); setValue('itemValorUnitario2', ''); setValue('itemUnidade2', '');
                          setValue('valorPagamento', saldo); setValue('dataPagamentoNE', mapped.dataPagamento);
                          setValue('autoCalculate', true); setValue('numeroCheque', '');
                          toast.success(`NE ${ne.numero} carregada. Saldo disponível: R$ ${saldo}`);
                          setShowNeModal(false); return;
                        }
                      } catch {}
                      // Fallback mock
                      const mockNEDatabase: any = {};
                      const data = mockNEDatabase[ne.numero];
                      if (data) {
                        setNeData(data); setValue('historico', data.historico);
                        setValue('itemQuantidade', '1'); setValue('itemValorUnitario', data.valorEmpenho.toString());
                        setValue('itemQuantidade2', ''); setValue('itemValorUnitario2', ''); setValue('itemUnidade2', '');
                        setValue('valorPagamento', data.valorEmpenho); setValue('dataPagamentoNE', data.dataPagamento || '');
                        setValue('autoCalculate', true);
                        toast.success(`NE ${ne.numero} carregada.`);
                      }
                      setShowNeModal(false);
                    }}
                  >
                    <div>
                      <p className="font-bold text-slate-800 text-sm">NE: {ne.numero}</p>
                      <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{ne.historico}</p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-xs text-zinc-500">Valor</p>
                      <p className="text-sm font-bold text-slate-700">R$ {Number(ne.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {showOpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <h2 className="text-lg font-bold text-slate-800">Localizar Ordem de Pagamento</h2>
              <button onClick={() => setShowOpModal(false)} className="text-zinc-500 hover:text-zinc-800 p-1">✕</button>
            </div>
            <div className="p-4 border-b border-zinc-100">
              <div className="flex">
                <input
                  type="text"
                  placeholder="Pesquisar por NE, credor ou cheque..."
                  value={searchOpQuery}
                  onChange={(e) => setSearchOpQuery(e.target.value)}
                  className="w-full pl-4 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-l-md text-sm focus:outline-none focus:border-slate-400"
                />
                <button type="button" className="bg-[#e1e3e4] px-4 border border-[#d9dadb] border-l-0 rounded-r-md text-zinc-600 hover:bg-[#d9dadb] flex items-center justify-center">
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto space-y-3">
              {opsDB.length === 0 && (
                <p className="text-sm text-zinc-500 text-center py-4">Nenhuma ordem de pagamento salva ou carregando...</p>
              )}
              {opsDB
                .filter((op: any) =>
                  (op.numeroNe && op.numeroNe.toLowerCase().includes(searchOpQuery.toLowerCase())) ||
                  (op.credorNome && op.credorNome.toLowerCase().includes(searchOpQuery.toLowerCase())) ||
                  (op.numeroCheque && op.numeroCheque.toLowerCase().includes(searchOpQuery.toLowerCase()))
                )
                .map((op: any, i: number) => (
                  <div
                    key={i}
                    className="p-4 border border-zinc-200 hover:border-slate-400 rounded cursor-pointer transition-colors flex justify-between items-center bg-white"
                    onClick={() => {
                      setEditingOpId(op.id);
                      setValue('numeroNe', op.numeroNe);
                      setNeData({
                        empenho: op.numeroEmpenho || '',
                        gestao: op.gestao || '',
                        unidade: op.unidadeOrcamentaria || '',
                        elementoSubelemento: op.elementoSubelemento || '',
                        sub: op.sub || '01',
                        nomeCredor: op.credorNome || '',
                        cpfCnpj: op.credorCpfCnpj || '',
                        rgIe: op.credorRg || '',
                        endereco: op.credorEndereco || '',
                        saldoAnterior: op.saldoAnterior || 0,
                        valorEmpenho: op.valorEmpenho || 0
                      });
                      setValue('historico', op.historico || '');
                      setValue('itemQuantidade', op.itemQuantidade ? String(op.itemQuantidade) : '1');
                      setValue('itemValorUnitario', op.itemValorUnitario ? String(op.itemValorUnitario) : '0');
                      setValue('itemUnidade', op.itemUnidade || 'UN');
                      setValue('itemQuantidade2', op.itemQuantidade2 ? String(op.itemQuantidade2) : '');
                      setValue('itemValorUnitario2', op.itemValorUnitario2 ? String(op.itemValorUnitario2) : '');
                      setValue('itemUnidade2', op.itemUnidade2 || '');
                      setValue('valorPagamento', op.valorPagamento || 0);
                      setValue('dataPagamentoNE', op.dataPagamento || '');
                      setValue('numeroCheque', op.numeroCheque || '');
                      setValue('irrf', op.irrf || 0); setValue('iss', op.iss || 0); setValue('inss', op.inss || 0);
                      setValue('sestSenat', op.sestSenat || 0); setValue('patronal', op.patronal || 0); setValue('outrosDescontos', op.outrosDescontos || 0);
                      setValue('autoCalculate', false);
                      toast.success(`Ordem de Pagamento (NE ${op.numeroNe}) carregada para edição.`);
                      setShowOpModal(false);
                    }}
                  >
                    <div>
                      <p className="font-bold text-slate-800 text-sm">NE: {op.numeroNe} | Cheque: {op.numeroCheque}</p>
                      <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{op.credorNome}</p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-xs text-zinc-500">Valor</p>
                      <p className="text-sm font-bold text-indigo-600">R$ {Number(op.valorPagamento).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
        )}
      </div>
  );
}

export default function OrdemPagamento() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Carregando...</div>}>
      <OrdemPagamentoContent />
    </Suspense>
  );
}
