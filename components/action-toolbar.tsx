import { ReactNode, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

export function ActionToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="h-14 bg-white/40 backdrop-blur-md border-b border-[#e2e8f0]/60 flex items-center px-6 w-full gap-4 shrink-0 shadow-[0_4px_20px_rgba(0,0,0,0.01)] relative z-20">
      {children}
    </div>
  );
}

export function ActionButton({ 
  icon: Icon, 
  label, 
  primary,
  warning,
  onClick
}: { 
  icon?: any;
  label: string;
  primary?: boolean;
  warning?: boolean;
  onClick?: () => void | Promise<void>;
}) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  const handleClick = async () => {
    if (status !== 'idle') return;
    
    setStatus('loading');
    
    try {
      if (onClick) {
         const result = onClick();
         if (result instanceof Promise) {
            await result;
         } else {
            await new Promise(r => setTimeout(r, 500)); // visual delay for sync actions
         }
      } else {
         await new Promise(r => setTimeout(r, 500)); 
      }
      setStatus('success');
    } catch (e) {
      setStatus('idle');
      return;
    }

    setTimeout(() => {
      setStatus('idle');
    }, 2000);
  };

  let currentColorClasses = '';
  let IconToRender = Icon;
  let iconColorClass = '';

  if (status === 'success') {
    currentColorClasses = 'bg-green-50 text-green-700 border border-green-200';
    IconToRender = CheckCircle2;
    iconColorClass = 'text-green-600';
  } else if (status === 'loading') {
    currentColorClasses = primary 
        ? 'bg-blue-600 text-white opacity-80' 
        : warning
        ? 'bg-red-50 text-red-700 border border-red-200 opacity-80'
        : 'bg-slate-50 text-slate-500 border border-slate-200 opacity-80';
    IconToRender = Loader2;
    iconColorClass = primary ? 'text-white' : warning ? 'text-red-600' : 'text-slate-500';
  } else {
    currentColorClasses = primary 
        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm border border-blue-700' 
        : warning
        ? 'bg-white text-red-600 hover:bg-red-50 border border-slate-200 shadow-sm'
        : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-sm';
    iconColorClass = primary ? 'text-white' : warning ? 'text-red-500' : 'text-slate-400';
  }

  return (
    <button 
      onClick={handleClick}
      disabled={status !== 'idle'}
      className={`flex items-center text-sm font-medium px-4 py-2 rounded-md transition-colors disabled:pointer-events-none ${currentColorClasses}`}>
      {IconToRender && <IconToRender className={`h-4 w-4 mr-2 ${status === 'loading' ? 'animate-spin' : ''} ${iconColorClass}`} />}
      {status === 'loading' ? 'Processando...' : status === 'success' ? 'Efetuado' : label}
    </button>
  );
}
