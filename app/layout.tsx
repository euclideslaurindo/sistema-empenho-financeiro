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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${space.variable}`}>
      <body className="flex h-screen w-full bg-slate-100 text-slate-800 overflow-hidden antialiased font-sans" suppressHydrationWarning>
        <Shell>
          {children}
        </Shell>
        <div className="print:hidden">
          <Toaster position="top-right" richColors />
        </div>
      </body>
    </html>
  );
}
