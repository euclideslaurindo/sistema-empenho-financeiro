"use client";
import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Search, Wallet, User } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { maskCurrency, parseFormNumber } from "@/lib/utils";

function IndicadorSaldo({ control }: { control: any }) {
  const empenho = useWatch({ control, name: "empenho" });
  const saldoAnterior = useWatch({ control, name: "saldoAnterior" });
  const valorPagamento = useWatch({ control, name: "valorPagamento" });

  if (!empenho) return null;

  const valorPg = parseFormNumber(valorPagamento);
  const saldoAtual = Number(saldoAnterior) || 0;
  const ultrapassouSaldo = valorPg > saldoAtual && saldoAtual > 0;

  return (
    <div className={`p-4 rounded-xl border flex items-center gap-4 mb-8 ${ultrapassouSaldo ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
      <Wallet className="w-6 h-6" />
      <div>
        <p className="text-sm font-bold uppercase tracking-widest opacity-80">Saldo Anterior da NE</p>
        <p className="text-2xl font-black">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(saldoAtual)}</p>
      </div>
      <div className="ml-auto text-right">
        <p className="text-sm font-bold uppercase tracking-widest opacity-80">Saldo Restante Após Pagamento</p>
        <p className="text-xl font-bold">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(saldoAtual - valorPg)}</p>
      </div>
    </div>
  );
}

function InputValorPagamento({ register, control, errors }: { register: any, control: any, errors: any }) {
  const saldoAnterior = useWatch({ control, name: "saldoAnterior" });
  const valorPagamento = useWatch({ control, name: "valorPagamento" });

  const valorPg = parseFormNumber(valorPagamento);
  const saldoAtual = Number(saldoAnterior) || 0;
  const ultrapassouSaldo = valorPg > saldoAtual && saldoAtual > 0;

  return (
    <div className="col-span-12 md:col-span-4 mt-4">
      <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Valor a Pagar R$</label>
      <input 
        type="text" 
        placeholder="0,00" 
        {...register("valorPagamento", {
          onChange: (e: any) => {
            e.target.value = maskCurrency(e.target.value);
          }
        })} 
        className={`w-full px-4 py-3 rounded-xl border text-lg font-black focus:outline-none focus:ring-4 transition-all duration-300 ${ultrapassouSaldo ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-emerald-700 focus:border-emerald-400 focus:ring-emerald-500/10'}`} 
      />
    </div>
  );
}

export default function OpPaymentData({ errors }: { errors: any }) {
  const { register, setValue, getValues, control } = useFormContext<any>();

  const [neSuggestions, setNeSuggestions] = useState<any[]>([]);
  const [showNeSuggestions, setShowNeSuggestions] = useState(false);
  const [searchNeTimeout, setSearchNeTimeout] = useState<NodeJS.Timeout | null>(null);

  const [credorSuggestions, setCredorSuggestions] = useState<any[]>([]);
  const [showCredorSuggestions, setShowCredorSuggestions] = useState(false);
  const [searchCredorTimeout, setSearchCredorTimeout] = useState<NodeJS.Timeout | null>(null);

  const [cpfSuggestions, setCpfSuggestions] = useState<any[]>([]);
  const [showCpfSuggestions, setShowCpfSuggestions] = useState(false);

  // aceita numero opcional para evitar race condition quando chamado do selectNe
  const loadNe = async (overrideNumero?: string) => {
    const raw = overrideNumero || getValues("empenho");
    const numero = raw != null ? String(raw).trim() : '';
    if (!numero) { toast.error("Digite o número da NE para buscar."); return; }
    try {
      const apiData = await apiClient.get(`/api/notas-empenho?numero=${encodeURIComponent(numero)}`);
      if (apiData && apiData.ne) {
        const ne = apiData.ne;
        setValue("empenho", ne.numero);
        setValue("saldoAnterior", Number(ne.saldoDisponivel) || 0);
        setValue("valorEmpenho", Number(ne.valor) || 0);
        setValue("historico", ne.historico || '');
        setValue("unidadeOrcamentaria", ne.unidadeOrcamentaria || '');
        setValue("gestao", ne.gestao || '');
        setValue("elemento", ne.elemento || '');
        setValue("subelemento", ne.subelemento || '');

        const saldoFormatado = maskCurrency(Number(ne.saldoDisponivel) || 0);
        setValue("valorPagamento", saldoFormatado as any);

        const currentItens = getValues("itens") || [];
        const newItens = [...currentItens];
        newItens[0] = {
          especificacao: ne.historico || 'Pagamento referente ao empenho ' + ne.numero,
          quantidade: 1,
          unidade: 'UN',
          valorUnitario: saldoFormatado as any
        };
        setValue("itens", newItens);

        toast.success(`Dados da NE ${ne.numero} carregados.`);
        return;
      }
    } catch { }
    toast.error('NE não encontrada.');
  };

  const handleNeSearchChange = (val: string) => {
    setValue("empenho", val);
    if (searchNeTimeout) clearTimeout(searchNeTimeout);
    if (val.length >= 2) {
      setSearchNeTimeout(setTimeout(async () => {
        try {
          const data = await apiClient.get(`/api/notas-empenho?busca=${encodeURIComponent(val)}&limit=10`);
          if (data && data.notas) {
            setNeSuggestions(data.notas);
            setShowNeSuggestions(true);
          }
        } catch (err) {}
      }, 400));
    } else {
      setNeSuggestions([]);
      setShowNeSuggestions(false);
    }
  };

  const selectNe = (ne: any) => {
    setValue("empenho", ne.numero);
    setNeSuggestions([]);
    setShowNeSuggestions(false);
    loadNe(ne.numero);
  };

  const handleCpfChange = (val: string) => {
    setValue("cpfCnpj", val);
    setCpfSuggestions([]);
    setShowCpfSuggestions(false);
    if (searchCredorTimeout) clearTimeout(searchCredorTimeout);
    const digits = val.replace(/\D/g, '');
    if (digits.length >= 4) {
      setSearchCredorTimeout(setTimeout(async () => {
        try {
          const data = await apiClient.get(`/api/credores?busca=${encodeURIComponent(val)}&limit=8`);
          if (data?.credores?.length > 0) {
            setCpfSuggestions(data.credores);
            setShowCpfSuggestions(true);
          }
        } catch {}
      }, 350));
    }
  };

  const handleCredorNameChange = (val: string) => {
    setValue("nomeCredor", val);
    if (searchCredorTimeout) clearTimeout(searchCredorTimeout);
    if (val.length >= 2) {
      setSearchCredorTimeout(setTimeout(async () => {
        try {
          const data = await apiClient.get(`/api/credores?busca=${encodeURIComponent(val)}&limit=8`);
          if (data && data.credores && data.credores.length > 0) {
            setCredorSuggestions(data.credores);
            setShowCredorSuggestions(true);
          } else {
            setCredorSuggestions([]);
            setShowCredorSuggestions(false);
          }
        } catch (err) {}
      }, 350));
    } else {
      setCredorSuggestions([]);
      setShowCredorSuggestions(false);
    }
  };

  const selectCredor = (credor: any) => {
    setValue("nomeCredor", credor.nome);
    setValue("cpfCnpj", credor.cpf_cnpj || credor.cpfCnpj || '');
    setValue("rgCredor", credor.rg || '');
    setValue("enderecoCredor", credor.endereco || '');
    setCredorSuggestions([]);
    setShowCredorSuggestions(false);
  };

  return (
    <>
      <IndicadorSaldo control={control} />

      <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] mb-8">
        <div className="flex items-center mb-8 pb-4 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-900 mr-3">
          <Wallet className="w-4 h-4" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">
          Dados do Pagamento
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

        <div className="col-span-12 md:col-span-3">
          <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Número da OP</label>
          <input type="text" placeholder="Gerado automaticamente" disabled className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed transition-all duration-300" />
        </div>
        <div className="col-span-12 md:col-span-3">
          <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Data Emissão OP</label>
          <input type="date" {...register("dataEmissao")} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-800 transition-all duration-300" />
        </div>
        <div className="col-span-12 md:col-span-3">
          <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Nº do Cheque</label>
          <input type="text" placeholder="Ex: 852963" {...register("numeroCheque")} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-800 transition-all duration-300" />
        </div>
        <div className="col-span-12 md:col-span-3">
          <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Data do Pagamento</label>
          <input type="date" {...register("dataPagamento")} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-800 transition-all duration-300" />
        </div>

        <div className="col-span-12 md:col-span-4 relative">
          <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Nota de Empenho (NE)</label>
          <div className="relative flex">
            <input 
              type="text" 
              placeholder="Buscar NE (ex: 2024NE000123)" 
              {...register("empenho")}
              onChange={(e) => handleNeSearchChange(e.target.value)}
              onFocus={() => { if(getValues("empenho")?.length >= 2) setShowNeSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowNeSuggestions(false), 200)}
              className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-800 transition-all duration-300" 
            />
            <button onClick={() => loadNe()} type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-500 hover:bg-blue-50 rounded-lg"><Search className="w-4 h-4" /></button>
          </div>
          {showNeSuggestions && neSuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 max-h-60 overflow-y-auto">
              {neSuggestions.map(ne => (
                <div 
                  key={ne.id} 
                  onClick={() => selectNe(ne)}
                  className="p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors"
                >
                  <div className="font-bold text-slate-700">{ne.numero}</div>
                  <div className="text-xs text-slate-500 truncate">{ne.historico || 'Sem especificação'}</div>
                  <div className="text-xs font-black text-emerald-600 mt-1">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(ne.saldoDisponivel)} disponível</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="col-span-12 md:col-span-4">
          <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Unid. Orçamentária</label>
          <input type="text" {...register("unidadeOrcamentaria")} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-800 transition-all duration-300" />
        </div>

        <div className="col-span-12 md:col-span-4">
          <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Gestão</label>
          <input type="text" {...register("gestao")} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-800 transition-all duration-300" />
        </div>

        <div className="col-span-12">
          <div className="flex items-center mb-4 mt-4 pb-2 border-b border-slate-100">
            <div className="w-6 h-6 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 mr-2"><User className="w-3 h-3" /></div>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest">Favorecido</h3>
          </div>
        </div>

        <div className="col-span-12 md:col-span-3 relative">
          <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">CPF/CNPJ</label>
          <input
            type="text"
            placeholder="Digite para buscar..."
            {...register("cpfCnpj")}
            onChange={(e) => handleCpfChange(e.target.value)}
            onBlur={() => setTimeout(() => setShowCpfSuggestions(false), 200)}
            onFocus={() => { if (getValues("cpfCnpj")?.replace(/\D/g,'').length >= 4) setShowCpfSuggestions(true); }}
            className={`w-full px-4 py-3 rounded-xl border bg-slate-50 focus:border-blue-800 transition-all duration-300 ${errors?.cpfCnpj ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
          />
          {errors?.cpfCnpj && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.cpfCnpj.message}</p>}
          {showCpfSuggestions && cpfSuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-xl border border-slate-100 max-h-52 overflow-y-auto">
              {cpfSuggestions.map((c: any) => (
                <div
                  key={c.id}
                  onMouseDown={() => { selectCredor(c); setCpfSuggestions([]); setShowCpfSuggestions(false); }}
                  className="p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors"
                >
                  <div className="font-bold text-slate-800 text-sm">{c.nome} {c.is_mei ? <span className="text-emerald-600 ml-1 font-black text-xs uppercase bg-emerald-100 px-1 rounded">MEI</span> : ""}</div>
                  <div className="text-xs text-slate-500">{c.cpf_cnpj || c.cpfCnpj}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="col-span-12 md:col-span-5 relative">
          <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Nome do Credor</label>
          <input
            type="text"
            placeholder="Digite o nome para buscar..."
            {...register("nomeCredor")}
            onChange={(e) => handleCredorNameChange(e.target.value)}
            onBlur={() => setTimeout(() => setShowCredorSuggestions(false), 200)}
            onFocus={() => { if (getValues("nomeCredor")?.length >= 2) setShowCredorSuggestions(true); }}
            className={`w-full px-4 py-3 rounded-xl border bg-blue-50 text-blue-900 font-bold focus:border-blue-800 transition-all duration-300 ${errors?.nomeCredor ? 'border-red-400 bg-red-50 text-slate-900' : 'border-blue-100'}`}
          />
          {errors?.nomeCredor && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.nomeCredor.message}</p>}
          {showCredorSuggestions && credorSuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-xl border border-slate-100 max-h-52 overflow-y-auto">
              {credorSuggestions.map((c: any) => (
                <div
                  key={c.id}
                  onMouseDown={() => selectCredor(c)}
                  className="p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors"
                >
                  <div className="font-bold text-slate-800 text-sm">{c.nome} {c.is_mei ? <span className="text-emerald-600 ml-1 font-black text-xs uppercase bg-emerald-100 px-1 rounded">MEI</span> : ""}</div>
                  <div className="text-xs text-slate-500">{c.cpf_cnpj || c.cpfCnpj}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="col-span-12 md:col-span-2">
          <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">RG</label>
          <input type="text" {...register("rgCredor")} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-800 transition-all duration-300" />
        </div>

        <div className="col-span-12 md:col-span-2">
          <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Endereço</label>
          <input type="text" {...register("enderecoCredor")} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-800 transition-all duration-300" />
        </div>

          <InputValorPagamento register={register} control={control} errors={errors} />

      </div>
    </div>
    </>
  );
}
