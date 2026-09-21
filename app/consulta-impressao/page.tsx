"use client";
import { ActionToolbar, ActionButton } from "@/components/action-toolbar";
import {
  Plus,
  Save,
  Search,
  Printer as PrinterIcon,
  FileText,
  Edit,
} from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { numeroPorExtenso, formatDateOnlyBR } from "@/lib/utils";
import { toast } from "sonner";
import jsPDF from "jspdf";
import * as htmlToImage from "html-to-image";
import { apiClient } from "@/lib/api-client";

// dados de exemplo removidos, agora carrega do banco mesmo

import { EmpenhoVia } from "@/components/consulta-impressao/EmpenhoVia";
import { ReciboVia } from "@/components/consulta-impressao/ReciboVia";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ConsultaImpressao() {
  const [view, setView] = useState<"search" | "document">("search");
  const [documentType, setDocumentType] = useState<
    "frente" | "verso" | "ambos"
  >("ambos");
  const [isEditing, setIsEditing] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [searchMode, setSearchMode] = useState<"single" | "batch">("single");

  const [batchInput, setBatchInput] = useState("");
  
  const [opList, setOpList] = useState<any[]>([]);
  const [selectedOps, setSelectedOps] = useState<Record<string, boolean>>({});

  // lista de OPs vinculadas para o modo de consulta individual
  const [opListSingle, setOpListSingle] = useState<any[]>([]);
  const [selectedOpsSingle, setSelectedOpsSingle] = useState<Record<string, boolean>>({});
  const [isBuscandoSingle, setIsBuscandoSingle] = useState(false);

  const [showNeModal, setShowNeModal] = useState(false);
  const [searchNeQuery, setSearchNeQuery] = useState("");
  const [nesDB, setNesDB] = useState<any[]>([]);

  const fetchNesForModal = async (busca = "") => {
    try {
      const url = busca ? `/api/notas-empenho?busca=${encodeURIComponent(busca)}` : '/api/notas-empenho';
      const r = await fetch(url);
      const d = await r.json();
      if (d.notas) {
        setNesDB(d.notas.map((n: any) => ({
          numero: n.numero, valor: n.valor, historico: n.historico || '', status: n.status,
          empenho: n.numero, gestao: n.gestao, unidade: n.unidadeOrcamentaria,
          elementoSubelemento: n.elementoSubelemento, nomeCredor: '', cpfCnpj: ''
        })));
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (showNeModal && nesDB.length === 0) {
      fetchNesForModal("");
    }
  }, [showNeModal]);

  const handleDownloadPDF = async () => {
    setIsGeneratingPdf(true);
    const wasEditing = isEditing;
    
    if (wasEditing) {
      setIsEditing(false);
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    try {
      toast.info("Preparando documento...");
      // pequeno delay pra garantir que os elementos renderizaram antes de imprimir
      await new Promise(resolve => setTimeout(resolve, 300));
      window.print();
    } catch (error) {
      console.error("Erro ao preparar documento:", error);
      toast.error("Erro ao preparar o documento.");
    } finally {
      if (wasEditing) {
        setIsEditing(true);
      }
      setIsGeneratingPdf(false);
    }
  };

  const [versoData, setVersoData] = useState({
    numeroCheque: "",
    valorBase: "0,00",
    irrf: "0,00",
    iss: "0,00",
    inss: "0,00",
    sestSenat: "0,00",
    patronal: "0,00",
    outrosDescontos: "0,00",
    totalDescontos: "0,00",
    descontosExtenso: "zero",
    valorRecibo: "0,00",
    valorExtenso: "zero",
    referenteA: "",
    localData: "",
    nomeRecebedor: "",
    cpfCnpj: "",
    rg: "",
    endereco: "",
  });

  const [frenteData, setFrenteData] = useState({
    unidadeOrcamentaria: "",
    atividadeProjeto: "",
    elementoSubelemento: "",
    numeroEmpenho: "",
    gestaoUE: "",
    codigoElemento: "",
    emissaoDia: "",
    emissaoMes: "",
    emissaoAno: new Date().getFullYear().toString(),
    pagamentoDia: "",
    pagamentoMes: "",
    pagamentoAno: "",
    pagamentoData: "",
    pessoaTipo: "FISICA",
    credorCpfCnpj: "",
    credorNome: "",
    credorEndereco: "",
    saldoAnterior: "0,00",
    valorEmpenho: "0,00",
    saldoAtual: "0,00",
    provisaoNo: "",
    provisaoData: "",
    processoLicitacaoNo: "0",
    processoLicitacaoData: "",
    licitacaoTipo: "",
    especificacao: "",
    unidade: "UN",
    quantidade: "1",
    valorUnitario: "0,00",
    valorTotal: "0,00",
    pedidoNo: "",
    processoNo: "",
    totalEspecificacao: "0,00",
    gerenciaEducacao: "GERÊNCIA REGIONAL DE EDUCAÇÃO DO AGRESTE MERIDIONAL",
    cnpjGerencia: "10.572.071/0002-01",
    autorizadoData: "",
    deduzidoData: "",
    recebimentoTipo: "SERVICO",
    recebimentoData: "",
    liquidadoData: "",
    pagueseData: "",
    pagoData: "",
    chequeNo: "",
    ordCredito: "",
    ordSaqueNo: "",
  });

  const viasList = [
    "VIA ÚNICA\nPRESTAÇÃO DE CONTAS / ARQUIVO",
  ];

  const [mounted, setMounted] = useState(false);
  const [documentList, setDocumentList] = useState<
    { frente: typeof frenteData; verso: typeof versoData }[]
  >([{ frente: frenteData, verso: versoData }]);

  useEffect(() => {
     
    setMounted(true);

    try {
      const orcJson = localStorage.getItem("ultimaOrdemImpressao");
      if (orcJson) {
        const orcData = JSON.parse(orcJson);
        setDocumentList((prev) => {
          const newList = [...prev];
          newList[0] = {
            ...newList[0],
            frente: {
              ...newList[0].frente,
              numeroEmpenho:
                orcData.numeroEmpenho || newList[0].frente.numeroEmpenho,
              gestaoUE: orcData.gestaoUE || newList[0].frente.gestaoUE,
              credorNome: orcData.credorNome || newList[0].frente.credorNome,
              credorCpfCnpj: orcData.cpfCnpj || newList[0].frente.credorCpfCnpj,
              credorEndereco:
                orcData.endereco || newList[0].frente.credorEndereco,
              especificacao:
                orcData.especificacao || newList[0].frente.especificacao,
              unidade: orcData.unidade2
                ? `${orcData.unidade}\n\n${orcData.unidade2}`
                : orcData.unidade || newList[0].frente.unidade,
              quantidade: orcData.quantidade2
                ? `${orcData.quantidade}\n\n${orcData.quantidade2}`
                : orcData.quantidade || newList[0].frente.quantidade,
              valorUnitario: orcData.valorUnitario2
                ? `${orcData.valorUnitario}\n\n${orcData.valorUnitario2}`
                : orcData.valorUnitario || newList[0].frente.valorUnitario,
              valorTotal:
                orcData.valorTotal2 && orcData.valorTotal2 !== "0,00"
                  ? `${orcData.valorTotal1}\n\n${orcData.valorTotal2}`
                  : orcData.valorTotal1 || newList[0].frente.valorTotal,
              totalEspecificacao:
                orcData.valorTotal || newList[0].frente.totalEspecificacao,
              saldoAnterior:
                orcData.saldoAnterior || newList[0].frente.saldoAnterior,
              valorEmpenho:
                orcData.valorEmpenho || newList[0].frente.valorEmpenho,
              saldoAtual: orcData.saldoAtual || newList[0].frente.saldoAtual,
              deduzidoData:
                orcData.deduzidoData || newList[0].frente.deduzidoData,
              chequeNo: orcData.chequeNo || newList[0].frente.chequeNo,
            },
            verso: {
              ...newList[0].verso,
              numeroCheque: orcData.chequeNo || newList[0].verso.numeroCheque,
              referenteA: orcData.especificacao || newList[0].verso.referenteA,
              valorBase: orcData.valorTotal || newList[0].verso.valorBase,
              irrf: orcData.irrf !== undefined ? String(orcData.irrf).replace('R$', '').trim() : newList[0].verso.irrf,
              iss: orcData.iss !== undefined ? String(orcData.iss).replace('R$', '').trim() : newList[0].verso.iss,
              inss: orcData.inss !== undefined ? String(orcData.inss).replace('R$', '').trim() : newList[0].verso.inss,
              sestSenat: orcData.sestSenat !== undefined ? String(orcData.sestSenat).replace('R$', '').trim() : newList[0].verso.sestSenat,
              patronal: orcData.patronal !== undefined ? String(orcData.patronal).replace('R$', '').trim() : newList[0].verso.patronal,
              outrosDescontos: orcData.outrosDescontos !== undefined ? String(orcData.outrosDescontos).replace('R$', '').trim() : newList[0].verso.outrosDescontos,
              totalDescontos: orcData.totalDescontos || newList[0].verso.totalDescontos,
              valorRecibo: orcData.valorLiquido || newList[0].verso.valorRecibo,
            },
          };
          return newList;
        });
      }
    } catch (e) {
      console.error("No base data on localstorage");
    }
  }, []);

  const handleAction = (action: string) => {
    if (action === "Salvar Documento") {
      setIsEditing(false);
      toast.success("Documentos salvos com sucesso!");
      return;
    }
    if (action === "Imprimir") {
      window.print();
      return;
    }
    toast.success(`Ação "${action}" realizada com sucesso!`);
  };

  const handleFrenteChange = (index: number, field: string, value: any) => {
    setDocumentList((prev) =>
      prev.map((doc, i) => {
        if (searchMode === "batch") {
          if (field === "numeroEmpenho") {
            const match = value.match(/^(.*?)(\d+)$/);
            let newNE = value;
            if (match) {
              const prefix = match[1];
              const initNum = parseInt(match[2], 10);
              const padding = match[2].length;
              const diff = i - index;
              newNE = `${prefix}${String(initNum + diff).padStart(padding, "0")}`;
            }
            return {
              ...doc,
              frente: { ...doc.frente, [field]: newNE },
            };
          } else {
            return {
              ...doc,
              frente: { ...doc.frente, [field]: value },
            };
          }
        } else {
          return i === index
            ? { ...doc, frente: { ...doc.frente, [field]: value } }
            : doc;
        }
      }),
    );
  };

  const handleVersoChange = (index: number, field: string, value: any) => {
    setDocumentList((prev) =>
      prev.map((doc, i) => {
        if (searchMode === "batch") {
          if (field === "numeroCheque") {
            const numVal = parseInt(value, 10);
            let newCheque = value;
            if (!isNaN(numVal)) {
              const diff = i - index;
              newCheque = String(numVal + diff).padStart(value.length, "0");
            }
            return {
              ...doc,
              verso: { ...doc.verso, [field]: newCheque },
            };
          } else {
            return {
              ...doc,
              verso: { ...doc.verso, [field]: value },
            };
          }
        } else {
          return i === index
            ? { ...doc, verso: { ...doc.verso, [field]: value } }
            : doc;
        }
      }),
    );
  };

  const buscarOrdensParaLote = async () => {
    if (!batchInput.trim()) {
      toast.error("Informe o número do Empenho base.");
      return;
    }
    toast.info("Buscando ordens vinculadas...");
    try {
      const formattedNe = batchInput.trim().toUpperCase();
      const data = await apiClient.get(`/api/ordens-pagamento?numeroNe=${encodeURIComponent(formattedNe)}`);
      
      if (data && data.ordens && data.ordens.length > 0) {
        setOpList(data.ordens);
        const newSelected: Record<string, boolean> = {};
        data.ordens.forEach((op: any) => newSelected[op.id] = true);
        setSelectedOps(newSelected);
        toast.success(`${data.ordens.length} ordem(ns) encontrada(s).`);
      } else {
        setOpList([]);
        toast.error("Nenhuma ordem encontrada para esta NE no banco de dados.");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao buscar parcelas.");
    }
  };

  const gerarDocFormatado = (op: any, formattedNe: string, ano: string, i: number) => {
    const valorF = Number(op.valorPagamento || op.valorEmpenho).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    const liquidoF = Number(op.valorLiquido || op.valorEmpenho).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    return {
      frente: {
        ...frenteData,
        numeroEmpenho: formattedNe,
        sub: op.sub || "",
        emissaoAno: ano,
        credorNome: op.credorNome || "",
        credorCpfCnpj: op.credorCpfCnpj || "",
        credorEndereco: op.credorEndereco || "",
        valorEmpenho: Number(op.valorEmpenho).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        saldoAnterior: Number(op.saldoAnterior).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        saldoAtual: Number((op.saldoAnterior || 0) - (op.valorPagamento || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        gestaoUE: op.gestao || "",
        unidadeOrcamentaria: op.unidadeOrcamentaria || "",
        elementoSubelemento: op.elementoSubelemento || "",
        especificacao: op.historico || "",
        chequeNo: op.numeroCheque || "",
        unidade: op.itemUnidade2 ? `${op.itemUnidade}\n\n${op.itemUnidade2}` : op.itemUnidade,
        quantidade: op.itemQuantidade2 ? `${op.itemQuantidade}\n\n${op.itemQuantidade2}` : op.itemQuantidade,
        valorUnitario: op.itemValorUnitario2 ? `${op.itemValorUnitario}\n\n${op.itemValorUnitario2}` : op.itemValorUnitario,
        valorTotal: op.itemValorUnitario2 && op.itemQuantidade2 ? `${Number(op.itemValorUnitario * op.itemQuantidade).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}\n\n${Number(op.itemValorUnitario2 * op.itemQuantidade2).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : valorF,
        totalEspecificacao: valorF,
        deduzidoData: formatDateOnlyBR(op.dataPagamento),
        provisaoData: formatDateOnlyBR(op.dataEmissao),
        pagamentoData: formatDateOnlyBR(op.dataPagamento),
      },
      verso: {
        ...versoData,
        numeroCheque: op.numeroCheque || String(40496 + i).padStart(6, "0"),
        referenteA: op.historico || "",
        valorBase: valorF,
        cpfCnpj: op.credorCpfCnpj || "",
        endereco: op.credorEndereco || "",
        rg: op.credorRg || "",
        nomeRecebedor: op.credorNome || "",
        valorExtenso: numeroPorExtenso(Number(op.valorLiquido || op.valorEmpenho)),
        descontosExtenso: numeroPorExtenso(Number(op.totalDescontos || 0)),
        irrf: op.irrf !== undefined ? String(op.irrf).replace('.', ',') : "0,00",
        iss: op.iss !== undefined ? String(op.iss).replace('.', ',') : "0,00",
        inss: op.inss !== undefined ? String(op.inss).replace('.', ',') : "0,00",
        sestSenat: op.sestSenat !== undefined ? String(op.sestSenat).replace('.', ',') : "0,00",
        patronal: op.patronal !== undefined ? String(op.patronal).replace('.', ',') : "0,00",
        outrosDescontos: op.outrosDescontos !== undefined ? String(op.outrosDescontos).replace('.', ',') : "0,00",
        totalDescontos: Number(op.totalDescontos || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
        valorRecibo: liquidoF,
      }
    };
  };

  const gerarLote = async () => {
    toast.info("Processando impressões, por favor aguarde...");
    let allDocs: any[] = [];
    
    if (searchMode === "single") {
      const formattedNe = (batchInput.trim() || "").toUpperCase();
      if (!formattedNe) { toast.error("Informe o número do Empenho."); return; }
      const match = formattedNe.match(/^(\d{4})NE/i);
      const ano = match ? match[1] : frenteData.emissaoAno;

      // modo individual: verifica se existem OPs vinculadas e usa as selecionadas
      const opsParaGerar = opListSingle.filter(op => selectedOpsSingle[op.id]);

      if (opsParaGerar.length > 0) {
        // tem OPs salvas selecionadas: gera documentos com os dados delas
        opsParaGerar.forEach((op, opIndex) => {
          allDocs.push(gerarDocFormatado(op, formattedNe, ano, opIndex));
        });
      } else {
        // nenhuma OP salva selecionada: gera documento em branco baseado na NE
        let neDB: any = null;
        try {
          const neData = await apiClient.get(`/api/notas-empenho?numero=${encodeURIComponent(formattedNe)}`);
          if (neData && neData.ne) neDB = neData.ne;
        } catch (e) {
          console.error("Erro na busca da NE", e);
        }

        const finalNome = frenteData.credorNome;
        const finalCpf = frenteData.credorCpfCnpj;
        const finalEndereco = frenteData.credorEndereco;
        const finalValor = neDB ? neDB.valor : parseFloat(frenteData.valorEmpenho.replace(',','.'));
        const finalGestao = neDB ? neDB.gestao : frenteData.gestaoUE;
        const finalUnidade = neDB ? neDB.unidadeOrcamentaria : frenteData.unidadeOrcamentaria;
        const finalElemento = neDB ? neDB.elementoSubelemento : frenteData.elementoSubelemento;
        const finalHistorico = neDB ? neDB.historico : frenteData.especificacao;

        const valorFormatado = Number(finalValor).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
        const vExtenso = numeroPorExtenso(Number(finalValor));
        const dExtenso = numeroPorExtenso(0);

        allDocs.push({
          frente: {
            ...frenteData,
            numeroEmpenho: formattedNe,
            emissaoAno: ano,
            credorNome: finalNome,
            credorCpfCnpj: finalCpf,
            credorEndereco: finalEndereco,
            valorEmpenho: valorFormatado,
            gestaoUE: finalGestao,
            unidadeOrcamentaria: finalUnidade,
            elementoSubelemento: finalElemento,
            saldoAnterior: valorFormatado,
            especificacao: finalHistorico,
          },
          verso: {
            ...versoData,
            numeroCheque: String(40496).padStart(6, "0"),
            referenteA: finalHistorico || "",
            valorBase: valorFormatado,
            cpfCnpj: finalCpf,
            endereco: finalEndereco,
            rg: versoData.rg,
            nomeRecebedor: finalNome,
            valorExtenso: vExtenso,
            descontosExtenso: dExtenso,
          },
        });
      }
    } else {
      // modo lote: pega apenas as ops selecionadas na lista
      const selectedOpData = opList.filter(op => selectedOps[op.id]);
      if (selectedOpData.length === 0) {
        toast.error("Nenhuma parcela selecionada.");
        return;
      }
      
      const formattedNe = batchInput.trim().toUpperCase();
      const match = formattedNe.match(/^(\d{4})NE/i);
      const ano = match ? match[1] : frenteData.emissaoAno;

      selectedOpData.forEach((op, opIndex) => {
        allDocs.push(gerarDocFormatado(op, formattedNe, ano, opIndex));
      });
    }

    // Renderização em lotes (chunks) para não travar a UI thread
    setDocumentList([]);
    await new Promise(resolve => setTimeout(resolve, 50));

    const CHUNK_SIZE = 10;
    for (let i = 0; i < allDocs.length; i += CHUNK_SIZE) {
      const chunk = allDocs.slice(i, i + CHUNK_SIZE);
      setDocumentList((prev) => [...prev, ...chunk]);
      // Yield main thread
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    if (allDocs.length > 1) {
      toast.success(`${allDocs.length} impressões prontas.`);
    } else {
      toast.success("Documento pronto para impressão!");
    }

    setTimeout(() => {
      setView("document");
      setIsEditing(true);
    }, 100);
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-full bg-slate-50/50 print:bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50 overflow-y-auto overflow-x-hidden min-h-screen relative">
      <div className="print:hidden sticky top-0 z-50 w-full shadow-sm bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50 border-b border-gray-200">
        
      </div>

      <div className="p-4 sm:p-8 max-w-[1280px] mx-auto w-full flex-1 print:p-0 print:m-0 flex flex-col items-center">
        {view === "search" ? (
          <div className="w-full">
            <div className="mb-8">
              <p className="text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-widest pl-1">
                Documentos Fiscais / Padrão Oficial A4
              </p>
              <h1 className="text-4xl font-extrabold text-[#1e293b] mb-3 tracking-tight">
                Imprimir Notas de Empenho e Recibos
              </h1>
              <p className="text-base text-zinc-600 max-w-2xl leading-relaxed">
                Emita o documento contendo os exatos moldes visuais oficiais do
                Estado de Pernambuco.
              </p>
            </div>

            <div className="bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50 rounded-xl border border-slate-200/80 shadow-sm p-8 w-full max-w-4xl hover:shadow-md transition-shadow">
              <Tabs value={searchMode} onValueChange={(v) => setSearchMode(v as "single" | "batch")}>
                <TabsList className="flex gap-4 mb-6 border-b border-gray-200 pb-2">
                  <TabsTrigger
                    value="single"
                    className={`text-sm font-bold pb-2 border-b-2 uppercase tracking-wide transition-colors ${searchMode === "single" ? "border-[#1e293b] text-[#1e293b]" : "border-transparent text-gray-400 hover:text-gray-600"}`}
                  >
                    Consulta Individual
                  </TabsTrigger>
                  <TabsTrigger
                    value="batch"
                    className={`text-sm font-bold pb-2 border-b-2 uppercase tracking-wide transition-colors ${searchMode === "batch" ? "border-[#1e293b] text-[#1e293b]" : "border-transparent text-gray-400 hover:text-gray-600"}`}
                  >
                    Impressão em Lote
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {searchMode === "single" ? (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1">
                      <label className="block text-[11px] font-bold text-zinc-600 mb-2 uppercase tracking-wider">
                        Nº do Empenho
                      </label>
                      <div className="flex">
                        <input
                          type="text"
                          value={batchInput}
                          onChange={(e) => setBatchInput(e.target.value)}
                          placeholder="Ex: 2026NE000123"
                          className="w-full p-4 rounded-l-lg border border-r-0 border-slate-200/80 bg-gray-50 text-sm focus:bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50 focus:outline-none focus:border-[#1e293b] focus:ring-2 focus:ring-[#1e293b]/20 font-bold tracking-wide transition-all"
                        />
                        <button
                          onClick={() => setShowNeModal(true)}
                          className="bg-gray-200 px-4 border border-slate-200/80 rounded-r-lg border-l-0 text-zinc-600 hover:bg-gray-300 transition-colors"
                        >
                          <Search className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!batchInput.trim()) { toast.error("Informe o número do Empenho."); return; }
                        setIsBuscandoSingle(true);
                        try {
                          const formattedNe = batchInput.trim().toUpperCase();
                          const data = await apiClient.get(`/api/ordens-pagamento?numeroNe=${encodeURIComponent(formattedNe)}`);
                          if (data && data.ordens && data.ordens.length > 0) {
                            setOpListSingle(data.ordens);
                            const newSel: Record<string, boolean> = {};
                            data.ordens.forEach((op: any) => newSel[op.id] = true);
                            setSelectedOpsSingle(newSel);
                            toast.success(`${data.ordens.length} OP(s) encontrada(s). Selecione e clique em Gerar.`);
                          } else {
                            setOpListSingle([]);
                            setSelectedOpsSingle({});
                            toast.info("Nenhuma OP encontrada para esta NE. Você pode gerar um documento em branco.");
                          }
                        } catch (e: any) {
                          toast.error(e.message || "Erro ao buscar OPs.");
                        } finally {
                          setIsBuscandoSingle(false);
                        }
                      }}
                      className="bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-md shadow-slate-900/20 ring-1 ring-white/10 text-white font-bold py-4 px-8 rounded-lg text-sm hover:opacity-90 transition-all flex justify-center items-center h-[54px] shadow-sm hover:shadow-md active:scale-[0.98]"
                    >
                      {isBuscandoSingle ? <span className="animate-pulse">Buscando...</span> : <><Search className="w-4 h-4 mr-2" /> CONSULTAR</>}
                    </button>
                  </div>

                  {/* Lista de OPs encontradas no modo individual */}
                  {opListSingle.length > 0 && (
                    <div className="mt-2 p-4 border border-emerald-200 rounded-lg bg-emerald-50">
                      <div className="flex justify-between items-center mb-3 pb-2 border-b border-emerald-200">
                        <span className="text-sm font-bold text-emerald-800">OPs encontradas para esta NE ({opListSingle.length})</span>
                        <button
                          className="text-xs text-blue-600 hover:underline font-semibold"
                          onClick={() => {
                            const allSel = Object.values(selectedOpsSingle).every(v => v);
                            const newSel: Record<string, boolean> = {};
                            opListSingle.forEach(op => newSel[op.id] = !allSel);
                            setSelectedOpsSingle(newSel);
                          }}
                        >
                          {Object.values(selectedOpsSingle).every(v => v) ? 'Desmarcar Todos' : 'Selecionar Todos'}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                        {opListSingle.map((op: any) => (
                          <label key={op.id} className="flex items-center gap-3 p-3 bg-white border border-emerald-200 rounded-lg cursor-pointer hover:border-emerald-400 transition-colors">
                            <input
                              type="checkbox"
                              checked={!!selectedOpsSingle[op.id]}
                              onChange={(e) => setSelectedOpsSingle({ ...selectedOpsSingle, [op.id]: e.target.checked })}
                              className="w-4 h-4 text-emerald-600 rounded"
                            />
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-800">
                                {op.sub ? `Parcela /${op.sub}` : 'Principal'} — R$ {Number(op.valorPagamento).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                              <span className="text-[10px] text-zinc-500 truncate max-w-[200px]">{op.credorNome}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                      <button
                        onClick={gerarLote}
                        className="w-full bg-gradient-to-r from-emerald-700 to-emerald-800 text-white font-bold py-3 px-8 rounded-lg text-sm hover:opacity-90 transition-all flex justify-center items-center gap-2"
                      >
                        <FileText className="w-4 h-4" /> GERAR DOCUMENTO(S) SELECIONADO(S)
                      </button>
                    </div>
                  )}

                  {/* Botão para gerar documento em branco (mesmo sem OPs) */}
                  {batchInput.trim() && (
                    <button
                      onClick={gerarLote}
                      className="w-full bg-gradient-to-r from-slate-600 to-slate-700 text-white font-bold py-3 px-8 rounded-lg text-sm hover:opacity-90 transition-all flex justify-center items-center gap-2 mt-1"
                    >
                      <FileText className="w-4 h-4" /> Gerar Documento em Branco
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1">
                      <label className="block text-[11px] font-bold text-zinc-600 mb-2 uppercase tracking-wider">
                        Nº da NE Base
                      </label>
                      <div className="flex">
                        <input
                          type="text"
                          value={batchInput}
                          onChange={(e) => setBatchInput(e.target.value)}
                          placeholder="Ex: 2026NE000123"
                          className="w-full p-4 rounded-l-lg border border-r-0 border-slate-200/80 bg-gray-50 text-sm focus:bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50 focus:outline-none focus:border-[#1e293b] focus:ring-2 focus:ring-[#1e293b]/20 font-bold tracking-wide transition-all"
                        />
                        <button
                          onClick={() => setShowNeModal(true)}
                          className="bg-gray-200 px-4 border border-slate-200/80 rounded-r-lg border-l-0 text-zinc-600 hover:bg-gray-300 transition-colors"
                        >
                          <Search className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={buscarOrdensParaLote}
                      className="bg-zinc-800 text-white font-bold py-4 px-8 rounded-lg text-sm hover:bg-zinc-700 transition-all flex justify-center items-center h-[54px] shadow-sm"
                    >
                      BUSCAR PARCELAS
                    </button>
                  </div>

                  {opList.length > 0 && (
                    <div className="mt-4 p-4 border border-zinc-200 rounded-lg bg-zinc-50 max-h-60 overflow-y-auto">
                      <div className="flex justify-between items-center mb-3 pb-2 border-b border-zinc-200">
                        <span className="text-sm font-bold text-zinc-700">Selecione as Parcelas ({opList.length})</span>
                        <button 
                          className="text-xs text-blue-600 hover:underline font-semibold"
                          onClick={() => {
                            const allSelected = Object.values(selectedOps).every(v => v);
                            const newSelected: Record<string, boolean> = {};
                            opList.forEach(op => newSelected[op.id] = !allSelected);
                            setSelectedOps(newSelected);
                          }}
                        >
                          Selecionar Todos
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {opList.map(op => (
                          <label key={op.id} className="flex items-center gap-3 p-2 bg-white border border-zinc-200 rounded cursor-pointer hover:border-zinc-400">
                            <input 
                              type="checkbox" 
                              checked={!!selectedOps[op.id]}
                              onChange={(e) => setSelectedOps({ ...selectedOps, [op.id]: e.target.checked })}
                              className="w-4 h-4 text-slate-800 rounded border-gray-300 focus:ring-slate-800"
                            />
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-800">
                                {op.sub ? `Parcela /${op.sub}` : 'Principal'} - R$ {Number(op.valorPagamento || op.valorEmpenho).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                              <span className="text-[10px] text-zinc-500 truncate max-w-[200px]" title={op.credorNome}>{op.credorNome}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                      <div className="flex justify-end mt-4">
                        <button
                          onClick={gerarLote}
                          className="bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-md shadow-slate-900/20 ring-1 ring-white/10 text-white font-bold py-3 px-8 rounded-lg text-sm hover:bg-gradient-to-r from-blue-800 to-blue-900 text-white shadow-lg shadow-blue-900/30 ring-1 ring-white/20 transition-all flex justify-center items-center shadow-sm hover:shadow-md active:scale-[0.98]"
                        >
                          <FileText className="w-4 h-4 mr-2" /> GERAR LOTE SELECIONADO
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* OPÇÕES DE SELEÇÃO DE PÁGINA PARA IMPRESSÃO E DIGITALIZAÇÃO */}
              <div className="mt-6 pt-5 border-t border-gray-200">
                <label className="block text-[11px] font-bold text-zinc-600 mb-2 uppercase tracking-wider">
                  Opções de Impressão e Páginas (Digitalização / Lote)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDocumentType("frente")}
                    className={`p-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      documentType === "frente"
                        ? "bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-md shadow-slate-900/20 ring-1 ring-white/10 text-white border-[#1e293b] shadow-sm"
                        : "bg-gray-50 text-zinc-700 border-slate-200/80 hover:bg-gray-100"
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    Apenas Frente (Empenho)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocumentType("ambos")}
                    className={`p-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      documentType === "ambos"
                        ? "bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-md shadow-slate-900/20 ring-1 ring-white/10 text-white border-[#1e293b] shadow-sm"
                        : "bg-gray-50 text-zinc-700 border-slate-200/80 hover:bg-gray-100"
                    }`}
                  >
                    <PrinterIcon className="w-4 h-4" />
                    Frente e Verso (Empenho + Recibo)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDocumentType("verso")}
                    className={`p-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      documentType === "verso"
                        ? "bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-md shadow-slate-900/20 ring-1 ring-white/10 text-white border-[#1e293b] shadow-sm"
                        : "bg-gray-50 text-zinc-700 border-slate-200/80 hover:bg-gray-100"
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    Apenas Verso (Recibo)
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
                  💡 <span className="font-semibold text-zinc-700">Dica para escaneamento:</span> Selecione <span className="font-bold text-[#1e293b]">&quot;Apenas Frente&quot;</span> para gerar e imprimir o lote sem verso, ideal para rápida digitalização posterior.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col w-full items-center text-slate-800 pb-32 print:pb-0 mt-[20px] print:mt-0 print:block relative">
            
            {/* Toolbar fixa para impressão e edição */}
            <div className="print:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex gap-4 bg-white/95 backdrop-blur-md px-6 py-4 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-200/80 items-center">
              <button
                onClick={() => setView("search")}
                className="px-5 py-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded-xl transition-all shadow-sm text-sm"
              >
                Voltar
              </button>
              <div className="w-[1px] h-8 bg-zinc-200 mx-1"></div>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`px-5 py-2.5 font-bold rounded-xl transition-all shadow-sm text-sm ${isEditing ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 ring-1 ring-blue-500/20' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'}`}
              >
                {isEditing ? 'Modo Leitura' : 'Editar Valores'}
              </button>
              <button
                onClick={() => window.print()}
                className="px-6 py-2.5 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white font-bold rounded-xl transition-all shadow-md flex items-center gap-2 text-sm ml-2"
              >
                <PrinterIcon className="w-4 h-4" />
                IMPRIMIR
              </button>
              <button
                onClick={handleDownloadPDF}
                disabled={isGeneratingPdf}
                className={`px-6 py-2.5 font-bold rounded-xl transition-all shadow-md flex items-center gap-2 text-sm ml-2 ${isGeneratingPdf ? 'bg-blue-300 text-white cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white'}`}
              >
                <FileText className="w-4 h-4" />
                {isGeneratingPdf ? 'GERANDO...' : 'BAIXAR PDF'}
              </button>
            </div>

            {isEditing && (
              <div className="w-full max-w-[210mm] text-center text-[#1e293b] font-bold uppercase tracking-widest text-sm bg-blue-50 py-3 rounded-t-lg border border-blue-200 print:hidden mb-4 shadow-sm relative overflow-hidden mx-auto">
                Editando{" "}
                {documentType === "frente"
                  ? "Frente (Empenho)"
                  : documentType === "verso"
                    ? "Verso (Recibo)"
                    : "Ambos"}{" "}
                Sincronizadamente
              </div>
            )}

            {documentList.map((doc, index) => (
              <div
                key={index}
                className="w-full max-w-[210mm] flex flex-col items-center print:block print:max-w-none print:m-0 mx-auto"
              >
                <div
                  id={`doc-${index}-frente`}
                  className={`relative w-full isolate ${
                    documentType === "frente" || documentType === "ambos"
                      ? "block print:block"
                      : "hidden print:hidden"
                  } ${documentType === "ambos" ? "print:break-after-page" : ""}`}
                >
                  <div className="print:hidden absolute -left-[54px] -right-[54px] -top-[40px] -bottom-[40px] bg-slate-100 z-[-1] rounded-lg opacity-20 transition-opacity"></div>
                  <EmpenhoVia
                    data={doc.frente}
                    isEditing={
                      isEditing &&
                      (documentType === "frente" || documentType === "ambos")
                    }
                    onChange={(field: string, value: string) =>
                      handleFrenteChange(index, field, value)
                    }
                    isLast={documentType === "frente"}
                    empenhoIndex={index}
                  />
                </div>

                <div
                  id={`doc-${index}-verso`}
                  className={`relative w-full isolate ${
                    documentType === "verso" || documentType === "ambos"
                      ? "block print:block"
                      : "hidden print:hidden"
                  } ${index !== documentList.length - 1 ? "print:break-after-page" : ""}`}
                >
                  <div className="print:hidden absolute -left-[54px] -right-[54px] -top-[40px] -bottom-[40px] bg-slate-100 z-[-1] rounded-lg opacity-20 transition-opacity"></div>
                  <ReciboVia
                    data={doc.verso}
                    frente={doc.frente}
                    isEditing={
                      isEditing &&
                      (documentType === "verso" || documentType === "ambos")
                    }
                    onChange={(field: string, value: string) =>
                      handleVersoChange(index, field, value)
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showNeModal} onOpenChange={setShowNeModal}>
        <DialogContent className="max-w-2xl p-0 flex flex-col max-h-[80vh]">
          <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
            <DialogTitle className="text-lg font-bold text-slate-800">
              Consultar NE Cadastrada
            </DialogTitle>
          </div>
          <div className="p-4 border-b border-zinc-100">
            <div className="flex">
              <input
                type="text"
                placeholder="Pesquisar por NE, CPF/CNPJ ou Credor..."
                value={searchNeQuery}
                onChange={(e) => {
                  setSearchNeQuery(e.target.value);
                  fetchNesForModal(e.target.value);
                }}
                className="w-full pl-4 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-l-md text-sm focus:outline-none focus:border-slate-400 transition-shadow"
              />
              <button
                type="button"
                className="bg-slate-100 px-4 border border-slate-200/80 border-l-0 rounded-r-md text-zinc-600 hover:bg-slate-200 transition-colors flex items-center justify-center"
              >
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
                (ne.historico && ne.historico.toLowerCase().includes(searchNeQuery.toLowerCase())) ||
                (ne.nomeCredor && ne.nomeCredor.toLowerCase().includes(searchNeQuery.toLowerCase()))
              )
              .map((ne: any, i: number) => (
                <div
                  key={i}
                  className="p-4 border border-zinc-200 hover:border-slate-400 rounded cursor-pointer transition-colors flex justify-between items-center bg-white"
                  onClick={() => {
                    setBatchInput(ne.numero);
                    setShowNeModal(false);
                    toast.success(`NE ${ne.numero} selecionada.`);
                  }}
                >
                  <div>
                    <p className="font-bold text-slate-800 text-sm">
                      NE: {ne.numero}{" "}
                      <span className="font-normal text-zinc-500 ml-2">
                        Empenho: {ne.empenho || '-'}
                      </span>
                    </p>
                    <p className="text-xs font-semibold text-zinc-600 mt-1">
                      Credor: {ne.nomeCredor || '-'}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1 line-clamp-1">
                      {ne.historico}
                    </p>
                  </div>
                  <div className="text-right flex flex-col justify-center shrink-0 ml-4">
                    <p className="text-xs text-zinc-500">Valor</p>
                    <p className="text-sm font-bold text-slate-700">
                      R$ {Number(ne.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
