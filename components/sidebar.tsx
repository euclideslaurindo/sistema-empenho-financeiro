"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  Banknote,
  Printer,
  Settings,
  HelpCircle,
  Landmark,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Credores", href: "/credores", icon: Users },
  { name: "Notas de Empenho", href: "/notas-empenho", icon: FileText },
  { name: "Ordem de Pagamento", href: "/ordem-pagamento", icon: Banknote },
  { name: "Consulta/Impressão", href: "/consulta-impressao", icon: Printer },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleAction = (action: string) => {
    if (action === "Novo Empenho") {
      toast.success("Iniciando novo empenho...");
      router.push("/notas-empenho");
      return;
    }
    toast.info(`Acessando menu: ${action}`);
  };

  return (
    <aside className="w-[260px] h-full flex flex-col py-6 shrink-0 overflow-y-auto relative z-20 custom-scrollbar bg-slate-900/80 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8 w-full px-6">
        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30 ring-1 ring-white/20">
          <Landmark className="text-white w-8 h-8" />
        </div>
        <h1 className="text-lg font-black font-display text-white text-center leading-tight tracking-tight">
          Gestão de Empenho
        </h1>
        <p className="text-[9px] text-blue-200/60 font-bold mt-1.5 uppercase tracking-[0.25em]">
          Painel Financeiro
        </p>
      </div>

      <div className="w-full mb-6 px-6">
        <button
          onClick={() => handleAction("Novo Empenho")}
          className="w-full bg-white text-slate-900 hover:bg-blue-50 hover:text-blue-700 font-bold py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center shadow-lg hover:shadow-blue-500/20 text-sm group"
        >
          <Plus className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:rotate-90" /> Novo Empenho
        </button>
      </div>

      <p className="px-8 mb-3 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
        Menu Principal
      </p>

      <nav className="w-full flex-1 flex flex-col space-y-1.5 px-4">
        {navItems.map((item, index) => {
          const isActive =
            pathname === item.href ||
            (pathname !== "/" &&
              item.href !== "/" &&
              pathname?.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center px-4 py-3 rounded-xl text-sm transition-all duration-300 group relative overflow-hidden",
                isActive
                  ? "bg-blue-600/20 text-white font-bold shadow-inner border border-blue-500/30"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent",
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Active glow */}
              {isActive && (
                <div className="absolute left-0 top-0 w-1 h-full bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,1)]"></div>
              )}
              <item.icon
                className={cn(
                  "mr-3 h-5 w-5 transition-transform duration-300",
                  isActive
                    ? "text-blue-400 scale-110"
                    : "text-slate-500 group-hover:text-slate-400 group-hover:scale-110",
                )}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer System Menu */}
      <div className="w-full space-y-1.5 px-4 mt-8">
        <Link
          href="/configuracoes"
          className={cn(
            "flex items-center px-4 py-3 rounded-xl text-sm transition-all duration-300 group relative",
            pathname === "/configuracoes"
              ? "bg-blue-600/20 text-white font-bold border border-blue-500/30"
              : "text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent",
          )}
        >
          <Settings 
             className={cn(
               "mr-3 h-5 w-5 transition-transform duration-300",
               pathname === "/configuracoes" ? "text-blue-400 scale-110" : "text-slate-500 group-hover:text-slate-400 group-hover:scale-110"
             )} 
          />
          Configurações
        </Link>
        <Link
          href="/suporte"
          className={cn(
            "flex items-center px-4 py-3 rounded-xl text-sm transition-all duration-300 group relative",
            pathname === "/suporte"
              ? "bg-blue-600/20 text-white font-bold border border-blue-500/30"
              : "text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent",
          )}
        >
          <HelpCircle className={cn(
            "mr-3 h-5 w-5 transition-transform duration-300",
            pathname === "/suporte" ? "text-blue-400 scale-110" : "text-slate-500 group-hover:text-slate-400 group-hover:scale-110"
          )} />
          Suporte
        </Link>
      </div>

      {/* User Profile */}
      <div className="px-6 mt-6 pt-6 border-t border-white/5">
        <div className="bg-white/5 rounded-2xl p-3 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-black shadow-inner flex-shrink-0">
            GF
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">Gestor</p>
            <p className="text-[10px] text-blue-300/80 uppercase font-bold tracking-wider truncate">Admin</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
