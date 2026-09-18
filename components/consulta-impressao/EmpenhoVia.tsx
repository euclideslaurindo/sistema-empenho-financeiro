import { numeroPorExtenso } from '@/lib/utils';

export const EmpenhoVia = ({
  data,
  isEditing,
  onChange,
  isLast,
  viaTitle,
  empenhoIndex,
}: any) => {
  return (
    <div
      className={`w-full max-w-[210mm] min-h-[297mm] print:min-h-0 print:h-screen bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50 box-border print:font-serif text-black relative mx-auto mb-8 print:mb-0 shadow-[0px_4px_24px_rgba(0,0,0,0.06)] print:shadow-none`}
    >
      <div className="w-full flex flex-col font-sans p-[8px]">
        {/* Header */}
        <div className="flex justify-between items-start pt-2 px-2 pb-1 relative">
          <div className="w-[84px] h-[84px] flex items-center justify-center">
            { }
            <img
              src="/brasao_pernambuco.png"
              alt="Brasão do Estado de Pernambuco"
              className="w-[74px] h-auto object-contain mx-auto"
            />
          </div>
          <div className="flex flex-col text-center flex-1 tracking-wide font-sans mt-2">
            <span className="text-[16px] font-normal uppercase leading-tight tracking-wider mb-2">
              NOTA DE EMPENHO - Ordem de Pagamento
            </span>
            <span className="text-[16px] font-normal block uppercase leading-tight tracking-wide">
              PROVISÃO DE CRÉDITO ORÇAMENTÁRIO
            </span>
          </div>
          <div className="text-right flex flex-col items-end justify-end pb-2 pt-2 min-w-[140px]">
            <span className="text-[17px] font-bold uppercase tracking-wider text-slate-900 leading-none">
              EMPENHO Nº {data.numeroEmpenho || (typeof empenhoIndex === "number" ? empenhoIndex + 1 : 1)}
            </span>
            {data.sub && (
              <span className="text-[13px] font-bold uppercase tracking-wider text-slate-700 mt-1">
                SUB-EMPENHO: {data.sub}
              </span>
            )}
          </div>
        </div>

        <div className="mt-2 font-sans flex flex-col gap-2">
          {/* Unidade Orçamentária */}
          <div className="border border-black relative h-[32px] w-full">
            <span className="absolute -top-[8px] left-2 bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50 px-1 text-[10px] uppercase z-10">
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
            <span className="absolute -top-[8px] left-2 bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50 px-1 text-[10px] uppercase z-10">
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
        <div className="border border-black relative mt-2 bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50 flex items-center">
          <span className="absolute -top-[8px] left-2 bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50 px-2 text-[10px] uppercase leading-none z-10 shrink-0">
            NOME DO CREDOR
          </span>
          <div className="pt-2 pb-1 px-4 font-bold uppercase text-[12px] truncate w-full h-full flex items-center">
            {isEditing ? (
              <input
                value={data.credorNome}
                onChange={(e) => onChange("credorNome", e.target.value)}
                className="w-full outline-none bg-blue-50/50 backdrop-blur-sm/50 border-b border-transparent focus:border-[#1e293b] px-1 font-bold"
              />
            ) : (
              <span className="inline-block mt-1">
                {data.credorNome} {data.credorCpfCnpj ? `- ${data.credorCpfCnpj}` : ""}
              </span>
            )}
          </div>
        </div>

        {/* CPF / CNPJ do Credor - Posicionado logo abaixo de Nome do Credor */}
        <div className="border border-black mt-2 bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50 text-[10px] flex">
          <div className="w-[80px] border-r border-black flex flex-col justify-center bg-slate-50/50 print:bg-transparent shrink-0">
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
                <span className="absolute inset-y-1 left-2 right-2 bg-slate-200/80 print:bg-transparent print:border print:border-black rounded-full shadow-inner print:shadow-none z-0"></span>
              )}
              {isEditing ? (
                <input
                  value={data.pessoaTipo === "FISICA" ? data.credorCpfCnpj : ""}
                  onChange={(e) => {
                    onChange("pessoaTipo", "FISICA");
                    onChange("credorCpfCnpj", e.target.value);
                  }}
                  className="w-full text-center outline-none bg-blue-50/50 backdrop-blur-sm/50 border-b border-transparent focus:border-[#1e293b] font-bold z-10 relative text-[13px]"
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
                <span className="absolute inset-y-1 left-2 right-2 bg-slate-200/80 print:bg-transparent print:border print:border-black rounded-full shadow-inner print:shadow-none z-0"></span>
              )}
              {isEditing ? (
                <input
                  value={data.pessoaTipo === "JURIDICA" ? data.credorCpfCnpj : ""}
                  onChange={(e) => {
                    onChange("pessoaTipo", "JURIDICA");
                    onChange("credorCpfCnpj", e.target.value);
                  }}
                  className="w-full text-center outline-none bg-blue-50/50 backdrop-blur-sm/50 border-b border-transparent focus:border-[#1e293b] font-bold z-10 relative text-[13px]"
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

        <div className="border border-black relative mt-3 bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50 flex items-center">
          <span className="absolute -top-[8px] left-2 bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50 px-2 text-[10px] uppercase leading-none z-10 shrink-0">
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
          <div className="flex-1 border border-black flex flex-col h-[48px] bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50">
            <div className="text-[10px] text-center border-b border-black h-[14px] bg-slate-50/50 print:bg-transparent leading-tight font-bold flex items-center justify-center pt-[2px]">
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
          <div className="flex-[1.2] border border-black flex flex-col h-[48px] bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50 shadow-[0_0_0_1px_rgba(0,0,0,1)]">
            <div className="text-[10px] text-center border-b border-black font-bold h-[14px] bg-slate-50/50 print:bg-transparent leading-tight flex items-center justify-center pt-[2px]">
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
          <div className="flex-1 border border-black flex flex-col h-[48px] bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50">
            <div className="text-[10px] text-center border-b border-black h-[14px] bg-slate-50/50 print:bg-transparent leading-tight font-bold flex items-center justify-center pt-[2px]">
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

        <div className="border border-black relative h-[38px] flex items-center justify-between bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50 w-full mt-2">
          <span className="absolute -top-[8px] left-2 bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50 px-1 leading-tight text-[10px] uppercase z-10">
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
                <span className="tracking-tight">{data.provisaoData}</span>
              )}
            </div>
          </div>

          <div className="border-l border-black h-full flex items-center px-3 text-[10px] bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50">
            <span className="font-bold uppercase mr-2">PAGO EM (CHEQUE Nº)</span>
            <div className="border border-black w-[95px] h-[22px] flex items-center justify-center font-bold">
              {isEditing ? (
                <input
                  value={data.numeroCheque || ""}
                  onChange={(e) => onChange("numeroCheque", e.target.value)}
                  className="w-full h-full text-center outline-none bg-yellow-50 font-bold"
                />
              ) : (
                <span className="tracking-tight">
                  {data.numeroCheque || ""}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="border border-black mt-2 bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50 flex flex-col z-10 w-full overflow-hidden">
          <div className="flex border-b border-black text-[10px] text-center bg-slate-50/50 print:bg-transparent uppercase tracking-tight h-[36px]">
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

          <div className="flex min-h-[120px] text-[12px] bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50">
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
            <div className="w-[65px] border-r border-black px-1 pt-3 flex flex-col items-center text-[12px] font-[500] shrink-0 bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50">
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
            <div className="w-[65px] border-r border-black px-1 pt-3 flex flex-col items-center text-[12px] font-[500] shrink-0 bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50">
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
            <div className="w-[190px] flex text-[12px] font-[500] text-right tracking-wide shrink-0 bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50">
              <div className="w-[95px] border-r border-black px-2 pt-3 flex flex-col items-end">
                {isEditing ? (
                  <textarea
                    value={data.valorUnitario}
                    onChange={(e) => onChange("valorUnitario", e.target.value)}
                    className="w-full outline-none bg-yellow-50 resize-none text-right h-full pt-[2px]"
                  />
                ) : (
                  <div className="w-full text-right whitespace-pre-wrap bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50 pt-[2px]">
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
                  <div className="w-full text-right whitespace-pre-wrap bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50 pt-[2px]">
                    {data.valorTotal}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex border-t border-black text-[11px] h-[32px] items-center bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50 justify-end">
            <div className="flex w-[190px] h-full items-center bg-slate-50/50 print:bg-transparent border-l border-black">
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

          <div className="flex border-t border-black text-[11px] h-[30px] items-center bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50 w-full justify-between">
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
            <div className="border-l border-black h-full flex items-center px-3 font-bold text-[11px] shrink-0 bg-slate-50/50 print:bg-transparent">
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
        <div className="border border-black p-2 bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50 flex flex-col justify-between relative mt-2 w-full min-h-[92px]">
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
        <div className="border border-black p-2 bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50 flex flex-col justify-between relative mt-2 w-full min-h-[92px]">
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
                  <span className="tracking-tight text-[12px] font-bold">{data.chequeNo}</span>
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
        <div className="border border-black p-2 bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50 flex flex-col justify-between relative mt-2 mb-2 w-full min-h-[92px]">
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
                <span className="tracking-tight text-[12px]">{data.recebimentoData}</span>
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
