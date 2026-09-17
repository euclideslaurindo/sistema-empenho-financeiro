'use client';
import { Header } from '@/components/header';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { OfflineIndicator } from '@/components/offline-indicator';
import { useAppStore } from '@/lib/store';

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  const setUserProfile = useAppStore((state) => state.setUserProfile);

  useEffect(() => {
    if (!isLoginPage) {
      fetch('/api/perfil')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.usuario) {
            setUserProfile(data.usuario);
          }
        })
        .catch(err => console.error('Erro ao carregar perfil:', err));
    }
  }, [isLoginPage, setUserProfile]);

  if (isLoginPage) {
    return (
      <main className="flex-1 w-full h-full">
        <OfflineIndicator />
        {children}
      </main>
    );
  }

  return (
    <div className="flex flex-col w-full min-h-screen relative z-10 overflow-x-hidden bg-[#E2E8F0] print:block print:min-h-auto print:overflow-visible print:bg-white">
      {/* Subtle noise-like texture via CSS — sem GPU overdraw */}
      <div className="print:hidden fixed inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #64748b 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>

      {/* Offline Indicator floating at the top */}
      <OfflineIndicator />
      
      {/* Top Navigation Bar */}
      <div className="print:hidden z-30 sticky top-0 w-full">
        <Header />
      </div>

      {/* The Main Stage */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto flex flex-col relative z-20 print:block print:max-w-none print:m-0 print:p-0 print:bg-white print:shadow-none print:border-none">
        {/* Scrollable Content Area */}
        <div className="flex-1 w-full relative custom-scrollbar print:block print:overflow-visible print:m-0 print:p-0">
           <div key={pathname} className="animate-fade-in min-h-full w-full relative z-10 pb-12 pt-6 print:block print:m-0 print:p-0">
             {children}
           </div>
        </div>
      </main>
    </div>
  );
}
