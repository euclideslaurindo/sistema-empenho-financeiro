// Justificativa de sobra de recurso da NE (B13): textos do modelo enviado
// pela supervisão ("JUSTIFICATIVA DE NÃO UTILIZAÇÃO TOTAL DO RECURSO DA NE
// Nº") e a montagem da folha. Puro: a tela, o servidor e os testes usam.
import { formatarBRL, toCents } from "@/lib/money";
import { numeroPorExtenso } from "@/lib/utils";

export interface MotivoPadrao {
  codigo: string;
  texto: string;
}

/** Motivos do modelo (o usuário marca e pode editar o texto em cada documento). */
export const MOTIVOS_PADRAO: MotivoPadrao[] = [
  { codigo: "parcial", texto: "Execução parcial do recurso." },
  {
    codigo: "comprovacao",
    texto: "Falta de comprovação técnica, documental e financeira para execução total do referido recurso.",
  },
  {
    codigo: "prazo",
    texto:
      "Prazo de execução e prestação de contas acima dos 60 dias segundo Art. 12 do DECRETO Nº 20.416, DE 24 DE MARÇO DE 1998.",
  },
];

export const TEXTO_DEVOLUCAO_PADRAO =
  "Foi integralmente devolvido à conta do órgão concedente, conforme comprovante de PIX/TED, Recibos de Cópia de " +
  "Comprovante de pagamentos de boletos ou Autenticação Bancária através das GUIAS DE DEVOLUÇÃO (GR).";

export const MAX_TEXTO = 2000;

/** O que o formulário edita e o que fica salvo. Valores em reais. */
export interface DadosJustificativa {
  numeroNe: string;
  exercicio: string;
  objeto: string;
  valorSaldo: number;
  valorAtualizado: number;
  /** Só os marcados, na ordem do modelo (texto já editado). */
  motivos: MotivoPadrao[];
  outros: string;
  textoDevolucao: string;
}

/** Valores iniciais: os salvos, senão os da NE (objeto = Observação; atualizado = saldo). */
export function montarJustificativa(
  ne: { numero: string; exercicio?: string | null; historico?: string | null },
  saldoReais: number,
  salvo?: Partial<DadosJustificativa> | null
): DadosJustificativa {
  const exercicio = String(ne.exercicio ?? "").trim() || String(ne.numero).slice(0, 4);
  return {
    numeroNe: ne.numero,
    exercicio: salvo?.exercicio || exercicio,
    objeto: salvo?.objeto ?? String(ne.historico ?? "").trim(),
    valorSaldo: saldoReais,
    valorAtualizado: salvo?.valorAtualizado ?? saldoReais,
    motivos: salvo?.motivos ?? [],
    outros: salvo?.outros ?? "",
    textoDevolucao: salvo?.textoDevolucao || TEXTO_DEVOLUCAO_PADRAO,
  };
}

/** Erros de preenchimento (lista vazia = ok). */
export function validarJustificativa(d: Partial<DadosJustificativa>): string[] {
  const erros: string[] = [];
  const motivos = (d.motivos ?? []).filter((m) => String(m?.texto ?? "").trim());
  if (motivos.length === 0 && !String(d.outros ?? "").trim()) erros.push("Marque ao menos um motivo (ou preencha \"Outros fatores\").");
  if (!Number.isFinite(Number(d.valorAtualizado)) || Number(d.valorAtualizado) < 0) erros.push("Saldo atualizado inválido.");
  const textos = [d.objeto, d.outros, d.textoDevolucao, ...(d.motivos ?? []).map((m) => m?.texto)];
  if (textos.some((t) => String(t ?? "").length > MAX_TEXTO)) erros.push(`Cada texto pode ter no máximo ${MAX_TEXTO} caracteres.`);
  return erros;
}

const reais = (v: number) => `R$ ${formatarBRL(toCents(v))}`;

/** Valor por extenso a partir de reais (em centavos inteiros, sem ruído de float). */
export const valorPorExtenso = (v: number) => numeroPorExtenso(toCents(v) / 100);

/** O texto da folha, na ordem do modelo (só os motivos marcados). */
export function textosDaFolha(d: DadosJustificativa) {
  const ne = d.numeroNe;
  return {
    titulo: `JUSTIFICATIVA DE NÃO UTILIZAÇÃO TOTAL DO RECURSO DA NE Nº ${ne}`,
    subtitulo: "Justificativa de Saldo Remanescente / Sobra de Recurso",
    instrumento: `Instrumento de Origem: NOTA DE EMPENHO Nº ${ne}`,
    objeto: `Objeto do Recurso: ${d.objeto.trim() || "—"}`,
    abertura:
      "Por meio deste instrumento, apresentamos a justificativa técnica e financeira relativa à existência de saldo " +
      `remanescente (sobra de recurso) na NOTA DE EMPENHO Nº ${ne}, EXERCÍCIO ${d.exercicio}, no valor de ` +
      `${reais(d.valorSaldo)} (${valorPorExtenso(d.valorSaldo)}).`,
    introMotivos: "O referido saldo de recursos decorreu dos seguintes fatores:",
    motivos: [
      ...d.motivos.map((m) => m.texto.trim()).filter(Boolean),
      ...(d.outros.trim() ? [`Outros fatores: ${d.outros.trim()}`] : []),
    ],
    ressalva:
      "Ressaltamos que as condições e os objetivos propostos no Plano de Trabalho ou outros instrumentos foram " +
      "integralmente cumpridos e alcançados, conforme demonstrado na Prestação de contas da execução do referido recurso.",
    valorAtualizado: `Diante do exposto, informamos que o saldo remanescente atualizado NO VALOR DE ${reais(d.valorAtualizado)} (${valorPorExtenso(
      d.valorAtualizado
    )}):`,
    devolucao: d.textoDevolucao.trim(),
    encerramento: "Ficamos à disposição para quaisquer esclarecimentos.",
    assinatura: [
      "CGAF – Coordenação Geral de Administração e Finanças",
      "GRE/AM – Gerência Regional de Educação do Agreste Meridional",
    ],
  };
}
