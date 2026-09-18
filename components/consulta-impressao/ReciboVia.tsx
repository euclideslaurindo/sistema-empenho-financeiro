import { numeroPorExtenso } from '@/lib/utils';

export const ReciboVia = ({ data, frente, isEditing, onChange }: any) => {
  return (
    <div
      className={`w-full max-w-[210mm] min-h-[297mm] print:min-h-0 print:h-screen bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50 box-border font-sans text-black relative mx-auto shadow-[0px_4px_24px_rgba(0,0,0,0.06)] print:shadow-none p-[16mm]`}
    >
      {/* Layout do Recibo/Verso */}
      <div className="border border-black p-6 flex flex-col relative w-full h-[265mm]">
        <h1 className="text-xl font-bold tracking-widest border-b border-black pb-2 mb-6 uppercase text-center">
          Descontos e Recibo (Verso)
        </h1>

        <div className="flex gap-4 mb-6">
          <div className="flex-1 border border-black p-3 relative">
            <div className="text-[10px] font-bold uppercase mb-1 absolute -top-2 left-2 bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50 px-1">
              Número do Cheque
            </div>
            <div className="font-bold text-lg text-center mt-2">
              {isEditing ? (
                <input
                  value={data.numeroCheque}
                  onChange={(e) => onChange("numeroCheque", e.target.value)}
                  className="w-full text-center outline-none bg-blue-50/50 backdrop-blur-sm/50 border-b-2 border-transparent focus:border-[#1e293b] font-bold transition-all"
                />
              ) : (
                data.numeroCheque || "______"
              )}
            </div>
          </div>
          <div className="flex-1 border border-black p-3 bg-slate-50/50 print:bg-transparent relative">
            <div className="text-[10px] font-bold uppercase mb-1 absolute -top-2 left-2 bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50 px-1">
              Valor Bruto
            </div>
            <div className="font-bold text-lg text-center mt-2 flex justify-center items-center">
              R${" "}
              {isEditing ? (
                <input
                  value={data.valorBase}
                  onChange={(e) => onChange("valorBase", e.target.value)}
                  className="w-[100px] text-center outline-none bg-blue-50/50 backdrop-blur-sm/50 border-b-2 border-transparent focus:border-[#1e293b] font-bold transition-all ml-1"
                />
              ) : (
                data.valorBase || "0,00"
              )}
            </div>
          </div>
          <div className="flex-1 border border-black p-3 bg-blue-50/50 backdrop-blur-sm print:bg-transparent relative">
            <div className="text-[10px] font-bold uppercase mb-1 absolute -top-2 left-2 bg-blue-50/50 backdrop-blur-sm print:bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50 px-1">
              Valor Líquido
            </div>
            <div className="font-extrabold text-lg text-center mt-2 flex justify-center items-center">
              R${" "}
              {isEditing ? (
                <input
                  value={data.valorRecibo}
                  onChange={(e) => onChange("valorRecibo", e.target.value)}
                  className="w-[100px] text-center outline-none bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/50/50 border-b-2 border-transparent focus:border-[#1e293b] font-bold transition-all ml-1"
                />
              ) : (
                data.valorRecibo || "0,00"
              )}
            </div>
          </div>
        </div>

        <div className="border border-black mb-6 mt-2">
          <div className="border-b border-black text-center font-bold text-[11px] uppercase py-1.5 bg-slate-50/50 print:bg-transparent tracking-widest">
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
                    className="w-full text-right outline-none bg-blue-50/50 backdrop-blur-sm/50 font-bold px-1"
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
                    className="w-full text-right outline-none bg-blue-50/50 backdrop-blur-sm/50 font-bold px-1"
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
                    className="w-full text-right outline-none bg-blue-50/50 backdrop-blur-sm/50 font-bold px-1"
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
                    className="w-full text-right outline-none bg-blue-50/50 backdrop-blur-sm/50 font-bold px-1"
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
                    className="w-full text-right outline-none bg-blue-50/50 backdrop-blur-sm/50 font-bold px-1"
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
                    className="w-full text-right outline-none bg-blue-50/50 backdrop-blur-sm/50 font-bold px-1"
                  />
                ) : (
                  <span>{data.outrosDescontos || "0,00"}</span>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-black text-right p-2.5 font-bold text-[13px] bg-slate-50/50 print:bg-transparent flex justify-end items-center">
            <span className="mr-4 uppercase tracking-wider text-[11px]">
              Total de Descontos:
            </span>
            <span className="w-[120px]">
              R${" "}
              {isEditing ? (
                <input
                  value={data.totalDescontos}
                  onChange={(e) => onChange("totalDescontos", e.target.value)}
                  className="w-[85px] text-right outline-none bg-blue-50/50 backdrop-blur-sm/50 border-b border-[#1e293b] px-1 ml-1 font-bold"
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
                  className="outline-none bg-blue-50/50 backdrop-blur-sm/50 px-1 font-bold border-b border-[#1e293b]"
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
                  className="outline-none bg-blue-50/50 backdrop-blur-sm/50 px-1 font-bold border-b border-[#1e293b]"
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
                className="w-[380px] outline-none bg-blue-50/50 backdrop-blur-sm/50 px-1 font-bold border-b border-[#1e293b] uppercase"
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
          <div className="p-2.5 border border-black bg-transparent print:bg-transparent text-black font-semibold text-[13px] leading-snug my-1">
            {isEditing ? (
              <textarea
                value={
                  data.referenteA && !data.referenteA.toLowerCase().startsWith("pagamento referente à nota de empenho")
                    ? data.referenteA
                    : (frente?.especificacao || data.especificacao || data.referenteA || "")
                }
                onChange={(e) => onChange("referenteA", e.target.value)}
                rows={2}
                className="w-full outline-none bg-blue-50/50 backdrop-blur-sm/50 p-1 font-semibold text-[13px] resize-none"
                placeholder="Descrição do serviço prestado..."
              />
            ) : (
              <div className="whitespace-pre-line text-left uppercase break-all">
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
                className="w-[380px] outline-none bg-blue-50/50 backdrop-blur-sm/50 px-1 font-bold border-b border-[#1e293b] uppercase"
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
              className="w-[450px] outline-none bg-blue-50/50 backdrop-blur-sm/50 px-2 border-b-2 border-transparent focus:border-[#1e293b] text-right font-bold transition-all"
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
                className="w-full outline-none bg-blue-50/50 backdrop-blur-sm/50 px-2 border-b border-transparent focus:border-[#1e293b] text-center font-bold"
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
                  className="w-[150px] outline-none bg-blue-50/50 backdrop-blur-sm/50 px-2 border-b border-transparent focus:border-[#1e293b] text-center font-bold"
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
                  className="w-[150px] outline-none bg-blue-50/50 backdrop-blur-sm/50 px-2 border-b border-transparent focus:border-[#1e293b] text-center font-bold"
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
