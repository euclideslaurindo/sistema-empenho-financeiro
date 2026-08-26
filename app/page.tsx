"use client";
import { ActionToolbar, ActionButton } from "@/components/action-toolbar";
import {
  Plus,
  ArrowUpRight,
  ArrowRight,
  Printer as PrinterIcon,
  Users,
  FileText,
  Calendar,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

interface DashStats {
  credoresTotal: number;
  nesUltimos30: number;
  pagamentosPendentesTotal: number;
  ultimasNes: Array<{ numero: string; data: string; valor: number; status: string }>;
  ultimasOrdens: Array<{ credorNome: string; valorPagamento: number; quando: string }>;
}

export default function Dashboard() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [today, setToday] = useState<Date | null>(null);
  const [stats, setStats] = useState<DashStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    setToday(new Date());
    // Buscar stats reais
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setStats(data);
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  const handleAction = (action: string) => {
    toast.success(`Ação "${action}" realizada com sucesso!`);
  };

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  const prevMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
    );
  };

  const nextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
    );
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  const daysArray = [];
  for (let i = 0; i < firstDay; i++) {
    daysArray.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    daysArray.push(i);
  }

  const getDayEvents = (day: number | null) => {
    // Hardcoded mock events for visualization
    if (day === 10)
      return { label: "NE Vencida", color: "#ba1a1a", isWarning: true };
    if (day === 15)
      return { label: "2 Emissões", color: "#43474f", isWarning: false };
    if (day === 25)
      return { label: "Pgto Lote", color: "#1e293b", isWarning: false };
    return null;
  };

  if (!mounted) {
    return null; /* avoid hydration mismatch */
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <ActionToolbar>
        <ActionButton
          icon={Plus}
          label="Novo Empenho"
          onClick={() => handleNavigate("/notas-empenho")}
          primary
        />
        <ActionButton
          icon={Users}
          label="Novo Credor"
          onClick={() => handleNavigate("/credores")}
        />
      </ActionToolbar>

      <div className="p-8 max-w-[1280px] mx-auto w-full flex-1">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">
              Gestão de Pagamentos &gt; Dashboard
            </p>
            <h1 className="text-3xl font-bold text-slate-800 mb-1 tracking-tight">
              Painel de Controle de Empenho
            </h1>
            <p className="text-slate-500 text-sm">
              Acompanhamento em tempo real de execuções financeiras e orçamentárias.
            </p>
          </div>
          <div className="text-right hidden md:block">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Última atualização</p>
            <p className="font-semibold text-slate-700 bg-white px-3 py-1.5 rounded-md border border-slate-200 mt-1 shadow-sm text-sm">
              {today
                ? `${today.toLocaleDateString("pt-BR")}, ${today.toLocaleTimeString("pt-BR")}`
                : "Carregando..."}
            </p>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div
            className="bg-blue-600 p-6 rounded-md shadow-sm flex flex-col justify-between cursor-pointer hover:bg-blue-700 transition-colors border border-transparent"
            onClick={() => handleNavigate("/ordem-pagamento")}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 bg-white/20 rounded-md flex items-center justify-center text-white">
                <Wallet className="w-5 h-5" />
              </div>
              <div className="flex items-center text-white text-xs font-semibold bg-white/10 px-2.5 py-1 rounded-sm">
                <ArrowUpRight className="w-3 h-3 mr-1" /> Mês Atual
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white mb-0.5 tracking-tight">
                {statsLoading ? "..." : `R$ ${((stats?.pagamentosPendentesTotal || 0) / 1000).toFixed(1)}K`}
              </h2>
              <p className="text-blue-100 text-sm font-medium">
                Pagamentos do Mês
              </p>
            </div>
          </div>

          <div
            className="bg-white p-6 rounded-md shadow-sm flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow border border-slate-200"
            onClick={() => handleNavigate("/credores")}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 bg-slate-100 rounded-md flex items-center justify-center text-slate-600">
                <Users className="w-5 h-5" />
              </div>
              <div className="flex items-center text-slate-500 text-xs font-semibold bg-slate-100 px-2.5 py-1 rounded-sm">
                <ArrowRight className="w-3 h-3 mr-1" /> 0%
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-800 mb-0.5 tracking-tight">
                {statsLoading ? "..." : stats?.credoresTotal ?? 0}
              </h2>
              <p className="text-slate-500 text-sm font-medium">
                Credores Cadastrados
              </p>
            </div>
          </div>

          <div
            className="bg-white p-6 rounded-md shadow-sm flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow border border-slate-200"
            onClick={() => handleNavigate("/notas-empenho")}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 bg-slate-100 rounded-md flex items-center justify-center text-slate-600">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex items-center text-slate-500 text-xs font-semibold bg-slate-100 px-2.5 py-1 rounded-sm">
                ~ -4%
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-800 mb-0.5 tracking-tight">
                {statsLoading ? "..." : stats?.nesUltimos30 ?? 0}
              </h2>
              <p className="text-slate-500 text-sm font-medium">
                NEs (últimos 30 dias)
              </p>
            </div>
          </div>
        </div>

        {/* Middle Section: Calendar & Activities */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div
            className="lg:col-span-2 bg-white rounded-md shadow-sm border border-slate-200 p-6 flex flex-col relative z-10"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center">
                <Calendar className="w-5 h-5 text-blue-600 mr-2" />
                Calendário de Vencimentos
              </h3>
              <div className="flex items-center font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-md p-1">
                <button
                  className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    prevMonth();
                  }}
                >
                  &lt;
                </button>
                <span className="w-28 text-center text-sm">
                  {monthNames[month]} {year}
                </span>
                <button
                  className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    nextMonth();
                  }}
                >
                  &gt;
                </button>
              </div>
            </div>
            {/* Dynamic Calendar Grid */}
            <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-md overflow-hidden">
              {["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"].map((d) => (
                <div
                  key={d}
                  className="bg-slate-50 p-2 text-center text-[10px] font-bold text-slate-500 tracking-wider uppercase"
                >
                  {d}
                </div>
              ))}
              {daysArray.map((day, index) => {
                if (day === null) {
                  return (
                    <div
                      key={`blank-${index}`}
                      className="bg-slate-50 h-20 opacity-50"
                    ></div>
                  );
                }
                const ev = getDayEvents(day);
                const isToday =
                  today &&
                  day === today.getDate() &&
                  month === today.getMonth() &&
                  year === today.getFullYear();
                return (
                  <div
                    key={`day-${day}`}
                    className={`bg-white p-2 flex flex-col justify-between h-20 border-t-2 transition-colors ${isToday ? "border-blue-500 bg-blue-50/30" : "border-transparent"}`}
                  >
                    <span
                      className={`text-sm ${isToday ? "font-bold text-blue-700" : "text-slate-700 font-medium"}`}
                    >
                      {day}
                    </span>
                    {ev && (
                      <span
                        className={`text-[10px] font-bold`}
                        style={{ color: ev.color }}
                      >
                        {ev.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col justify-between gap-6">
            <div className="bg-white rounded-md border border-slate-200 shadow-sm p-6 flex-1">
              <h3 className="font-semibold text-slate-500 text-xs tracking-wider uppercase mb-5 flex items-center">
                Atividades Recentes
              </h3>
              <div className="space-y-5">
                {statsLoading ? (
                  <p className="text-sm text-slate-400">Carregando...</p>
                ) : stats?.ultimasOrdens && stats.ultimasOrdens.length > 0 ? (
                  stats.ultimasOrdens.map((o, i) => (
                    <div
                      key={i}
                      className="relative pl-5 cursor-pointer group"
                      onClick={() => handleNavigate("/ordem-pagamento")}
                    >
                      <div className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-blue-500"></div>
                      <p className="text-sm font-semibold text-slate-700 group-hover:text-blue-600 transition-colors">Pagamento Efetuado</p>
                      <p className="text-xs text-slate-500">Credor: {o.credorNome}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{o.quando}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">Nenhuma atividade recente.</p>
                )}
              </div>
            </div>

            <div
              className="bg-slate-800 rounded-md shadow-sm p-5 text-white flex flex-col justify-between cursor-pointer hover:bg-slate-900 transition-colors border border-slate-700"
              onClick={() => handleNavigate("/suporte")}
            >
              <div>
                <h3 className="font-bold text-xs text-blue-400 uppercase tracking-wider mb-2 flex items-center">
                  <ArrowUpRight className="w-3 h-3 mr-1" />
                  Suporte Institucional
                </h3>
                <p className="text-sm font-medium leading-relaxed mb-4 text-slate-300">
                  Precisa de auxílio com a nova portaria de empenhos ou manuais?
                </p>
              </div>
              <button className="bg-slate-700 hover:bg-blue-600 text-white text-sm font-semibold py-2 px-4 rounded transition-colors w-full">
                Acessar Manuais
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Table */}
        <div className="bg-white rounded-md shadow-sm border border-slate-200 overflow-hidden relative z-10 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div
            className="p-5 border-b border-slate-200 flex justify-between items-center bg-white cursor-pointer hover:bg-slate-50 transition-colors group"
            onClick={() => handleNavigate("/notas-empenho")}
          >
            <h3 className="font-bold text-slate-800 text-base flex items-center">
              <div className="w-1.5 h-5 bg-blue-500 rounded-full mr-3 group-hover:bg-blue-600 transition-colors"></div>
              Notas de Empenho Recentes
            </h3>
            <button className="text-sm font-semibold text-blue-600 flex items-center group-hover:translate-x-1 transition-transform">
              Ver todos <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 uppercase tracking-wider text-[11px]">Número</th>
                  <th className="px-5 py-3 uppercase tracking-wider text-[11px]">Data</th>
                  <th className="px-5 py-3 uppercase tracking-wider text-[11px]">Credor</th>
                  <th className="px-5 py-3 uppercase tracking-wider text-[11px]">Valor (R$)</th>
                  <th className="px-5 py-3 uppercase tracking-wider text-[11px]">Status</th>
                  <th className="px-5 py-3 uppercase tracking-wider text-[11px]">Ações</th>
                </tr>
              </thead>
              <tbody>
                {statsLoading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400 text-sm flex items-center justify-center">
                       <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></span> Carregando dados...
                    </td>
                  </tr>
                ) : stats?.ultimasNes && stats.ultimasNes.length > 0 ? (
                  stats.ultimasNes.map((ne, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/50 transition-colors text-slate-700 group cursor-pointer">
                      <td className="px-5 py-3.5 font-medium">{ne.numero}</td>
                      <td className="px-5 py-3.5">{ne.data}</td>
                      <td className="px-5 py-3.5 text-slate-500">—</td>
                      <td className="px-5 py-3.5 font-medium">{Number(ne.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-semibold ${
                          ne.status === 'LIQUIDADO' ? 'bg-blue-100 text-blue-700' :
                          ne.status === 'CANCELADO' ? 'bg-slate-200 text-slate-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>{ne.status}</span>
                      </td>
                      <td className="px-5 py-3.5 flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleNavigate('/consulta-impressao'); }}
                          className="text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          <PrinterIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-6 text-center text-slate-400 text-sm">Nenhuma nota de empenho cadastrada ainda.</td>
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
