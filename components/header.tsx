'use client';
import { Search, LogOut, Bell, LayoutDashboard, Users, FileText, Banknote, FileStack, Shield } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Header() {
  const pathname = usePathname();

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.currentTarget.value.trim() !== '') {
      toast.success(`Buscando por "${e.currentTarget.value}"...`);
      e.currentTarget.value = '';
    }
  };

  const navLinks = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/credores', label: 'Credores', icon: Users },
    { href: '/notas-empenho', label: 'Notas de Empenho', icon: FileText },
    { href: '/ordem-pagamento', label: 'Ordem de Pagamento', icon: Banknote },
    { href: '/consulta-impressao', label: 'Relatórios', icon: FileStack },
  ];

  return (
    <header className="h-[76px] bg-white/70 backdrop-blur-xl border-b border-white/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex items-center justify-between px-8 shrink-0 z-40 w-full relative">
      
      {/* Left: Logo */}
      <Link href="/" className="flex items-center gap-3 mr-12 group">
        <div className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-300">
          <img src="/brasao_pernambuco.png" alt="Brasão de Pernambuco" className="w-full h-full object-contain" />
        </div>
        <span className="font-bold text-lg text-slate-800 tracking-tight">EMPENHO GRE</span>
      </Link>

      {/* Center: Navigation Links */}
      <nav className="flex-1 flex items-center gap-1 hidden lg:flex">
        {navLinks.map((link) => {
          const isActive = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href));
          
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`relative px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 flex items-center gap-2 group ${
                isActive 
                  ? 'text-blue-700 bg-blue-50/80' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <link.icon className={`w-4 h-4 transition-colors ${isActive ? 'text-blue-900' : 'text-slate-400 group-hover:text-slate-600'}`} />
              {link.label}
              
              {/* Active Indicator Pill */}
              {isActive && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-1 bg-blue-900 rounded-t-full shadow-[0_-2px_8px_rgba(37,99,235,0.5)]"></div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Right: Actions & User */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden md:flex items-center group w-64">
          <Search className="absolute left-3.5 text-slate-400 h-4 w-4 group-focus-within:text-blue-500 transition-colors duration-300" />
          <input 
            type="text" 
            placeholder="Buscar..." 
            onKeyDown={handleSearch}
            className="w-full pl-10 pr-4 py-2 bg-slate-50/50 backdrop-blur-sm border border-slate-200 rounded-full text-sm font-medium focus:outline-none focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition-all duration-300 placeholder:text-slate-400"
          />
        </div>

        {/* Notifications */}
        <button className="relative p-2.5 rounded-full bg-slate-50/50 border border-slate-200 text-slate-500 hover:text-blue-900 hover:bg-white transition-all duration-300 shadow-sm ml-2">
          <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full ring-2 ring-white"></div>
          <Bell className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-slate-200 mx-1"></div>

        {/* User */}
        <Link href="/perfil" className="flex items-center gap-3 p-1 rounded-full bg-slate-50 border border-slate-200 shadow-sm hover:bg-white transition-all duration-300 cursor-pointer group">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center text-white text-xs font-bold shadow-md shadow-blue-500/20">
            GF
          </div>
        </Link>
        
        {/* Logout */}
        <Link 
          href="/login" 
          onClick={() => toast.info('Saindo do sistema...')} 
          className="text-slate-400 hover:text-red-500 transition-colors duration-300 p-2 rounded-full hover:bg-red-50"
          title="Sair do Sistema"
        >
          <LogOut className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}
