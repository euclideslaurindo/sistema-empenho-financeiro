'use client';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { OfflineIndicator } from '@/components/offline-indicator';

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => {
          console.error('Falha ao registrar o Service Worker:', err);
        });
      });
    }
  }, []);

  if (isLoginPage) {
    return (
      <main className="flex-1 w-full h-full">
        <OfflineIndicator />
        {children}
      </main>
    );
  }

  return (
    <>
      <div className="print:hidden">
        <OfflineIndicator />
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col h-screen overflow-hidden print:h-auto print:overflow-visible">
        <div className="print:hidden">
          <Header />
        </div>
        <main className="flex-1 overflow-y-auto w-full bg-[#f4f6f8] print:overflow-visible print:bg-white">
           {children}
        </main>
      </div>
    </>
  );
}
