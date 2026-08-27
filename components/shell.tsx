'use client';
import { Header } from '@/components/header';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { OfflineIndicator } from '@/components/offline-indicator';

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
          registration.unregister();
        }
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
    <div className="flex flex-col w-full min-h-screen relative z-10 overflow-x-hidden" style={{ backgroundColor: '#E2E8F0' }}>
      {/* Noise Texture Background */}
      <div className="fixed inset-0 z-0 opacity-20 pointer-events-none mix-blend-multiply" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>

      {/* Offline Indicator floating at the top */}
      <OfflineIndicator />
      
      {/* Top Navigation Bar */}
      <div className="print:hidden z-30 sticky top-0 w-full">
        <Header />
      </div>

      {/* The Main Stage */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto flex flex-col relative z-20 print:bg-white print:rounded-none print:shadow-none print:border-none">
        {/* Scrollable Content Area */}
        <div className="flex-1 w-full relative custom-scrollbar print:overflow-visible">
           <div key={pathname} className="animate-fade-in min-h-full w-full relative z-10 pb-12 pt-6">
             {children}
           </div>
        </div>
      </main>
    </div>
  );
}
