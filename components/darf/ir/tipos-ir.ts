// Só tipos do servidor (apagados na compilação: nada do banco vem para a tela).
import type { PessoaFisicaIr, TotaisIr } from "@/lib/ir-pessoas-fisicas";
import type { OpDaPessoaIr, RelatorioIr } from "@/lib/services/ir-pessoas-fisicas.service";

export type { PessoaFisicaIr, TotaisIr, OpDaPessoaIr };

/** Resposta de GET /api/darf/pessoas-fisicas. */
export type RelatorioIrResposta = RelatorioIr;

export const URL_IR = "/api/darf/pessoas-fisicas";

/** Sem ano: o servidor escolhe o mais recente com movimento. */
export function montarUrlIr(ano: number | null): string {
  return ano === null ? URL_IR : `${URL_IR}?ano=${ano}`;
}

export const montarUrlDetalheIr = (ano: number, cpf: string) => `${URL_IR}/${encodeURIComponent(cpf)}?ano=${ano}`;
