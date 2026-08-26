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
    <aside className="enterprise-sidebar w-64 h-screen flex flex-col py-6 shrink-0 overflow-y-auto relative z-20">
      {/* Logo */}
      <div className="flex flex-col items-center mb-8 w-full px-4">
        <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-3 shadow-sm">
          <Landmark className="text-white w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold font-display text-white text-center leading-tight">
          Gestão de<br />Empenho
        </h1>
        <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">
          Painel Financeiro
        </p>
      </div>

      <div className="w-full mb-6 px-4">
        <button
          onClick={() => handleAction("Novo Empenho")}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-md transition-colors flex items-center justify-center shadow-sm text-sm"
        >
          <Plus className="w-4 h-4 mr-2" /> Novo Empenho
        </button>
      </div>

      <nav className="w-full flex-1 flex flex-col space-y-1 px-3">
        {navItems.map((item) => {
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
                "flex items-center px-3 py-2.5 rounded-md text-sm transition-colors group",
                isActive
                  ? "bg-[#1e293b] text-white font-semibold"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200",
              )}
            >
              <item.icon
                className={cn(
                  "mr-3 h-4 w-4",
                  isActive
                    ? "text-blue-400"
                    : "text-slate-500 group-hover:text-slate-400",
                )}
              />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="w-full mt-auto space-y-1 pt-4 border-t border-slate-800 px-3">
        <Link
          href="/configuracoes"
          className={cn(
            "flex items-center px-3 py-2.5 rounded-md text-sm transition-colors group",
            pathname === "/configuracoes"
              ? "bg-[#1e293b] text-white font-semibold"
              : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200",
          )}
        >
          <Settings 
             className={cn(
               "mr-3 h-4 w-4",
               pathname === "/configuracoes" ? "text-blue-400" : "text-slate-500 group-hover:text-slate-400"
             )} 
          />
          Configurações
        </Link>
        <button
          onClick={() => handleAction("Suporte")}
          className="w-full flex items-center px-3 py-2.5 rounded-md text-sm text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 transition-colors group"
        >
          <HelpCircle className="mr-3 h-4 w-4 text-slate-500 group-hover:text-slate-400" />
          Suporte
        </button>
      </div>
    </aside>
  );
}
