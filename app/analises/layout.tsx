import type { ReactNode } from 'react';
import { fonteTitulos } from '@/components/analises/fonte';

// A fonte dos títulos (Source Serif 4) vale só na aba Análises.
export default function AnalisesLayout({ children }: { children: ReactNode }) {
  return <div className={`${fonteTitulos.variable} h-full`}>{children}</div>;
}
