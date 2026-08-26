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
      <body className="flex h-screen bg-[#f4f6f8] text-[#1e293b] overflow-hidden antialiased font-sans" suppressHydrationWarning>
        <Shell>
          {children}
        </Shell>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
