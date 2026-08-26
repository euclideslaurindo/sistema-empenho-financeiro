'use client';
import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Only set inline after mount
    const handleOnline = () => {
      setIsOffline(false);
      toast.success('Conexão restabelecida. Sincronizando dados...');
    };

    const handleOffline = () => {
      setIsOffline(true);
      toast.warning('Você está offline. As alterações serão guardadas e sincronizadas depois.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Fallback sync initial state, without triggering immediate re-render warning
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setTimeout(() => setIsOffline(true), 0);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed bottom-6 right-6 bg-slate-800 border border-zinc-700 text-white p-4 rounded-xl shadow-2xl flex items-start text-sm z-50 animate-in slide-in-from-bottom-5 max-w-sm">
      <div className="bg-indigo-500/20 p-2 rounded-lg mr-4 border border-indigo-500/50">
        <WifiOff className="w-5 h-5 text-indigo-500 shrink-0 relative" />
      </div>
      <div className="flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold text-base tracking-tight">Modo Offline Ativo</span>
          <RefreshCw className="w-3.5 h-3.5 text-zinc-400 animate-spin" />
        </div>
        <p className="text-zinc-300 text-xs leading-relaxed">
          Sem conexão à internet. O sistema continuará funcionando normalmente através do cache. Suas ações serão sincronizadas automaticamente quando reconectar.
        </p>
      </div>
    </div>
  );
}
