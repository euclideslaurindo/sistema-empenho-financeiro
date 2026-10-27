// Fonte dos títulos da aba Análises (visual aprovado na B1). Só a página da
// aba importa este arquivo: o resto do sistema continua no Inter.
import { Source_Serif_4 } from 'next/font/google';

export const fonteTitulos = Source_Serif_4({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-titulo-analises',
  display: 'swap',
});
