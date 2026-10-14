// Status da Nota de Empenho derivado do saldo (PR 0 da T31). Puro: quem
// chama soma o valor_pagamento das OPs da NE e passa em centavos.
//
// CANCELADO só é posto pelo cancelar() e nunca é desfeito por aqui.

export type StatusNe = 'EMITIDO' | 'PARCIALMENTE PAGO' | 'LIQUIDADO' | 'CANCELADO';

export function statusPeloSaldo(valorCents: number, gastoCents: number, statusAtual?: string | null): StatusNe {
  if (statusAtual === 'CANCELADO') return 'CANCELADO';
  if (gastoCents <= 0) return 'EMITIDO';
  if (gastoCents >= valorCents) return 'LIQUIDADO';
  return 'PARCIALMENTE PAGO';
}
