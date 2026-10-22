"use client";
import {
  Search,
  Printer as PrinterIcon,
  FileText,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { numeroPorExtenso } from "@/lib/utils";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { selecaoInicialDasOps } from "@/lib/selecao-ops-impressao";
import { formatarBRL, toCents } from "@/lib/money";
import { useDebouncedCallback } from "@/hooks/use-debounce";

import { EmpenhoVia } from "@/components/consulta-impressao/EmpenhoVia";
import { ReciboVia } from "@/components/consulta-impressao/ReciboVia";
import {
  LINHAS_DOCUMENTO_EM_BRANCO,
  datasDaVia,
  formatarValorOp,
  itensParaImpressao,
  linhasDescontoDaOp,
  notaDescontosDaOp,
} from "@/lib/impressao-op";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Valor do banco ("1234.50") como "1.234,50", sempre em centavos e com 2 casas. */
const brl = (v: unknown) => formatarBRL(toCents(v as any));

/**
 * Lê `?ne=` e, opcionalmente, `?ops=id1,id2` (link "Imprimir esta emissão" da
 * OP, T35-B/T36) e avisa a página uma vez. Isolado num <Suspense>:
 * useSearchParams não pode travar a página toda no prerender (Next 16).
 */
function LerNeDaUrl({ onNe }: { onNe: (numero: string, opsDaEmissao: string[]) => void }) {
  const searchParams = useSearchParams();
  const ne = searchParams.get("ne")?.trim() || "";
  const ops = searchParams.get("ops") || "";
  const jaLeu = useRef(false);
  useEffect(() => {
    if (!ne || jaLeu.current) return;
    jaLeu.current = true;
    onNe(ne, ops.split(",").map((id) => id.trim()).filter(Boolean));
  }, [ne, ops, onNe]);
  return null;
}


export default function ConsultaImpressao() {
  const [view, setView] = useState<"search" | "document">("search");
  const [documentType, setDocumentType] = useState<
    "frente" | "verso" | "ambos"
  >("ambos");
  const [isEditing, setIsEditing] = useState(false);
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
  // "carregando" só enquanto a consulta está em andamento: sem resultado, a
  // janela diz "Nenhuma NE encontrada" (antes ficava "Carregando..." para sempre).
  const [nesCarregando, setNesCarregando] = useState(false);
  const ultimaConsultaNes = useRef(0);

  // A API pesquisa só pelo número da NE. Só a resposta da última consulta vale.
  const fetchNesForModal = useCallback(async (busca = "") => {
    const consulta = ++ultimaConsultaNes.current;
    setNesCarregando(true);
    try {
      const url = busca ? `/api/notas-empenho?busca=${encodeURIComponent(busca)}` : '/api/notas-empenho';
      const d = await apiClient.get(url);
      if (consulta !== ultimaConsultaNes.current) return;
      setNesDB((d?.notas || []).map((n: any) => ({ numero: n.numero, valor: n.valor, historico: n.historico || '', status: n.status })));
    } catch {
      if (consulta === ultimaConsultaNes.current) setNesDB([]);
    } finally {
      if (consulta === ultimaConsultaNes.current) setNesCarregando(false);
    }
  }, []);
  const buscarNesAoDigitar = useDebouncedCallback((valor: string) => fetchNesForModal(valor), 300);

  const abrirConsultaNe = () => {
    setShowNeModal(true);
    setSearchNeQuery("");
    fetchNesForModal("");
  };

  /** Dados da NE para a via (Data de Provisão); sem a NE, o documento sai sem essa data. */
  const buscarNe = async (numero: string): Promise<any | null> => {
    try {
      const neData = await apiClient.get(`/api/notas-empenho?numero=${encodeURIComponent(numero)}`);
      return neData?.ne ?? null;
    } catch {
      return null;
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
    taxaBancaria: "0,00",
    taxaPix: "0,00",
    linhasDescontos: LINHAS_DOCUMENTO_EM_BRANCO,
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

  const [mounted, setMounted] = useState(false);
  const [documentList, setDocumentList] = useState<
    { frente: typeof frenteData; verso: typeof versoData }[]
  >([{ frente: frenteData, verso: versoData }]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Cada documento é uma OP (de um credor): editar mexe só no documento
  // editado, também no lote (antes o lote copiava o campo para todos e
  // numerava NE e cheque em sequência, herança do lote de parcelas).
  const handleFrenteChange = (index: number, field: string, value: any) => {
    setDocumentList((prev) =>
      prev.map((doc, i) => (i === index ? { ...doc, frente: { ...doc.frente, [field]: value } } : doc)),
    );
  };

  const handleVersoChange = (index: number, field: string, value: any) => {
    setDocumentList((prev) =>
      prev.map((doc, i) => (i === index ? { ...doc, verso: { ...doc.verso, [field]: value } } : doc)),
    );
  };

  // Consulta individual: OPs da NE, todas marcadas — ou só as da emissão, quando
  // aberta pelo "Imprimir esta emissão" (?ne=…&ops=…, T36).
  const buscarOpsDaNe = useCallback(async (numero: string, opsDaEmissao: string[] = []) => {
    if (!numero.trim()) { toast.error("Informe o número do Empenho."); return; }
    setIsBuscandoSingle(true);
    try {
      const formattedNe = numero.trim().toUpperCase();
      const data = await apiClient.get(`/api/ordens-pagamento?numeroNe=${encodeURIComponent(formattedNe)}`);
      if (data && data.ordens && data.ordens.length > 0) {
        setOpListSingle(data.ordens);
        const selecao = selecaoInicialDasOps(data.ordens, opsDaEmissao);
        setSelectedOpsSingle(selecao);
        const marcadas = Object.values(selecao).filter(Boolean).length;
        toast.success(
          marcadas < data.ordens.length
            ? `${data.ordens.length} OP(s) encontrada(s); ${marcadas} desta emissão já marcada(s). Clique em Gerar.`
            : `${data.ordens.length} OP(s) encontrada(s). Selecione e clique em Gerar.`
        );
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
  }, []);

  const abrirNeDaUrl = useCallback((numero: string, opsDaEmissao: string[]) => {
    setSearchMode("single");
    setBatchInput(numero.toUpperCase());
    buscarOpsDaNe(numero, opsDaEmissao);
  }, [buscarOpsDaNe]);

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

  /**
   * Um documento (frente + verso) por OP. As datas da via vêm da OP e da NE
   * (datasDaVia); OP sem cheque deixa o número em branco (antes saía um
   * número inventado, 040496 + posição); valores sempre em centavos.
   */
  const gerarDocFormatado = (op: any, formattedNe: string, ano: string, ne: any | null) => {
    const valorF = brl(op.valorPagamento ?? op.valorEmpenho);
    const liquido = op.valorLiquido ?? op.valorPagamento ?? 0;
    const itensFormatados = itensParaImpressao(op.itensJson);
    return {
      frente: {
        ...frenteData,
        ...datasDaVia(op, ne),
        numeroEmpenho: formattedNe,
        sub: op.sub || "",
        emissaoAno: ano,
        credorNome: op.credorNome || "",
        credorCpfCnpj: op.credorCpfCnpj || "",
        credorEndereco: op.credorEndereco || "",
        valorEmpenho: brl(op.valorEmpenho),
        saldoAnterior: brl(op.saldoAnterior),
        saldoAtual: formatarBRL(toCents(op.saldoAnterior) - toCents(op.valorPagamento)),
        gestaoUE: op.gestao || "",
        unidadeOrcamentaria: op.unidadeOrcamentaria || "",
        elementoSubelemento: [op.elemento, op.subelemento].filter(Boolean).join(' / '),
        especificacao: itensFormatados.especificacao || op.historico || "",
        chequeNo: op.numeroCheque || "",
        numeroCheque: op.numeroCheque || "",
        unidade: itensFormatados.unidade,
        quantidade: itensFormatados.quantidade,
        valorUnitario: itensFormatados.valorUnitario,
        valorTotal: itensFormatados.valorTotal || valorF,
        totalEspecificacao: valorF,
      },
      verso: {
        ...versoData,
        numeroCheque: op.numeroCheque || "",
        referenteA: op.historico || "",
        valorBase: valorF,
        cpfCnpj: op.credorCpfCnpj || "",
        endereco: op.credorEndereco || "",
        rg: op.credorRg || "",
        nomeRecebedor: op.credorNome || "",
        valorExtenso: numeroPorExtenso(toCents(liquido) / 100),
        descontosExtenso: numeroPorExtenso(toCents(op.totalDescontos) / 100),
        irrf: formatarValorOp(op.irrf),
        iss: formatarValorOp(op.iss),
        inss: formatarValorOp(op.inss),
        sestSenat: formatarValorOp(op.sestSenat),
        patronal: formatarValorOp(op.patronal),
        outrosDescontos: formatarValorOp(op.outrosDescontos),
        taxaBancaria: formatarValorOp(op.taxaBancaria),
        taxaPix: formatarValorOp(op.taxaPix),
        linhasDescontos: linhasDescontoDaOp(op),
        notaDescontos: notaDescontosDaOp(op),
        totalDescontos: brl(op.totalDescontos),
        valorRecibo: brl(liquido),
      }
    };
  };

  /** Ano da via: o do número da NE (2026NE…); senão o padrão do formulário. */
  const anoDaNe = (numeroNe: string) => /^(\d{4})NE/i.exec(numeroNe)?.[1] ?? frenteData.emissaoAno;

  // Renderização em lotes (chunks) para não travar a UI thread.
  const exibirDocumentos = async (allDocs: any[]) => {
    setDocumentList([]);
    await new Promise(resolve => setTimeout(resolve, 50));

    const CHUNK_SIZE = 10;
    for (let i = 0; i < allDocs.length; i += CHUNK_SIZE) {
      const chunk = allDocs.slice(i, i + CHUNK_SIZE);
      setDocumentList((prev) => [...prev, ...chunk]);
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    toast.success(allDocs.length > 1 ? `${allDocs.length} impressões prontas.` : "Documento pronto para impressão!");

    setTimeout(() => {
      setView("document");
      setIsEditing(true);
    }, 100);
  };

  /** Documentos das OPs marcadas (Consulta Individual ou Impressão em Lote). */
  const gerarLote = async () => {
    const formattedNe = batchInput.trim().toUpperCase();
    if (!formattedNe) { toast.error("Informe o número do Empenho."); return; }
    const marcadas = searchMode === "single"
      ? opListSingle.filter(op => selectedOpsSingle[op.id])
      : opList.filter(op => selectedOps[op.id]);
    if (marcadas.length === 0) {
      toast.error(searchMode === "single" ? "Marque ao menos uma OP, ou use \"Gerar Documento em Branco\"." : "Nenhuma parcela selecionada.");
      return;
    }

    toast.info("Processando impressões, por favor aguarde...");
    const ne = await buscarNe(formattedNe);
    const ano = anoDaNe(formattedNe);
    await exibirDocumentos(marcadas.map((op) => gerarDocFormatado(op, formattedNe, ano, ne)));
  };

  /**
   * Documento em branco da NE, para preencher à mão. Sempre em branco, mesmo
   * com OPs marcadas na lista (antes gerava as OPs marcadas).
   */
  const gerarEmBranco = async () => {
    const formattedNe = batchInput.trim().toUpperCase();
    if (!formattedNe) { toast.error("Informe o número do Empenho."); return; }

    const neDB = await buscarNe(formattedNe);
    const valorFormatado = neDB ? brl(neDB.valor) : frenteData.valorEmpenho;
    const valorReais = neDB ? toCents(neDB.valor) / 100 : 0;
    const finalHistorico = neDB ? neDB.historico || "" : frenteData.especificacao;
    // Só NEs antigas (antes da rodada 2) ainda têm credor; as novas saem sem.
    const finalNome = neDB?.credorNome || frenteData.credorNome;
    const finalCpf = neDB?.cpfCnpj || frenteData.credorCpfCnpj;

    await exibirDocumentos([{
      frente: {
        ...frenteData,
        ...datasDaVia({}, neDB),
        numeroEmpenho: formattedNe,
        emissaoAno: anoDaNe(formattedNe),
        credorNome: finalNome,
        credorCpfCnpj: finalCpf,
        valorEmpenho: valorFormatado,
        gestaoUE: neDB ? neDB.gestao || "" : frenteData.gestaoUE,
        unidadeOrcamentaria: neDB ? neDB.unidadeOrcamentaria || "" : frenteData.unidadeOrcamentaria,
        elementoSubelemento: neDB
          ? [neDB.elemento, neDB.subelemento].filter(Boolean).join(' / ')
          : frenteData.elementoSubelemento,
        saldoAnterior: valorFormatado,
        especificacao: finalHistorico,
      },
      verso: {
        ...versoData,
        numeroCheque: "",
        nomeRecebedor: finalNome,
        cpfCnpj: finalCpf,
        referenteA: finalHistorico,
        valorBase: valorFormatado,
        valorExtenso: numeroPorExtenso(valorReais),
        descontosExtenso: numeroPorExtenso(0),
      },
    }]);
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-full bg-slate-50/50 print:bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50 overflow-y-auto overflow-x-hidden min-h-screen relative">
      <Suspense fallback={null}>
        <LerNeDaUrl onNe={abrirNeDaUrl} />
      </Suspense>
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
                          onClick={abrirConsultaNe}
                          aria-label="Consultar NE cadastrada"
                          className="bg-gray-200 px-4 border border-slate-200/80 rounded-r-lg border-l-0 text-zinc-600 hover:bg-gray-300 transition-colors"
                        >
                          <Search className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => buscarOpsDaNe(batchInput)}
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

                  {/* Documento em branco: sempre em branco, mesmo com OPs marcadas */}
                  {batchInput.trim() && (
                    <button
                      onClick={gerarEmBranco}
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
                          onClick={abrirConsultaNe}
                          aria-label="Consultar NE cadastrada"
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
                          {Object.values(selectedOps).every(v => v) ? 'Desmarcar Todos' : 'Selecionar Todos'}
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
              {/* Um botão só: o PDF sai pela própria janela de impressão ("Salvar como PDF"). */}
              <button
                onClick={() => window.print()}
                title='Para salvar em PDF, escolha "Salvar como PDF" no destino da janela de impressão.'
                className="px-6 py-2.5 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white font-bold rounded-xl transition-all shadow-md flex items-center gap-2 text-sm ml-2"
              >
                <PrinterIcon className="w-4 h-4" />
                IMPRIMIR / SALVAR PDF
              </button>
            </div>
            <p className="print:hidden text-xs text-zinc-500 mb-3">
              Para salvar em PDF: clique em &quot;Imprimir / Salvar PDF&quot; e escolha &quot;Salvar como PDF&quot; no destino.
            </p>

            {isEditing && (
              <div className="w-full max-w-[210mm] text-center text-[#1e293b] font-bold uppercase tracking-widest text-sm bg-blue-50 py-3 rounded-t-lg border border-blue-200 print:hidden mb-4 shadow-sm relative overflow-hidden mx-auto">
                Editando{" "}
                {documentType === "frente"
                  ? "Frente (Empenho)"
                  : documentType === "verso"
                    ? "Verso (Recibo)"
                    : "Frente e Verso"}{" "}
                · cada documento separadamente
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
            <DialogDescription className="sr-only">
              Busque uma Nota de Empenho pelo número para carregar os dados na tela de impressão.
            </DialogDescription>
          </div>
          <div className="p-4 border-b border-zinc-100">
            <div className="flex">
              <input
                type="text"
                aria-label="Pesquisar pelo número da NE"
                placeholder="Pesquisar pelo número da NE..."
                value={searchNeQuery}
                onChange={(e) => {
                  setSearchNeQuery(e.target.value);
                  buscarNesAoDigitar(e.target.value);
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
            {nesCarregando && nesDB.length === 0 && (
              <p className="text-sm text-zinc-500 text-center py-4">Carregando NEs...</p>
            )}
            {!nesCarregando && nesDB.length === 0 && (
              <p role="status" className="text-sm text-zinc-500 text-center py-4">Nenhuma NE encontrada.</p>
            )}
            {[...nesDB]
              .filter((ne: any, idx, arr) => arr.findIndex((x: any) => x.numero === ne.numero) === idx)
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
                    <p className="font-bold text-slate-800 text-sm">NE: {ne.numero}</p>
                    {ne.historico && <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{ne.historico}</p>}
                  </div>
                  <div className="text-right flex flex-col justify-center shrink-0 ml-4">
                    <p className="text-xs text-zinc-500">Valor</p>
                    <p className="text-sm font-bold text-slate-700">R$ {brl(ne.valor)}</p>
                  </div>
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
