// Modo apresentação das Análises (B6): regras puras de navegação, escala do
// palco e as frases do slide de abertura.
import { curto, pct1 } from '../formato';
import type { RespostaAnalises } from '../tela/tipos';

export const TOTAL_SLIDES = 3;
export const LARGURA_PALCO = 1280;
export const ALTURA_PALCO = 720;

export type AcaoSlide = 'proximo' | 'anterior' | 'primeiro' | 'ultimo';
export type Acao = AcaoSlide | 'sair' | 'tela-cheia';

/** null = a tecla não é da apresentação (passa adiante). */
export function acaoDaTecla(tecla: string): Acao | null {
  switch (tecla) {
    case 'ArrowRight':
    case 'PageDown':
    case ' ':
      return 'proximo';
    case 'ArrowLeft':
    case 'PageUp':
      return 'anterior';
    case 'Home':
      return 'primeiro';
    case 'End':
      return 'ultimo';
    case 'Escape':
      return 'sair';
    case 'f':
    case 'F':
      return 'tela-cheia';
    default:
      return null;
  }
}

/** Sem dar a volta: no último, avançar fica no último (ninguém pula para o começo em reunião). */
export function proximoSlide(atual: number, acao: AcaoSlide, total = TOTAL_SLIDES): number {
  if (acao === 'primeiro') return 1;
  if (acao === 'ultimo') return total;
  if (acao === 'proximo') return Math.min(total, atual + 1);
  return Math.max(1, atual - 1);
}

/** Escala do palco 1280×720 para caber na janela, com 2% de folga; nunca maior que 2. */
export function escalaDoPalco(largura: number, altura: number): number {
  if (!(largura > 0) || !(altura > 0)) return 1;
  const e = Math.min(largura / LARGURA_PALCO, altura / ALTURA_PALCO) * 0.98;
  return Math.round(Math.min(2, e) * 1000) / 1000;
}

/** '#2' → 2; fora de 1..total ou inválido → 1. */
export function slideDoHash(hash: string, total = TOTAL_SLIDES): number {
  const n = Number(String(hash ?? '').replace(/^#/, ''));
  return Number.isInteger(n) && n >= 1 && n <= total ? n : 1;
}

/** O slide 1 em duas frases, montadas dos números (sem IA). */
export function frasesDeAbertura(r: RespostaAnalises): { principal: string; apoio: string } {
  if (r.vazio || r.qtdOps === 0) {
    return { principal: r.resumo.map((t) => t.t).join(''), apoio: '' };
  }
  const k = r.kpis;
  const comp = r.periodo.rotuloComparacao;
  const credores = `${r.qtdCredores} ${r.qtdCredores === 1 ? 'credor' : 'credores'}`;
  const variacao =
    k.varPago === null
      ? `sem base de comparação com ${comp}`
      : k.varPago === 0
        ? `o mesmo que em ${comp}`
        : `${pct1(Math.abs(k.varPago))} ${k.varPago > 0 ? 'a mais' : 'a menos'} que em ${comp}`;
  const principal = `${curto(k.pago)} pagos a ${credores}, ${variacao}`;
  const apoio = r.ponte.empenhado > 0 ? `${r.pctPagoDoEmpenhado}% das NEs do período já foi pago. Restam ${curto(k.saldo)} a pagar.` : '';
  return { principal, apoio };
}
