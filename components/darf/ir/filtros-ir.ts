// Filtros da visão "Pessoas físicas (IR)": rodam na tela, sobre o relatório
// que já vem inteiro do servidor (sem paginação).
import type { PessoaFisicaIr } from "./tipos-ir";

export type SituacaoIr = "todas" | "pendentes" | "informadas";

/** "Álvaro  SOUZA" → "alvaro souza" (sem acento, minúsculas, espaços únicos). */
export function normalizarBusca(v: string): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Termo só com dígitos e pontuação de CPF ("123.456", "12345678909") compara
 * com o CPF; com letras, com o nome. Assim "2026" não acha ninguém pelo nome.
 */
export function filtrarPessoas(
  pessoas: PessoaFisicaIr[],
  f: { busca: string; situacao: SituacaoIr }
): PessoaFisicaIr[] {
  const termo = normalizarBusca(f.busca);
  const porCpf = termo !== "" && /^[\d.\-\s/]+$/.test(termo);
  const digitos = termo.replace(/\D/g, "");

  return pessoas.filter((p) => {
    if (f.situacao === "pendentes" && p.informado) return false;
    if (f.situacao === "informadas" && !p.informado) return false;
    if (!termo) return true;
    if (porCpf) return digitos !== "" && p.cpf.includes(digitos);
    return normalizarBusca(p.nome).includes(termo);
  });
}

/** Anos do servidor + o ano exibido, sem repetir, do mais recente para o mais antigo. */
export function anosDoSeletor(anos: number[], ano: number): number[] {
  return [...new Set([...(anos || []), ano])].sort((a, b) => b - a);
}
