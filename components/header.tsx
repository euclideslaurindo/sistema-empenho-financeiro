'use client';
import { Search, UserCircle, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export function Header() {
  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.currentTarget.value.trim() !== '') {
      toast.success(`Buscando por "${e.currentTarget.value}"...`);
      e.currentTarget.value = ''; // clear visual string
    }
  };

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-30 w-full sticky top-0">
      <div className="flex flex-1 items-center max-w-3xl">
         <h2 className="text-lg font-semibold text-slate-800 mr-8 tracking-tight">Portal do Gestor</h2>
         <div className="relative flex-1 max-w-md hidden md:flex items-center group">
            <Search className="absolute left-3 text-slate-400 h-4 w-4 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Buscar no sistema..." 
              onKeyDown={handleSearch}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors placeholder:text-slate-400"
            />
         </div>
      </div>
      <div className="flex items-center space-x-6">
         <Link href="/perfil" className="flex items-center text-slate-600 hover:text-blue-600 text-sm font-medium transition-colors group">
            <UserCircle className="h-5 w-5 text-slate-500 group-hover:text-blue-600 mr-2" />
            <span className="hidden md:inline">Gestor Financeiro</span>
         </Link>
         <div className="w-[1px] h-5 bg-slate-200"></div>
         <Link href="/login" onClick={() => toast.info('Saindo do sistema...')} className="text-slate-400 hover:text-red-600 transition-colors">
            <LogOut className="h-5 w-5" />
         </Link>
      </div>
    </header>
  );
}
