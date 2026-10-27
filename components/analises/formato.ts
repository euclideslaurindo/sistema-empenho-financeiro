// Formatos de número da aba Análises (os valores chegam da API em reais).
import { formatarBRL, toCents } from '@/lib/money';
import { valorCurto } from '@/lib/analises';

/** 306181.03 → "R$ 306.181,03" (sinal na frente quando negativo). */
export const brl = (reais: number) => `${reais < 0 ? '−' : ''}R$ ${formatarBRL(Math.abs(toCents(reais)))}`;

/** 306181.03 → "R$ 306 mil"; 1362033.68 → "R$ 1,36 mi"; negativo com "−". */
export const curto = (reais: number) => {
  const c = toCents(reais);
  return c < 0 ? `−${valorCurto(-c)}` : valorCurto(c);
};

/** 8.5 → "8,5%". */
export const pct1 = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
