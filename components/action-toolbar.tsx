import { ReactNode, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

export function ActionToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 shrink-0 relative z-20 w-full mb-6">
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
            await new Promise(r => setTimeout(r, 500));
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
    currentColorClasses = 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm';
    IconToRender = CheckCircle2;
    iconColorClass = 'text-blue-600';
  } else if (status === 'loading') {
    currentColorClasses = primary 
        ? 'bg-blue-600 text-white opacity-80' 
        : warning
        ? 'bg-slate-100 text-slate-700 border border-slate-200 opacity-80'
        : 'bg-white text-slate-500 border border-slate-200 opacity-80';
    IconToRender = Loader2;
    iconColorClass = primary ? 'text-white' : 'text-slate-500';
  } else {
    currentColorClasses = primary 
        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/30' 
        : warning
        ? 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-sm'
        : 'bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-700 border border-slate-200/80 shadow-sm';
    iconColorClass = primary ? 'text-white' : 'text-slate-400';
  }

  return (
    <button 
      onClick={handleClick}
      disabled={status !== 'idle'}
      className={`flex items-center text-sm font-bold px-5 py-2.5 rounded-xl transition-all duration-300 disabled:pointer-events-none cursor-pointer ${currentColorClasses}`}>
      {IconToRender && <IconToRender className={`h-4 w-4 mr-2.5 ${status === 'loading' ? 'animate-spin' : ''} ${iconColorClass}`} />}
      {status === 'loading' ? 'Processando...' : status === 'success' ? 'Efetuado ✓' : label}
    </button>
  );
}
