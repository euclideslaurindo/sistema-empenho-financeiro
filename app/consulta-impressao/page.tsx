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
import { numeroPorExtenso } from "@/lib/utils";
import { toast } from "sonner";

// Mock DB for NEs
const mockNEDatabase: Record<string, any> = {
  "2024NE00142": {
    empenho: "8421/2024",
    gestao: "140101",
    unidade: "Secretaria de Educação",
    elementoSubelemento: "3.3.90.30",
    sub: "01",
    nomeCredor: "Papelaria e Distribuidora Nordeste LTDA",
    cpfCnpj: "12.345.678/0001-90",
    rgIe: "987.654.321",
    endereco: "Av. Agamenon Magalhães, 1200 - Santo Amaro, Recife - PE",
    saldoAnterior: 45000.0,
    valorEmpenho: 12450.0,
    historico:
      "Referente à aquisição de materiais de escritório para suprimento das Unidades Escolares da Rede Estadual, conforme Processo Licitatório nº 042/2024 e Ata de Registro de Preços vigente.",
    dataPagamento: "2024-03-10",
  },
  "2024NE00143": {
    empenho: "8422/2024",
    gestao: "140102",
    unidade: "Secretaria de Saúde",
    elementoSubelemento: "3.3.90.32",
    sub: "02",
    nomeCredor: "Farma Vida Distribuidora S/A",
    cpfCnpj: "99.888.777/0002-11",
    rgIe: "123.456.789",
    endereco: "Rua do Sol, 500 - Centro, Recife - PE",
    saldoAnterior: 150000.0,
    valorEmpenho: 25000.0,
    historico: "Aquisição de medicamentos para a rede hospitalar estadual.",
    dataPagamento: "2024-05-20",
  },
  "2024NE000982": {
    empenho: "9500/2024",
    gestao: "140101",
    unidade: "Secretaria de Educação",
    elementoSubelemento: "3.3.90.36",
    sub: "01",
    nomeCredor: "João da Silva ME",
    cpfCnpj: "11.222.333/0001-44",
    rgIe: "123.456.789",
    endereco: "Av. Boa Viagem, 10 - Recife - PE",
    saldoAnterior: 30000.0,
    valorEmpenho: 15420.0,
    historico: "Pagamento de RPA",
    dataPagamento: "2024-05-22",
  },
  "2024NE000981": {
    empenho: "9499/2024",
    gestao: "140102",
    unidade: "Secretaria de Saúde",
    elementoSubelemento: "3.3.90.30",
    sub: "01",
    nomeCredor: "Distribuidora Saúde e Cia",
    cpfCnpj: "55.666.777/0001-88",
    rgIe: "ISENTO",
    endereco: "Rua da Aurora, 150 - Recife - PE",
    saldoAnterior: 2850.5,
    valorEmpenho: 2850.5,
    historico: "Pagamento ref aquisição de insumos",
    dataPagamento: "2024-05-21",
  },
  "2024NE000979": {
    empenho: "9498/2024",
    gestao: "140101",
    unidade: "Secretaria de Educação",
    elementoSubelemento: "4.4.90.52",
    sub: "01",
    nomeCredor: "Tecnologia BR Equipamentos",
    cpfCnpj: "88.999.000/0001-22",
    rgIe: "ISENTO",
    endereco: "Distrito Industrial, 50 - Jaboatão - PE",
    saldoAnterior: 100000.0,
    valorEmpenho: 48000.0,
    historico: "Aquisição de computadores",
    dataPagamento: "2024-05-21",
  },
};

const EmpenhoVia = ({
  data,
  isEditing,
  onChange,
  isLast,
  viaTitle,
  empenhoIndex,
}: any) => {
  return (
    <div
      className={`w-full max-w-[210mm] min-h-[297mm] bg-[#fafafa] border border-transparent box-border font-sans text-black relative mx-auto ${!isLast ? "print:break-after-page mb-8" : ""} shadow-[0px_4px_24px_rgba(0,0,0,0.06)] print:shadow-none`}
    >
      <div className="w-full flex flex-col font-sans p-[8px]">
        {/* Header */}
        <div className="flex justify-between items-start pt-2 px-2 pb-1 relative">
          <div className="w-[84px] h-[84px] flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brasao_pernambuco.png"
              alt="Brasão do Estado de Pernambuco"
              className="w-[74px] h-auto object-contain mx-auto"
            />
          </div>
          <div className="flex flex-col text-center flex-1 tracking-wide font-sans mt-2">
            <span className="text-[16px] font-normal uppercase leading-tight tracking-wider mb-2">
              PROVISÃO DE CRÉDITO ORÇAMENTÁRIO
            </span>
            <span className="text-[16px] font-normal block uppercase leading-tight tracking-wide">
              NOTA DE EMPENHO - Ordem de Pagamento
            </span>
          </div>
          <div className="text-right flex items-end justify-end pb-2 pt-2 min-w-[140px]">
            <span className="text-[17px] font-bold uppercase tracking-wider text-slate-900 leading-none">
              EMPENHO Nº {typeof empenhoIndex === "number" ? empenhoIndex + 1 : 1}
            </span>
          </div>
        </div>

        <div className="mt-2 font-sans flex flex-col gap-2">
          {/* Unidade Orçamentária */}
          <div className="border border-black relative h-[32px] w-full">
            <span className="absolute -top-[8px] left-2 bg-[#fafafa] px-1 text-[10px] uppercase z-10">
              Unidade Orçamentária
            </span>
            <div className="pt-[11px] px-2 font-bold uppercase text-[12px] truncate flex justify-between items-center h-full">
              {isEditing ? (
                <div className="flex items-center gap-2 w-full h-full -mt-1">
                  <input
                    value={data.unidadeOrcamentaria}
                    onChange={(e) =>
                      onChange("unidadeOrcamentaria", e.target.value)
                    }
                    className="flex-1 h-full outline-none bg-yellow-50 font-bold"
                    placeholder="Unidade Orçamentária"
                  />
                  <span className="text-zinc-400 font-normal">|</span>
                  <input
                    value={data.gestaoUE}
                    onChange={(e) => onChange("gestaoUE", e.target.value)}
                    className="w-[100px] h-full outline-none bg-yellow-50 font-bold text-center"
                    placeholder="Código"
                  />
                </div>
              ) : (
                <div className="flex justify-between items-center w-full">
                  <span className="truncate">{data.unidadeOrcamentaria}</span>
                  {data.gestaoUE && (
                    <span className="ml-2 font-bold text-zinc-900">{data.gestaoUE}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Elemento / Subelemento */}
          <div className="border border-black relative h-[32px] w-full">
            <span className="absolute -top-[8px] left-2 bg-[#fafafa] px-1 text-[10px] uppercase z-10">
              Elemento/Subelemento
            </span>
            <div className="pt-[11px] px-2 font-bold uppercase text-[12px] truncate flex justify-between items-center h-full">
              {isEditing ? (
                <div className="flex items-center gap-2 w-full h-full -mt-1">
                  <input
                    value={data.elementoSubelemento}
                    onChange={(e) =>
                      onChange("elementoSubelemento", e.target.value)
                    }
                    className="flex-1 h-full outline-none bg-yellow-50 font-bold"
                    placeholder="Elemento/Subelemento"
                  />
                  <span className="text-zinc-400 font-normal">|</span>
                  <input
                    value={data.codigoElemento}
                    onChange={(e) => onChange("codigoElemento", e.target.value)}
                    className="w-[100px] h-full outline-none bg-yellow-50 font-bold text-center"
                    placeholder="Código"
                  />
                </div>
              ) : (
                <div className="flex justify-between items-center w-full">
                  <span className="truncate">{data.elementoSubelemento}</span>
                  {data.codigoElemento && (
                    <span className="ml-2 font-bold text-zinc-900">{data.codigoElemento}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Nome do Credor */}
        <div className="border border-black relative mt-2 bg-[#fafafa] flex items-center">
          <span className="absolute -top-[8px] left-2 bg-[#fafafa] px-2 text-[10px] uppercase leading-none z-10 shrink-0">
            NOME DO CREDOR
          </span>
          <div className="pt-2 pb-1 px-4 font-bold uppercase text-[12px] truncate w-full h-full flex items-center">
            {isEditing ? (
              <input
                value={data.credorNome}
                onChange={(e) => onChange("credorNome", e.target.value)}
                className="w-full outline-none bg-[#e3f2fd]/50 border-b border-transparent focus:border-[#1e293b] px-1 font-bold"
              />
            ) : (
              <span className="inline-block mt-1">{data.credorNome}</span>
            )}
          </div>
        </div>

        {/* CPF / CNPJ do Credor - Posicionado logo abaixo de Nome do Credor */}
        <div className="border border-black mt-2 bg-[#fafafa] text-[10px] flex">
          <div className="w-[80px] border-r border-black flex flex-col justify-center bg-[#f4f4f5] print:bg-transparent shrink-0">
            <div className="flex-1 flex items-center justify-center font-bold border-b border-black text-[11px] py-[3px]">
              CPF
            </div>
            <div className="flex-1 flex items-center justify-center font-bold text-[11px] py-[3px]">
              CNPJ
            </div>
          </div>
          <div className="flex flex-col flex-1">
            <div className="flex-1 flex border-b border-black items-center px-3 py-1 relative min-h-[22px]">
              {data.pessoaTipo === "FISICA" && !isEditing && (
                <span className="absolute inset-y-1 left-2 right-2 bg-[#e0e0e0] print:bg-transparent print:border print:border-black rounded-full shadow-inner print:shadow-none z-0"></span>
              )}
              {isEditing ? (
                <input
                  value={data.pessoaTipo === "FISICA" ? data.credorCpfCnpj : ""}
                  onChange={(e) => {
                    onChange("pessoaTipo", "FISICA");
                    onChange("credorCpfCnpj", e.target.value);
                  }}
                  className="w-full text-center outline-none bg-[#e3f2fd]/50 border-b border-transparent focus:border-[#1e293b] font-bold z-10 relative text-[13px]"
                  placeholder="CPF do Credor"
                />
              ) : data.pessoaTipo === "FISICA" ? (
                <span className="z-10 relative font-bold text-[14px] text-center w-full tracking-widest">
                  {data.credorCpfCnpj}
                </span>
              ) : (
                ""
              )}
            </div>
            <div className="flex-1 flex items-center px-3 py-1 relative min-h-[22px]">
              {data.pessoaTipo === "JURIDICA" && !isEditing && (
                <span className="absolute inset-y-1 left-2 right-2 bg-[#e0e0e0] print:bg-transparent print:border print:border-black rounded-full shadow-inner print:shadow-none z-0"></span>
              )}
              {isEditing ? (
                <input
                  value={data.pessoaTipo === "JURIDICA" ? data.credorCpfCnpj : ""}
                  onChange={(e) => {
                    onChange("pessoaTipo", "JURIDICA");
                    onChange("credorCpfCnpj", e.target.value);
                  }}
                  className="w-full text-center outline-none bg-[#e3f2fd]/50 border-b border-transparent focus:border-[#1e293b] font-bold z-10 relative text-[13px]"
                  placeholder="CNPJ do Credor"
                />
              ) : data.pessoaTipo === "JURIDICA" ? (
                <span className="z-10 relative font-bold text-[14px] text-center w-full tracking-widest">
                  {data.credorCpfCnpj}
                </span>
              ) : (
                ""
              )}
            </div>
          </div>
        </div>

        <div className="border border-black relative mt-3 bg-[#fafafa] flex items-center">
          <span className="absolute -top-[8px] left-2 bg-[#fafafa] px-2 text-[10px] uppercase leading-none z-10 shrink-0">
            Endereço
          </span>
          <div className="pt-2 pb-1 px-4 font-bold uppercase text-[12px] truncate w-full h-full flex items-center">
            {isEditing ? (
              <input
                value={data.credorEndereco}
                onChange={(e) => onChange("credorEndereco", e.target.value)}
                className="w-full outline-none bg-yellow-50 font-bold"
              />
            ) : (
              <span className="inline-block mt-1">{data.credorEndereco}</span>
            )}
          </div>
        </div>

        <div className="flex mt-2 gap-2 tracking-wide">
          <div className="flex-1 border border-black flex flex-col h-[48px] bg-[#fafafa]">
            <div className="text-[10px] text-center border-b border-black h-[14px] bg-[#f4f4f5] print:bg-transparent leading-tight font-bold flex items-center justify-center pt-[2px]">
              SALDO ANTERIOR
            </div>
            <div className="flex-1 flex items-center px-4 justify-between font-bold text-[15px] h-full">
              <span className="pt-[2px]">R$</span>
              {isEditing ? (
                <input
                  value={data.saldoAnterior}
                  onChange={(e) => onChange("saldoAnterior", e.target.value)}
                  className="text-right w-32 outline-none bg-yellow-50 h-full font-bold"
                />
              ) : (
                <span className="pt-[2px]">{data.saldoAnterior}</span>
              )}
            </div>
          </div>
          <div className="flex-[1.2] border border-black flex flex-col h-[48px] bg-[#fafafa] shadow-[0_0_0_1px_rgba(0,0,0,1)]">
            <div className="text-[10px] text-center border-b border-black font-bold h-[14px] bg-[#f4f4f5] print:bg-transparent leading-tight flex items-center justify-center pt-[2px]">
              VALOR EMPENHADO
            </div>
            <div className="flex-1 flex items-center px-4 justify-between font-extrabold text-[15px] h-full">
              <span className="pt-[2px]">R$</span>
              {isEditing ? (
                <input
                  value={data.valorEmpenho}
                  onChange={(e) => onChange("valorEmpenho", e.target.value)}
                  className="text-right w-32 outline-none bg-yellow-50 h-full font-bold"
                />
              ) : (
                <span className="pt-[2px]">{data.valorEmpenho}</span>
              )}
            </div>
          </div>
          <div className="flex-1 border border-black flex flex-col h-[48px] bg-[#fafafa]">
            <div className="text-[10px] text-center border-b border-black h-[14px] bg-[#f4f4f5] print:bg-transparent leading-tight font-bold flex items-center justify-center pt-[2px]">
              SALDO ATUAL
            </div>
            <div className="flex-1 flex items-center px-4 justify-between font-bold text-[15px] h-full">
              <span className="pt-[2px]">R$</span>
              {isEditing ? (
                <input
                  value={data.saldoAtual}
                  onChange={(e) => onChange("saldoAtual", e.target.value)}
                  className="text-right w-32 outline-none bg-yellow-50 h-full font-bold"
                />
              ) : (
                <span className="pt-[2px]">{data.saldoAtual}</span>
              )}
            </div>
          </div>
        </div>

        <div className="border border-black relative h-[38px] flex items-center justify-between bg-[#fafafa] w-full mt-2">
          <span className="absolute -top-[8px] left-2 bg-[#fafafa] px-1 leading-tight text-[10px] uppercase z-10">
            PROVISÃO CONCEDIDA
          </span>
          <div className="flex items-center px-2 text-[10px] flex-1">
            <span className="ml-[2px]">No. </span>
            <div className="border border-black ml-1 w-[46px] h-[22px] flex items-center justify-center font-bold">
              {isEditing ? (
                <input
                  value={data.provisaoNo}
                  onChange={(e) => onChange("provisaoNo", e.target.value)}
                  className="w-full h-full text-center outline-none bg-yellow-50 font-bold"
                />
              ) : (
                <span>{data.provisaoNo}</span>
              )}
            </div>
            <span className="ml-4 tabular-nums">Data</span>
            <div className="border border-black ml-1 w-[85px] h-[22px] flex items-center justify-center font-bold">
              {isEditing ? (
                <input
                  value={data.provisaoData}
                  onChange={(e) => onChange("provisaoData", e.target.value)}
                  className="w-full h-full text-center outline-none bg-yellow-50 font-bold"
                />
              ) : (
                <span className="tracking-widest">{data.provisaoData}</span>
              )}
            </div>
          </div>

          <div className="border-l border-black h-full flex items-center px-3 text-[10px] bg-[#fafafa]">
            <span className="font-bold uppercase mr-2">PAGO EM</span>
            <div className="border border-black w-[95px] h-[22px] flex items-center justify-center font-bold">
              {isEditing ? (
                <input
                  value={
                    data.pagamentoData ||
                    `${data.pagamentoDia || "30"}/${data.pagamentoMes || "04"}/${data.pagamentoAno || "2026"}`
                  }
                  onChange={(e) => onChange("pagamentoData", e.target.value)}
                  className="w-full h-full text-center outline-none bg-yellow-50 font-bold"
                />
              ) : (
                <span className="tracking-widest">
                  {data.pagamentoData ||
                    `${data.pagamentoDia || "30"}/${data.pagamentoMes || "04"}/${data.pagamentoAno || "2026"}`}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="border border-black mt-2 bg-[#fafafa] flex flex-col z-10 w-full overflow-hidden">
          <div className="flex border-b border-black text-[10px] text-center bg-[#f4f4f5] print:bg-transparent uppercase tracking-tight h-[36px]">
            <div className="flex-1 border-r border-black flex items-center justify-center font-[600] pt-[2px]">
              ESPECIFICAÇÃO OU HISTÓRICO
            </div>
            <div className="w-[65px] border-r border-black flex items-center justify-center font-[600] pt-[2px] shrink-0">
              UNIDADE
            </div>
            <div className="w-[65px] border-r border-black flex items-center justify-center font-[600] pt-[2px] shrink-0">
              QUANTID.
            </div>
            <div className="w-[190px] flex flex-col shrink-0">
              <div className="border-b border-black flex-[0.8] flex items-center justify-center font-[600] pt-[2px]">
                PREÇO
              </div>
              <div className="flex w-full flex-1">
                <div className="w-[95px] border-r border-black flex items-center justify-center font-[600] pt-[2px]">
                  UNITÁRIO
                </div>
                <div className="w-[95px] flex items-center justify-center font-[600] pt-[2px]">
                  TOTAL
                </div>
              </div>
            </div>
          </div>

          <div className="flex min-h-[120px] text-[12px] bg-[#fafafa]">
            <div className="flex-1 border-r border-black p-[10px] flex flex-col relative overflow-hidden">
              {isEditing ? (
                <textarea
                  value={data.especificacao}
                  onChange={(e) => onChange("especificacao", e.target.value)}
                  className="w-full flex-1 outline-none bg-yellow-50 resize-none font-[400] text-sm leading-snug tracking-wide"
                />
              ) : (
                <div className="whitespace-pre-wrap leading-tight text-sm tracking-wide font-normal pt-[2px]">
                  {data.especificacao}
                </div>
              )}
            </div>
            <div className="w-[65px] border-r border-black px-1 pt-3 flex flex-col items-center text-[12px] font-[500] shrink-0 bg-[#fafafa]">
              {isEditing ? (
                <textarea
                  value={data.unidade}
                  onChange={(e) => onChange("unidade", e.target.value)}
                  className="w-full outline-none bg-yellow-50 resize-none text-center h-full pt-[2px]"
                />
              ) : (
                <div className="text-center whitespace-pre-wrap pt-[2px]">
                  {data.unidade}
                </div>
              )}
            </div>
            <div className="w-[65px] border-r border-black px-1 pt-3 flex flex-col items-center text-[12px] font-[500] shrink-0 bg-[#fafafa]">
              {isEditing ? (
                <textarea
                  value={data.quantidade}
                  onChange={(e) => onChange("quantidade", e.target.value)}
                  className="w-full outline-none bg-yellow-50 resize-none text-center h-full pt-[2px]"
                />
              ) : (
                <div className="whitespace-pre-wrap text-center pt-[2px]">
                  {data.quantidade}
                </div>
              )}
            </div>
            <div className="w-[190px] flex text-[12px] font-[500] text-right tracking-wide shrink-0 bg-[#fafafa]">
              <div className="w-[95px] border-r border-black px-2 pt-3 flex flex-col items-end">
                {isEditing ? (
                  <textarea
                    value={data.valorUnitario}
                    onChange={(e) => onChange("valorUnitario", e.target.value)}
                    className="w-full outline-none bg-yellow-50 resize-none text-right h-full pt-[2px]"
                  />
                ) : (
                  <div className="w-full text-right whitespace-pre-wrap bg-[#fafafa] pt-[2px]">
                    {data.valorUnitario}
                  </div>
                )}
              </div>
              <div className="w-[95px] px-2 pt-3 flex flex-col items-end">
                {isEditing ? (
                  <textarea
                    value={data.valorTotal}
                    onChange={(e) => onChange("valorTotal", e.target.value)}
                    className="w-full outline-none bg-yellow-50 resize-none text-right h-full pt-[2px]"
                  />
                ) : (
                  <div className="w-full text-right whitespace-pre-wrap bg-[#fafafa] pt-[2px]">
                    {data.valorTotal}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex border-t border-black text-[11px] h-[32px] items-center bg-[#fafafa] justify-end">
            <div className="flex w-[190px] h-full items-center bg-[#f4f4f5] print:bg-transparent border-l border-black">
              <div className="w-[60px] px-2 flex items-center justify-start text-[11px] font-bold pt-[1px]">
                TOTAL:
              </div>
              <div className="flex-1 px-3 flex items-center justify-end font-bold text-[13px] tracking-wide">
                {isEditing ? (
                  <input
                    value={data.totalEspecificacao}
                    onChange={(e) =>
                      onChange("totalEspecificacao", e.target.value)
                    }
                    className="w-full text-right bg-yellow-50 outline-none h-full font-bold"
                  />
                ) : (
                  <span className="pt-[1px]">{data.totalEspecificacao}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex border-t border-black text-[11px] h-[30px] items-center bg-[#fafafa] w-full justify-between">
            <div className="flex-1 px-2 font-bold uppercase truncate text-[11px] tracking-tight flex items-center h-full">
              {isEditing ? (
                <input
                  value={
                    data.gerenciaEducacao ||
                    "GERÊNCIA REGIONAL DE EDUCAÇÃO DO AGRESTE MERIDIONAL"
                  }
                  onChange={(e) => onChange("gerenciaEducacao", e.target.value)}
                  className="w-full h-full outline-none bg-yellow-50 font-bold uppercase"
                />
              ) : (
                <span>
                  {data.gerenciaEducacao ||
                    "GERÊNCIA REGIONAL DE EDUCAÇÃO DO AGRESTE MERIDIONAL"}
                </span>
              )}
            </div>
            <div className="border-l border-black h-full flex items-center px-3 font-bold text-[11px] shrink-0 bg-[#f4f4f5] print:bg-transparent">
              {isEditing ? (
                <div className="flex items-center gap-1">
                  <span>CNPJ:</span>
                  <input
                    value={data.cnpjGerencia || "10.572.071/0002-01"}
                    onChange={(e) => onChange("cnpjGerencia", e.target.value)}
                    className="w-[140px] outline-none bg-yellow-50 font-bold text-center"
                  />
                </div>
              ) : (
                <span>CNPJ: {data.cnpjGerencia || "10.572.071/0002-01"}</span>
              )}
            </div>
          </div>
        </div>

        {/* PARTE 1: AUTORIZADO / PAGUE-SE */}
        <div className="border border-black p-2 bg-[#fafafa] flex flex-col justify-between relative mt-2 w-full min-h-[92px]">
          <div className="flex items-center justify-between border-b border-black/20 pb-1.5 px-2">
            <span className="uppercase tracking-wider font-bold text-[11px]">
              AUTORIZADO / PAGUE-SE
            </span>
            <div className="flex items-center gap-1.5 text-[11px] font-bold">
              <span className="text-[10px] uppercase text-gray-700">DATA:</span>
              {isEditing ? (
                <input
                  value={data.autorizadoData}
                  onChange={(e) => {
                    onChange("autorizadoData", e.target.value);
                    onChange("pagueseData", e.target.value);
                  }}
                  className="text-center outline-none bg-yellow-50 font-bold px-2 py-0.5 text-[12px]"
                />
              ) : (
                <span className="tracking-wide text-[12px]">{data.autorizadoData}</span>
              )}
            </div>
          </div>

          {/* Espaço para Assinatura Física e Carimbo */}
          <div className="h-[40px] w-full flex items-center justify-center">
            <span className="text-[9px] text-gray-300 print:hidden select-none font-sans">
              [ Espaço para assinatura e carimbo ]
            </span>
          </div>

          <div className="w-[80%] max-w-[500px] mx-auto border-t border-black text-center pt-0.5 text-[10px] font-bold uppercase">
            GESTOR(A) UNIDADE / RESPONSÁVEL UNIDADE ADMINISTRATIVA
          </div>
        </div>

        {/* PARTE 2: DEDUZIDO DA DOTAÇÃO PRÓPRIA / LIQUIDADO / PAGO */}
        <div className="border border-black p-2 bg-[#fafafa] flex flex-col justify-between relative mt-2 w-full min-h-[92px]">
          <div className="flex items-center justify-between border-b border-black/20 pb-1.5 px-2">
            <span className="uppercase tracking-wider font-bold text-[11px]">
              DEDUZIDO DA DOTAÇÃO PRÓPRIA / LIQUIDADO / PAGO
            </span>
            <div className="flex items-center gap-4 text-[11px] font-bold">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase text-gray-700">DATA:</span>
                {isEditing ? (
                  <input
                    value={data.pagoData}
                    onChange={(e) => {
                      onChange("pagoData", e.target.value);
                      onChange("deduzidoData", e.target.value);
                      onChange("liquidadoData", e.target.value);
                    }}
                    className="text-center outline-none bg-yellow-50 font-bold px-2 py-0.5 text-[12px]"
                  />
                ) : (
                  <span className="tracking-wide text-[12px]">{data.pagoData}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 border-l border-black/30 pl-3">
                <span className="text-[10px] uppercase text-gray-700">Nº CHEQUE:</span>
                {isEditing ? (
                  <input
                    value={data.chequeNo}
                    onChange={(e) => onChange("chequeNo", e.target.value)}
                    className="text-center outline-none bg-yellow-50 font-bold px-2 py-0.5 text-[12px] w-[85px]"
                  />
                ) : (
                  <span className="tracking-wider text-[12px] font-bold">{data.chequeNo}</span>
                )}
              </div>
            </div>
          </div>

          {/* Espaço para Assinatura Física e Carimbo */}
          <div className="h-[40px] w-full flex items-center justify-center">
            <span className="text-[9px] text-gray-300 print:hidden select-none font-sans">
              [ Espaço para assinatura e carimbo ]
            </span>
          </div>

          <div className="w-[80%] max-w-[500px] mx-auto border-t border-black text-center pt-0.5 text-[10px] font-bold uppercase">
            RESPONSÁVEL UNIDADE FINANCEIRA / TESOUREIRO
          </div>
        </div>

        {/* PARTE 3: MATERIAL RECEBIDO OU SERVIÇO PRESTADO */}
        <div className="border border-black p-2 bg-[#fafafa] flex flex-col justify-between relative mt-2 mb-2 w-full min-h-[92px]">
          <div className="flex items-center justify-between border-b border-black/20 pb-1.5 px-2">
            <div className="flex items-center gap-6 text-[10px] font-bold uppercase">
              <div
                className="flex items-center gap-1.5 cursor-pointer"
                onClick={() => isEditing && onChange("recebimentoTipo", "MATERIAL")}
              >
                <span>MATERIAL RECEBIDO</span>
                <div className="border border-black w-[16px] h-[16px] flex items-center justify-center text-[10px] font-bold bg-white">
                  {data.recebimentoTipo === "MATERIAL" ? "X" : ""}
                </div>
              </div>
              <div
                className="flex items-center gap-1.5 cursor-pointer"
                onClick={() => isEditing && onChange("recebimentoTipo", "SERVICO")}
              >
                <span>SERVIÇO PRESTADO</span>
                <div className="border border-black w-[16px] h-[16px] flex items-center justify-center text-[10px] font-bold bg-white">
                  {data.recebimentoTipo === "SERVICO" ? "X" : ""}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold">
              <span className="text-[10px] uppercase text-gray-700">DATA:</span>
              {isEditing ? (
                <input
                  value={data.recebimentoData}
                  onChange={(e) => onChange("recebimentoData", e.target.value)}
                  className="text-center outline-none bg-yellow-50 font-bold px-2 py-0.5 text-[12px]"
                />
              ) : (
                <span className="tracking-wide text-[12px]">{data.recebimentoData}</span>
              )}
            </div>
          </div>

          {/* Espaço para Assinatura Física e Carimbo */}
          <div className="h-[40px] w-full flex items-center justify-center">
            <span className="text-[9px] text-gray-300 print:hidden select-none font-sans">
              [ Espaço para assinatura e carimbo ]
            </span>
          </div>

          <div className="w-[80%] max-w-[500px] mx-auto border-t border-black text-center pt-0.5 text-[10px] font-bold uppercase">
            ASS. DO RESPONSÁVEL
          </div>
        </div>
      </div>
    </div>
  );
};

const ReciboVia = ({ data, frente, isEditing, onChange }: any) => {
  return (
    <div
      className={`w-full max-w-[210mm] min-h-[297mm] bg-[#fafafa] border border-transparent box-border font-sans text-black relative mx-auto shadow-[0px_4px_24px_rgba(0,0,0,0.06)] print:shadow-none p-[16mm]`}
    >
      {/* Layout do Recibo/Verso */}
      <div className="border border-black p-6 flex flex-col relative w-full h-[265mm]">
        <h1 className="text-xl font-bold tracking-widest border-b border-black pb-2 mb-6 uppercase text-center">
          Descontos e Recibo (Verso)
        </h1>

        <div className="flex gap-4 mb-6">
          <div className="flex-1 border border-black p-3 relative">
            <div className="text-[10px] font-bold uppercase mb-1 absolute -top-2 left-2 bg-[#fafafa] px-1">
              Número do Cheque
            </div>
            <div className="font-bold text-lg text-center mt-2">
              {isEditing ? (
                <input
                  value={data.numeroCheque}
                  onChange={(e) => onChange("numeroCheque", e.target.value)}
                  className="w-full text-center outline-none bg-[#e3f2fd]/50 border-b-2 border-transparent focus:border-[#1e293b] font-bold transition-all"
                />
              ) : (
                data.numeroCheque || "______"
              )}
            </div>
          </div>
          <div className="flex-1 border border-black p-3 bg-[#f4f4f5] print:bg-transparent relative">
            <div className="text-[10px] font-bold uppercase mb-1 absolute -top-2 left-2 bg-[#fafafa] px-1">
              Valor Bruto
            </div>
            <div className="font-bold text-lg text-center mt-2 flex justify-center items-center">
              R${" "}
              {isEditing ? (
                <input
                  value={data.valorBase}
                  onChange={(e) => onChange("valorBase", e.target.value)}
                  className="w-[100px] text-center outline-none bg-[#e3f2fd]/50 border-b-2 border-transparent focus:border-[#1e293b] font-bold transition-all ml-1"
                />
              ) : (
                data.valorBase || "0,00"
              )}
            </div>
          </div>
          <div className="flex-1 border border-black p-3 bg-[#e3f2fd] print:bg-transparent relative">
            <div className="text-[10px] font-bold uppercase mb-1 absolute -top-2 left-2 bg-[#e3f2fd] print:bg-[#fafafa] px-1">
              Valor Líquido
            </div>
            <div className="font-extrabold text-lg text-center mt-2 flex justify-center items-center">
              R${" "}
              {isEditing ? (
                <input
                  value={data.valorRecibo}
                  onChange={(e) => onChange("valorRecibo", e.target.value)}
                  className="w-[100px] text-center outline-none bg-[#fafafa]/50 border-b-2 border-transparent focus:border-[#1e293b] font-bold transition-all ml-1"
                />
              ) : (
                data.valorRecibo || "0,00"
              )}
            </div>
          </div>
        </div>

        <div className="border border-black mb-6 mt-2">
          <div className="border-b border-black text-center font-bold text-[11px] uppercase py-1.5 bg-[#f4f4f5] print:bg-transparent tracking-widest">
            Discriminação dos Descontos
          </div>
          <div className="grid grid-cols-6 text-[11px] border-b border-black">
            {/* 1. IRRF */}
            <div className="border-r border-black p-2 flex flex-col justify-between">
              <span className="font-bold text-gray-800 print:text-black uppercase text-[10px]">
                IRRF (1,5%)
              </span>
              <div className="mt-1 font-bold flex items-center justify-end text-[12px]">
                <span>R$&nbsp;</span>
                {isEditing ? (
                  <input
                    value={data.irrf}
                    onChange={(e) => onChange("irrf", e.target.value)}
                    className="w-full text-right outline-none bg-[#e3f2fd]/50 font-bold px-1"
                  />
                ) : (
                  <span>{data.irrf || "0,00"}</span>
                )}
              </div>
            </div>

            {/* 2. ISS */}
            <div className="border-r border-black p-2 flex flex-col justify-between">
              <span className="font-bold text-gray-800 print:text-black uppercase text-[10px]">
                ISS (5%)
              </span>
              <div className="mt-1 font-bold flex items-center justify-end text-[12px]">
                <span>R$&nbsp;</span>
                {isEditing ? (
                  <input
                    value={data.iss}
                    onChange={(e) => onChange("iss", e.target.value)}
                    className="w-full text-right outline-none bg-[#e3f2fd]/50 font-bold px-1"
                  />
                ) : (
                  <span>{data.iss || "0,00"}</span>
                )}
              </div>
            </div>

            {/* 3. INSS */}
            <div className="border-r border-black p-2 flex flex-col justify-between">
              <span className="font-bold text-gray-800 print:text-black uppercase text-[10px]">
                INSS (11%)
              </span>
              <div className="mt-1 font-bold flex items-center justify-end text-[12px]">
                <span>R$&nbsp;</span>
                {isEditing ? (
                  <input
                    value={data.inss}
                    onChange={(e) => onChange("inss", e.target.value)}
                    className="w-full text-right outline-none bg-[#e3f2fd]/50 font-bold px-1"
                  />
                ) : (
                  <span>{data.inss || "0,00"}</span>
                )}
              </div>
            </div>

            {/* 4. PATRONAL */}
            <div className="border-r border-black p-2 flex flex-col justify-between">
              <span className="font-bold text-gray-800 print:text-black uppercase text-[10px]">
                PATRONAL (20%)
              </span>
              <div className="mt-1 font-bold flex items-center justify-end text-[12px]">
                <span>R$&nbsp;</span>
                {isEditing ? (
                  <input
                    value={data.patronal}
                    onChange={(e) => onChange("patronal", e.target.value)}
                    className="w-full text-right outline-none bg-[#e3f2fd]/50 font-bold px-1"
                  />
                ) : (
                  <span>{data.patronal || "0,00"}</span>
                )}
              </div>
            </div>

            {/* 5. SEST / SENAT */}
            <div className="border-r border-black p-2 flex flex-col justify-between">
              <span className="font-bold text-gray-800 print:text-black uppercase text-[10px]">
                SEST/SENAT (2,5%)
              </span>
              <div className="mt-1 font-bold flex items-center justify-end text-[12px]">
                <span>R$&nbsp;</span>
                {isEditing ? (
                  <input
                    value={data.sestSenat}
                    onChange={(e) => onChange("sestSenat", e.target.value)}
                    className="w-full text-right outline-none bg-[#e3f2fd]/50 font-bold px-1"
                  />
                ) : (
                  <span>{data.sestSenat || "0,00"}</span>
                )}
              </div>
            </div>

            {/* 6. OUTROS / IBS-CBS */}
            <div className="p-2 flex flex-col justify-between">
              <span className="font-bold text-gray-800 print:text-black uppercase text-[10px]">
                OUTROS / IBS-CBS
              </span>
              <div className="mt-1 font-bold flex items-center justify-end text-[12px]">
                <span>R$&nbsp;</span>
                {isEditing ? (
                  <input
                    value={data.outrosDescontos}
                    onChange={(e) => onChange("outrosDescontos", e.target.value)}
                    className="w-full text-right outline-none bg-[#e3f2fd]/50 font-bold px-1"
                  />
                ) : (
                  <span>{data.outrosDescontos || "0,00"}</span>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-black text-right p-2.5 font-bold text-[13px] bg-[#f4f4f5] print:bg-transparent flex justify-end items-center">
            <span className="mr-4 uppercase tracking-wider text-[11px]">
              Total de Descontos:
            </span>
            <span className="w-[120px]">
              R${" "}
              {isEditing ? (
                <input
                  value={data.totalDescontos}
                  onChange={(e) => onChange("totalDescontos", e.target.value)}
                  className="w-[85px] text-right outline-none bg-[#e3f2fd]/50 border-b border-[#1e293b] px-1 ml-1 font-bold"
                />
              ) : (
                data.totalDescontos || "0,00"
              )}
            </span>
          </div>
        </div>

        {/* TEXTO DO RECIBO REORGANIZADO, MODERNO E ALINHADO À ESQUERDA */}
        <div className="text-left text-[14px] leading-[2.1] font-normal px-2 space-y-3 my-4 text-black">
          <p className="text-left">
            Recebi da{" "}
            <span className="font-bold uppercase">
              {isEditing ? (
                <input
                  value={
                    data.gerenciaEducacao ||
                    frente?.gerenciaEducacao ||
                    "GERÊNCIA REGIONAL DE EDUCAÇÃO DO AGRESTE MERIDIONAL"
                  }
                  onChange={(e) => onChange("gerenciaEducacao", e.target.value)}
                  className="outline-none bg-[#e3f2fd]/50 px-1 font-bold border-b border-[#1e293b]"
                />
              ) : (
                data.gerenciaEducacao ||
                frente?.gerenciaEducacao ||
                "GERÊNCIA REGIONAL DE EDUCAÇÃO DO AGRESTE MERIDIONAL"
              )}
            </span>
            , inscrita no CNPJ sob o nº{" "}
            <span className="font-bold">
              {isEditing ? (
                <input
                  value={
                    data.cnpjGerencia ||
                    frente?.cnpjGerencia ||
                    "10.572.071/0002-01"
                  }
                  onChange={(e) => onChange("cnpjGerencia", e.target.value)}
                  className="outline-none bg-[#e3f2fd]/50 px-1 font-bold border-b border-[#1e293b]"
                />
              ) : (
                data.cnpjGerencia ||
                frente?.cnpjGerencia ||
                "10.572.071/0002-01"
              )}
            </span>
            , a importância líquida de{" "}
            <span className="font-bold">
              R$ {data.valorRecibo || "0,00"}
            </span>{" "}
            (
            {isEditing ? (
              <input
                value={data.valorExtenso || ""}
                onChange={(e) => onChange("valorExtenso", e.target.value)}
                className="w-[380px] outline-none bg-[#e3f2fd]/50 px-1 font-bold border-b border-[#1e293b] uppercase"
              />
            ) : (
              <span className="font-bold border-b border-black px-1 uppercase">
                {data.valorExtenso ||
                  "DEZ MIL DUZENTOS E SETENTA E UM REAIS E VINTE E CINCO CENTAVOS"}
              </span>
            )}
            ), referente a:
          </p>

          {/* DESCRIÇÃO DO SERVIÇO (HISTÓRICO DA ORDEM DE PAGAMENTO / FRENTE DO EMPENHO) */}
          <div className="p-2.5 border border-black bg-[#f8fafc] print:bg-transparent text-black font-semibold text-[13px] leading-snug my-1">
            {isEditing ? (
              <textarea
                value={
                  data.referenteA && !data.referenteA.toLowerCase().startsWith("pagamento referente à nota de empenho")
                    ? data.referenteA
                    : (frente?.especificacao || data.especificacao || data.referenteA || "")
                }
                onChange={(e) => onChange("referenteA", e.target.value)}
                rows={2}
                className="w-full outline-none bg-[#e3f2fd]/50 p-1 font-semibold text-[13px] resize-none"
                placeholder="Descrição do serviço prestado..."
              />
            ) : (
              <div className="whitespace-pre-line text-left uppercase">
                {data.referenteA && !data.referenteA.toLowerCase().startsWith("pagamento referente à nota de empenho")
                  ? data.referenteA
                  : (frente?.especificacao || data.especificacao || data.referenteA || "PAGAMENTO REFERENTE À DESPESA DE SERVIÇO PRESTADO.")}
              </div>
            )}
          </div>

          <p className="text-left">
            deduzida da quantia de{" "}
            <span className="font-bold">
              R$ {data.totalDescontos || "0,00"}
            </span>{" "}
            (
            {isEditing ? (
              <input
                value={data.descontosExtenso || ""}
                onChange={(e) => onChange("descontosExtenso", e.target.value)}
                className="w-[380px] outline-none bg-[#e3f2fd]/50 px-1 font-bold border-b border-[#1e293b] uppercase"
              />
            ) : (
              <span className="font-bold border-b border-black px-1 uppercase">
                {data.descontosExtenso ||
                  "DOIS MIL CENTO E SETENTA E OITO REAIS E SETENTA E CINCO CENTAVOS"}
              </span>
            )}
            ), correspondentes aos descontos efetuados.
          </p>

          <p className="pt-2 font-medium text-black text-[14px]">
            Por ser verdade, firmo(amos) o presente recibo.
          </p>
        </div>

        <div className="mt-16 flex justify-end text-[16px] font-medium px-4">
          {isEditing ? (
            <input
              value={data.localData}
              onChange={(e) => onChange("localData", e.target.value)}
              className="w-[450px] outline-none bg-[#e3f2fd]/50 px-2 border-b-2 border-transparent focus:border-[#1e293b] text-right font-bold transition-all"
            />
          ) : (
            <span>{data.localData}</span>
          )}
        </div>

        <div className="mt-auto pt-4 border-t-[1.5px] border-black text-center w-[600px] mx-auto flex flex-col items-center">
          <div className="font-bold text-[16px] w-full">
            {isEditing ? (
              <input
                value={data.nomeRecebedor}
                onChange={(e) => onChange("nomeRecebedor", e.target.value)}
                className="w-full outline-none bg-[#e3f2fd]/50 px-2 border-b border-transparent focus:border-[#1e293b] text-center font-bold"
              />
            ) : (
              data.nomeRecebedor
            )}
          </div>
          <div className="text-[13px] mt-2 flex gap-8 w-full justify-center">
            <span>
              CPF/CNPJ:{" "}
              {isEditing ? (
                <input
                  value={data.cpfCnpj}
                  onChange={(e) => onChange("cpfCnpj", e.target.value)}
                  className="w-[150px] outline-none bg-[#e3f2fd]/50 px-2 border-b border-transparent focus:border-[#1e293b] text-center font-bold"
                />
              ) : (
                data.cpfCnpj
              )}
            </span>
            <span>
              RG:{" "}
              {isEditing ? (
                <input
                  value={data.rg}
                  onChange={(e) => onChange("rg", e.target.value)}
                  className="w-[150px] outline-none bg-[#e3f2fd]/50 px-2 border-b border-transparent focus:border-[#1e293b] text-center font-bold"
                />
              ) : (
                data.rg
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ConsultaImpressao() {
  const [view, setView] = useState<"search" | "document">("search");
  const [documentType, setDocumentType] = useState<
    "frente" | "verso" | "ambos"
  >("ambos");
  const [isEditing, setIsEditing] = useState(false);
  const [searchMode, setSearchMode] = useState<"single" | "batch">("single");

  const [batchInput, setBatchInput] = useState("");
  const [batchQuantity, setBatchQuantity] = useState("10");

  const [showNeModal, setShowNeModal] = useState(false);
  const [searchNeQuery, setSearchNeQuery] = useState("");
  const [nesDB, setNesDB] = useState<any[]>([]);

  useEffect(() => {
    if (showNeModal && nesDB.length === 0) {
      fetch('/api/notas-empenho')
        .then(r => r.json())
        .then(d => {
          if (d.notas) setNesDB(d.notas.map((n: any) => ({
            numero: n.numero, valor: n.valor, historico: n.historico || '', status: n.status,
            empenho: n.numero, gestao: n.gestao, unidade: n.unidadeOrcamentaria,
            elementoSubelemento: n.elementoSubelemento, nomeCredor: '', cpfCnpj: ''
          })));
        }).catch(() => {});
    }
  }, [showNeModal]);

  const [versoData, setVersoData] = useState({
    numeroCheque: "040496",
    valorBase: "12.450,00",
    irrf: "186,75",
    iss: "622,50",
    inss: "1.369,50",
    sestSenat: "0,00",
    patronal: "0,00",
    outrosDescontos: "0,00",
    totalDescontos: "2.178,75",
    descontosExtenso:
      "dois mil cento e setenta e oito reais e setenta e cinco centavos",
    valorRecibo: "10.271,25",
    valorExtenso:
      "dez mil duzentos e setenta e um reais e vinte cinco centavos",
    referenteA: "",
    localData: "Garanhuns/PE, 30 de abril de 2026",
    nomeRecebedor: "NOME FICTÍCIO DO CREDOR",
    cpfCnpj: "12345678900",
    rg: "1234567 SSP/PE",
    endereco: "Rua Fictícia, 123 - Bairro Fictício",
  });

  const [frenteData, setFrenteData] = useState({
    unidadeOrcamentaria: "SECRETARIA DE EDUCAÇÃO",
    atividadeProjeto: "",
    elementoSubelemento: "DIÁRIA/BOLSA",
    numeroEmpenho: "1",
    gestaoUE: "140101",
    codigoElemento: "339014",
    emissaoDia: "30",
    emissaoMes: "04",
    emissaoAno: "2026",
    pagamentoDia: "30",
    pagamentoMes: "04",
    pagamentoAno: "2026",
    pagamentoData: "30/04/2026",
    pessoaTipo: "FISICA",
    credorCpfCnpj: "12345678900",
    credorNome: "NOME Fictício DO CREDOR",
    credorEndereco: "Rua Fictícia, 123 - Bairro Fictício - Cidade/UF",
    saldoAnterior: "28,00",
    valorEmpenho: "28,00",
    saldoAtual: "0,00",
    provisaoNo: "7176",
    provisaoData: "09/03/2026",
    processoLicitacaoNo: "0",
    processoLicitacaoData: "",
    licitacaoTipo: "",
    especificacao:
      "Valor empenhado para despesa com Bolsa\nreferente a Formação Continuada.",
    unidade: "UN",
    quantidade: "1",
    valorUnitario: "55,00",
    valorTotal: "55,00",
    pedidoNo: "",
    processoNo: "",
    totalEspecificacao: "28,00",
    gerenciaEducacao: "GERÊNCIA REGIONAL DE EDUCAÇÃO DO AGRESTE MERIDIONAL",
    cnpjGerencia: "10.572.071/0002-01",
    autorizadoData: "30/04/2026",
    deduzidoData: "30/04/2026",
    recebimentoTipo: "SERVICO",
    recebimentoData: "30/04/2026",
    liquidadoData: "30/04/2026",
    pagueseData: "30/04/2026",
    pagoData: "30/04/2026",
    chequeNo: "040496",
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const gerarLote = async () => {
    let nes: string[] = [];
    if (searchMode === "single") {
      nes = batchInput.trim() ? [batchInput.trim()] : ["2026NE000123"];
    } else {
      const quantity = parseInt(batchQuantity, 10) || 1;
      const baseNE = batchInput.trim() || "2026NE000123";
      nes = Array(quantity).fill(baseNE);
    }

    toast.info("Consultando banco de dados...");

    let allDocs: any[] = [];
    
    for (let i = 0; i < nes.length; i++) {
      const formattedNe = nes[i].trim().toUpperCase();
      const match = formattedNe.match(/^(\d{4})NE/i);
      const ano = match ? match[1] : frenteData.emissaoAno;
      
      let opsDB: any[] = [];
      let neDB: any = null;
      const mockData = mockNEDatabase[formattedNe] || null;

      try {
        const resOps = await fetch(`/api/ordens-pagamento?numeroNe=${encodeURIComponent(formattedNe)}`);
        const opData = await resOps.json();
        if (resOps.ok && opData.ordens && opData.ordens.length > 0) {
          opsDB = opData.ordens;
        } else {
          // Fallback to fetching NE if no OP exists yet
          const resNe = await fetch(`/api/notas-empenho?numero=${encodeURIComponent(formattedNe)}`);
          const neData = await resNe.json();
          if (resNe.ok && neData.ne) neDB = neData.ne;
        }
      } catch (e) {
        console.error("Erro na busca", e);
      }

      if (opsDB.length > 0) {
        // Se achou OPs, cria um documento para cada OP desta NE
        opsDB.forEach((op, opIndex) => {
          const valorF = Number(op.valorPagamento).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
          const liquidoF = Number(op.valorLiquido).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
          
          allDocs.push({
            frente: {
              ...frenteData,
              numeroEmpenho: formattedNe,
              emissaoAno: ano,
              credorNome: op.credorNome || "",
              credorCpfCnpj: op.credorCpfCnpj || "",
              credorEndereco: op.credorEndereco || "",
              valorEmpenho: Number(op.valorEmpenho).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
              saldoAnterior: Number(op.saldoAnterior).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
              saldoAtual: Number(op.saldoAnterior - op.valorPagamento).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
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
              deduzidoData: op.dataPagamento || "",
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
              valorExtenso: numeroPorExtenso(Number(op.valorLiquido)),
              descontosExtenso: numeroPorExtenso(Number(op.totalDescontos)),
              irrf: op.irrf !== undefined ? String(op.irrf).replace('.', ',') : "0,00",
              iss: op.iss !== undefined ? String(op.iss).replace('.', ',') : "0,00",
              inss: op.inss !== undefined ? String(op.inss).replace('.', ',') : "0,00",
              sestSenat: op.sestSenat !== undefined ? String(op.sestSenat).replace('.', ',') : "0,00",
              patronal: op.patronal !== undefined ? String(op.patronal).replace('.', ',') : "0,00",
              outrosDescontos: op.outrosDescontos !== undefined ? String(op.outrosDescontos).replace('.', ',') : "0,00",
              totalDescontos: Number(op.totalDescontos).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
              valorRecibo: liquidoF,
            }
          });
        });
      } else {
        // Fallback p/ NE ou mock
        const finalNome = mockData ? mockData.nomeCredor : (neDB ? "" : frenteData.credorNome);
        const finalCpf = mockData ? mockData.cpfCnpj : (neDB ? "" : frenteData.credorCpfCnpj);
        const finalEndereco = mockData ? mockData.endereco : (neDB ? "" : frenteData.credorEndereco);
        const finalValor = mockData ? mockData.valorEmpenho : (neDB ? neDB.valor : parseFloat(frenteData.valorEmpenho.replace(',','.')));
        const finalGestao = mockData ? mockData.gestao : (neDB ? neDB.gestao : frenteData.gestaoUE);
        const finalUnidade = mockData ? mockData.unidade : (neDB ? neDB.unidadeOrcamentaria : frenteData.unidadeOrcamentaria);
        const finalElemento = mockData ? mockData.elementoSubelemento : (neDB ? neDB.elementoSubelemento : frenteData.elementoSubelemento);
        const finalHistorico = mockData ? mockData.historico || mockData.especificacao : (neDB ? neDB.historico : frenteData.especificacao);

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
            numeroCheque: String(40496 + i).padStart(6, "0"),
            referenteA: finalHistorico || "",
            valorBase: valorFormatado,
            cpfCnpj: finalCpf,
            endereco: finalEndereco,
            rg: mockData ? mockData.rgIe : versoData.rg,
            nomeRecebedor: finalNome,
            valorExtenso: vExtenso,
            descontosExtenso: dExtenso,
          },
        });
      }
    }

    setDocumentList(allDocs);
    if (allDocs.length > 1) {
      toast.success(`${allDocs.length} impressões prontas (Pagamentos parciais)`);
    } else {
      toast.success("Documento pronto para impressão!");
    }

    setTimeout(() => {
      setView("document");
    }, 600);
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-full bg-[#f4f4f5] print:bg-[#fafafa] overflow-y-auto overflow-x-hidden min-h-screen relative">
      <div className="print:hidden sticky top-0 z-50 w-full shadow-sm bg-[#fafafa] border-b border-gray-200">
        <ActionToolbar>
          {view === "search" ? (
            <>
              <ActionButton
                icon={Plus}
                label="Incluir Novo"
                onClick={() => handleAction("Incluir")}
              />
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setView("search");
                  setIsEditing(false);
                }}
                className="text-sm font-semibold mr-4 text-zinc-600 hover:text-[#1e293b] bg-[#fafafa] border border-[#d9dadb] px-4 py-2 rounded transition hover:bg-gray-50 flex items-center"
              >
                Nova Consulta
              </button>
              {isEditing ? (
                <div className="flex gap-2 print:hidden items-center ml-2">
                  <ActionButton
                    icon={Save}
                    label="Salvar Documentos"
                    primary
                    onClick={() => handleAction("Salvar Documento")}
                  />
                  <span className="w-[1px] h-6 bg-gray-200 mx-2"></span>
                  <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-300 text-xs font-bold gap-1">
                    <button
                      type="button"
                      onClick={() => setDocumentType("frente")}
                      className={`px-3 py-1.5 rounded transition-all ${
                        documentType === "frente"
                          ? "bg-[#1e293b] text-white shadow-sm"
                          : "text-zinc-600 hover:text-black hover:bg-gray-200"
                      }`}
                    >
                      Apenas Frente
                    </button>
                    <button
                      type="button"
                      onClick={() => setDocumentType("ambos")}
                      className={`px-3 py-1.5 rounded transition-all ${
                        documentType === "ambos"
                          ? "bg-[#1e293b] text-white shadow-sm"
                          : "text-zinc-600 hover:text-black hover:bg-gray-200"
                      }`}
                    >
                      Frente e Verso
                    </button>
                    <button
                      type="button"
                      onClick={() => setDocumentType("verso")}
                      className={`px-3 py-1.5 rounded transition-all ${
                        documentType === "verso"
                          ? "bg-[#1e293b] text-white shadow-sm"
                          : "text-zinc-600 hover:text-black hover:bg-gray-200"
                      }`}
                    >
                      Apenas Verso
                    </button>
                  </div>
                  <span className="w-[1px] h-6 bg-gray-200 mx-2"></span>
                  <ActionButton
                    icon={PrinterIcon}
                    label="Imprimir"
                    onClick={() => handleAction("Imprimir")}
                  />
                </div>
              ) : (
                <div className="flex gap-2 print:hidden items-center ml-2">
                  <ActionButton
                    icon={Edit}
                    label="Editar Documentos"
                    onClick={() => setIsEditing(true)}
                  />
                  <span className="w-[1px] h-6 bg-gray-200 mx-2"></span>
                  <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-300 text-xs font-bold gap-1">
                    <button
                      type="button"
                      onClick={() => setDocumentType("frente")}
                      className={`px-3 py-1.5 rounded transition-all ${
                        documentType === "frente"
                          ? "bg-[#1e293b] text-white shadow-sm"
                          : "text-zinc-600 hover:text-black hover:bg-gray-200"
                      }`}
                    >
                      Apenas Frente
                    </button>
                    <button
                      type="button"
                      onClick={() => setDocumentType("ambos")}
                      className={`px-3 py-1.5 rounded transition-all ${
                        documentType === "ambos"
                          ? "bg-[#1e293b] text-white shadow-sm"
                          : "text-zinc-600 hover:text-black hover:bg-gray-200"
                      }`}
                    >
                      Frente e Verso
                    </button>
                    <button
                      type="button"
                      onClick={() => setDocumentType("verso")}
                      className={`px-3 py-1.5 rounded transition-all ${
                        documentType === "verso"
                          ? "bg-[#1e293b] text-white shadow-sm"
                          : "text-zinc-600 hover:text-black hover:bg-gray-200"
                      }`}
                    >
                      Apenas Verso
                    </button>
                  </div>
                  <span className="w-[1px] h-6 bg-gray-200 mx-2"></span>
                  <ActionButton
                    icon={PrinterIcon}
                    label="Imprimir"
                    onClick={() => handleAction("Imprimir")}
                  />
                </div>
              )}
              <div className="flex-1"></div>
              {isEditing && (
                <span className="text-white font-bold bg-[#ba1a1a] px-3 py-1 rounded text-sm px-4 shadow animate-pulse">
                  Modo de Edição Sincronizado
                </span>
              )}
            </>
          )}
        </ActionToolbar>
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

            <div className="bg-[#fafafa] rounded-xl border border-[#d9dadb] shadow-sm p-8 w-full max-w-4xl hover:shadow-md transition-shadow">
              <div className="flex gap-4 mb-6 border-b border-gray-200 pb-2">
                <button
                  onClick={() => setSearchMode("single")}
                  className={`text-sm font-bold pb-2 border-b-2 uppercase tracking-wide transition-colors ${searchMode === "single" ? "border-[#1e293b] text-[#1e293b]" : "border-transparent text-gray-400 hover:text-gray-600"}`}
                >
                  Consulta Individual
                </button>
                <button
                  onClick={() => setSearchMode("batch")}
                  className={`text-sm font-bold pb-2 border-b-2 uppercase tracking-wide transition-colors ${searchMode === "batch" ? "border-[#1e293b] text-[#1e293b]" : "border-transparent text-gray-400 hover:text-gray-600"}`}
                >
                  Impressão em Lote
                </button>
              </div>

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
                          className="w-full p-4 rounded-l-lg border border-r-0 border-[#e4e4e7] bg-gray-50 text-sm focus:bg-[#fafafa] focus:outline-none focus:border-[#1e293b] focus:ring-2 focus:ring-[#1e293b]/20 font-bold tracking-wide transition-all"
                        />
                        <button
                          onClick={() => setShowNeModal(true)}
                          className="bg-gray-200 px-4 border border-[#e4e4e7] rounded-r-lg border-l-0 text-zinc-600 hover:bg-gray-300 transition-colors"
                        >
                          <Search className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={gerarLote}
                      className="bg-[#1e293b] text-white font-bold py-4 px-8 rounded-lg text-sm hover:bg-[#003366] transition-all flex justify-center items-center h-[54px] shadow-sm hover:shadow-md active:scale-[0.98]"
                    >
                      <Search className="w-4 h-4 mr-2" /> CONSULTAR
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-[2]">
                      <label className="block text-[11px] font-bold text-zinc-600 mb-2 uppercase tracking-wider">
                        Nº da NE Base
                      </label>
                      <div className="flex">
                        <input
                          type="text"
                          value={batchInput}
                          onChange={(e) => setBatchInput(e.target.value)}
                          placeholder="Ex: 2026NE000123"
                          className="w-full p-4 rounded-l-lg border border-r-0 border-[#e4e4e7] bg-gray-50 text-sm focus:bg-[#fafafa] focus:outline-none focus:border-[#1e293b] focus:ring-2 focus:ring-[#1e293b]/20 font-bold tracking-wide transition-all"
                        />
                        <button
                          onClick={() => setShowNeModal(true)}
                          className="bg-gray-200 px-4 border border-[#e4e4e7] rounded-r-lg border-l-0 text-zinc-600 hover:bg-gray-300 transition-colors"
                        >
                          <Search className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex-[1]">
                      <label className="block text-[11px] font-bold text-zinc-600 mb-2 uppercase tracking-wider">
                        Qtde de Ordens
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={batchQuantity}
                        onChange={(e) => setBatchQuantity(e.target.value)}
                        placeholder="Ex: 100"
                        className="w-full p-4 border border-[#e4e4e7] bg-gray-50 rounded-lg text-sm focus:bg-[#fafafa] focus:outline-none focus:border-[#1e293b] focus:ring-2 focus:ring-[#1e293b]/20 font-bold tracking-wide transition-all text-center"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={gerarLote}
                      className="bg-[#1e293b] text-white font-bold py-4 px-8 rounded-lg text-sm hover:bg-[#003366] transition-all flex justify-center items-center shadow-sm hover:shadow-md active:scale-[0.98]"
                    >
                      <FileText className="w-4 h-4 mr-2" /> GERAR LOTE (
                      {batchQuantity} docs)
                    </button>
                  </div>
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
                        ? "bg-[#1e293b] text-white border-[#1e293b] shadow-sm"
                        : "bg-gray-50 text-zinc-700 border-[#e4e4e7] hover:bg-gray-100"
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
                        ? "bg-[#1e293b] text-white border-[#1e293b] shadow-sm"
                        : "bg-gray-50 text-zinc-700 border-[#e4e4e7] hover:bg-gray-100"
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
                        ? "bg-[#1e293b] text-white border-[#1e293b] shadow-sm"
                        : "bg-gray-50 text-zinc-700 border-[#e4e4e7] hover:bg-gray-100"
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
          <div className="flex flex-col w-full items-center text-slate-800 pb-24 print:pb-0 mt-[20px] print:mt-0 print:block">
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
                className="w-full max-w-[210mm] flex flex-col items-center print:block mx-auto"
              >
                <div
                  className={`relative w-full isolate ${
                    documentType === "frente" || documentType === "ambos"
                      ? "block print:block"
                      : "hidden print:hidden"
                  } ${documentType === "ambos" ? "print:break-after-page" : ""}`}
                >
                  <div className="print:hidden absolute -left-[54px] -right-[54px] -top-[40px] -bottom-[40px] bg-[#e1e3e4] z-[-1] rounded-lg opacity-20 transition-opacity"></div>
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
                  className={`relative w-full isolate ${
                    documentType === "verso" || documentType === "ambos"
                      ? "block print:block"
                      : "hidden print:hidden"
                  } ${index !== documentList.length - 1 ? "print:break-after-page" : ""}`}
                >
                  <div className="print:hidden absolute -left-[54px] -right-[54px] -top-[40px] -bottom-[40px] bg-[#e1e3e4] z-[-1] rounded-lg opacity-20 transition-opacity"></div>
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

      {showNeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
              <h2 className="text-lg font-bold text-slate-800">
                Consultar NE Cadastrada
              </h2>
              <button
                onClick={() => setShowNeModal(false)}
                className="text-zinc-500 hover:text-zinc-800 p-1"
              >
                ✕
              </button>
            </div>
            <div className="p-4 border-b border-zinc-100">
              <div className="flex">
                <input
                  type="text"
                  placeholder="Pesquisar por NE, CPF/CNPJ ou Credor..."
                  value={searchNeQuery}
                  onChange={(e) => setSearchNeQuery(e.target.value)}
                  className="w-full pl-4 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-l-md text-sm focus:outline-none focus:border-slate-400 transition-shadow"
                />
                <button
                  type="button"
                  className="bg-[#e1e3e4] px-4 border border-[#d9dadb] border-l-0 rounded-r-md text-zinc-600 hover:bg-[#d9dadb] transition-colors flex items-center justify-center"
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
          </div>
        </div>
      )}
    </div>
  );
}
