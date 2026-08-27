"use client";
import {
  Plus,
  ArrowRight,
  Printer as PrinterIcon,
  Users,
  FileText,
  Landmark,
  TrendingUp,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

interface DashStats {
  credoresTotal: number;
  credoresVariacao: number;
  nesUltimos30: number;
  nesVariacao: number;
  pagamentosPendentesTotal: number;
  pagamentosVariacao: number;
  ultimasNes: Array<{ numero: string; data: string; unidade: string; valor: number; status: string }>;
}

export default function Dashboard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<DashStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      setMounted(true);
      try {
        const r = await fetch("/api/dashboard/stats");
        const data = await r.json();
        if (!data.error) setStats(data);
      } catch (err) {
        // ignore
      } finally {
        setStatsLoading(false);
      }
    };
    init();
  }, []);

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="p-8 max-w-[1400px] mx-auto w-full flex-1 space-y-10">
        
        {/* HERO HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between animate-fade-in pt-4">
          <div>
            <h1 className="text-4xl md:text-[2.75rem] font-black text-slate-800 mb-3 tracking-tight">
              Painel <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-400">Financeiro</span>
            </h1>
            <p className="text-slate-500 font-medium text-[1.1rem] max-w-xl leading-relaxed">
              Resumo da execução orçamentária de hoje.
            </p>
          </div>
          <div className="mt-6 md:mt-0 flex items-center gap-4">
            <button 
              onClick={() => handleNavigate("/notas-empenho")}
              className="bg-blue-900 hover:bg-blue-800 text-white text-sm font-bold py-3 px-6 rounded-xl shadow-[0_8px_20px_rgba(37,99,235,0.25)] transition-all flex items-center gap-2 border border-blue-500"
            >
              Novo Empenho
            </button>
            <button 
              onClick={() => handleNavigate("/credores")}
              className="bg-white hover:bg-slate-50 text-blue-900 text-sm font-bold py-3 px-6 rounded-xl shadow-sm border border-slate-200 transition-all flex items-center gap-2"
            >
              Novo Credor
            </button>
          </div>
        </div>

        {/* BENTO GRID: METRICS */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 animate-slide-up">
          
          {/* Main Metric Card - Solid Blue */}
          <div
            className="md:col-span-8 relative p-10 rounded-3xl overflow-hidden cursor-pointer group transition-all duration-500 shadow-[0_12px_40px_rgba(37,99,235,0.15)] hover:-translate-y-1"
            onClick={() => handleNavigate("/ordem-pagamento")}
          >
            {/* Pure Blue Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] z-0"></div>
            
            {/* Bank Watermark */}
            <div className="absolute -bottom-6 -right-6 text-white/10 z-0 group-hover:scale-105 transition-transform duration-700 pointer-events-none">
               <Landmark className="w-80 h-80" strokeWidth={1} />
            </div>
            
            <div className="relative z-10 flex flex-col h-full justify-between min-h-[200px]">
              <div>
                <p className="text-blue-100/90 text-xs font-black tracking-widest uppercase mb-1">Total a Pagar</p>
                <h2 className="text-5xl md:text-[4rem] font-black text-white tracking-tighter drop-shadow-sm leading-none mt-2">
                  {statsLoading ? "..." : `R$ ${Number(stats?.pagamentosPendentesTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </h2>
              </div>
              
              <div className="mt-12 flex">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 text-white text-xs font-bold backdrop-blur-md">
                   <TrendingUp className="w-3.5 h-3.5" /> {stats?.pagamentosVariacao !== undefined ? `${stats.pagamentosVariacao > 0 ? '+' : ''}${stats.pagamentosVariacao}%` : '...'} vs mês anterior
                </div>
              </div>
            </div>
          </div>

          {/* Secondary Metric Cards container */}
          <div className="md:col-span-4 flex flex-col gap-8">
            <div
              className="bg-white border border-slate-200 p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] flex flex-col justify-between flex-1 cursor-pointer hover:-translate-y-1 transition-all group"
              onClick={() => handleNavigate("/credores")}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-900 transition-colors duration-300">
                  <Users className="w-5 h-5" />
                </div>
                {stats?.credoresVariacao !== undefined && (
                  <div className={`flex items-center text-xs font-black px-2 py-1 rounded-full ${stats.credoresVariacao >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
                    <TrendingUp className="w-3 h-3 mr-1" /> {stats.credoresVariacao > 0 ? '+' : ''}{stats.credoresVariacao}%
                  </div>
                )}
              </div>
              <div>
                <p className="text-slate-400 text-xs font-black tracking-widest uppercase mb-1">Credores Ativos</p>
                <h2 className="text-4xl font-black text-slate-800 tracking-tight">
                  {statsLoading ? "..." : stats?.credoresTotal ?? 0}
                </h2>
              </div>
            </div>

            <div
              className="bg-white border border-slate-200 p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] flex flex-col justify-between flex-1 cursor-pointer hover:-translate-y-1 transition-all group"
              onClick={() => handleNavigate("/notas-empenho")}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-900 transition-colors duration-300">
                  <FileText className="w-5 h-5" />
                </div>
                {stats?.nesVariacao !== undefined && (
                  <div className={`flex items-center text-xs font-black px-2 py-1 rounded-full ${stats.nesVariacao >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
                    <TrendingUp className="w-3 h-3 mr-1" /> {stats.nesVariacao > 0 ? '+' : ''}{stats.nesVariacao}%
                  </div>
                )}
              </div>
              <div>
                <p className="text-slate-400 text-xs font-black tracking-widest uppercase mb-1">Notas Emitidas</p>
                <h2 className="text-4xl font-black text-slate-800 tracking-tight">
                  {statsLoading ? "..." : stats?.nesUltimos30 ?? 0}
                </h2>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: Tabela Últimas Movimentações */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)] animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-bold text-slate-800 text-xl tracking-tight">
              Últimas Movimentações
            </h3>
            <button 
              onClick={() => handleNavigate("/notas-empenho")}
              className="text-sm font-bold text-blue-900 hover:text-blue-700 transition-colors"
            >
              Ver todas →
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">Número NE</th>
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">Data</th>
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">Unidade Gestora</th>
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">Valor (R$)</th>
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {statsLoading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-bold">
                       Carregando movimentações...
                    </td>
                  </tr>
                ) : stats?.ultimasNes && stats.ultimasNes.length > 0 ? (
                  stats.ultimasNes.map((ne, i) => (
                    <tr key={i} className="group hover:bg-blue-50/50 transition-colors cursor-pointer">
                      <td className="py-4 font-bold text-blue-900 rounded-l-lg pl-2">
                        {ne.numero}
                      </td>
                      <td className="py-4 font-semibold text-slate-500">
                        {ne.data}
                      </td>
                      <td className="py-4 font-semibold text-slate-600">
                        {ne.unidade || "Não informada"}
                      </td>
                      <td className="py-4 font-black text-slate-700">
                        {Number(ne.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 text-right rounded-r-lg pr-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase ${
                          ne.status === 'LIQUIDADO' ? 'bg-emerald-50 text-emerald-600' :
                          ne.status === 'CANCELADO' ? 'bg-slate-100 text-slate-500' :
                          ne.status === 'Processando' ? 'bg-amber-50 text-amber-600' :
                          'bg-blue-50 text-blue-900'
                        }`}>
                          {ne.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-bold">Nenhum registro encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
