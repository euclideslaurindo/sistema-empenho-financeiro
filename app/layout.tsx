import type { Metadata } from 'next';
import './globals.css';
import { Inter, Space_Grotesk } from 'next/font/google';
import { Toaster } from 'sonner';
import { Shell } from '@/components/shell';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const space = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' });

export const metadata: Metadata = {
  title: 'Sistema de Empenho',
  description: 'Gestão de Pagamentos - Estado de Pernambuco',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${space.variable}`}>
      <body className="flex h-screen w-full bg-slate-100 text-slate-800 overflow-hidden antialiased font-sans" suppressHydrationWarning>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none z-[-1]"></div>
        <Shell>
          {children}
        </Shell>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
