// Regras da tela do admin do transporte (T27) — puras, usadas na tela
// (validação imediata e diff) e no servidor (validação definitiva).
import { CHAVES_TRANSPORTE } from "@/lib/retencoes-transporte";

export type ChaveTransporte = (typeof CHAVES_TRANSPORTE)[number];

export const ROTULOS_PARAMETROS: Record<ChaveTransporte, { rotulo: string; percentual: boolean }> = {
  base_percentual: { rotulo: "Base do INSS (% do bruto)", percentual: true },
  inss_percentual: { rotulo: "INSS (% da base)", percentual: true },
  patronal_percentual: { rotulo: "Patronal (% da base, informativa)", percentual: true },
  sest_percentual: { rotulo: "SEST (% da base)", percentual: true },
  senat_percentual: { rotulo: "SENAT (% da base)", percentual: true },
  irrf_tributavel_percentual: { rotulo: "Base tributável do IRRF (% do bruto)", percentual: true },
  desconto_simplificado: { rotulo: "Desconto simplificado (R$)", percentual: false },
  redutor_constante: { rotulo: "Redutor — constante (R$)", percentual: false },
  redutor_coeficiente: { rotulo: "Redutor — coeficiente (× bruto)", percentual: false },
};

export interface FaixaEdicao {
  limiteAte: number | string | null; // null/'' = última faixa
  aliquota: number | string;
  parcelaDeduzir: number | string;
}

export interface MunicipioEdicao {
  nome: string;
  uf: string;
  aliquota: number | string;
  taxaExpediente: number | string;
  apelidos: string | null;
  ativo: boolean;
}

/** "15,5" | "15.5" | "2.428,80" | 15.5 -> número; vazio/ inválido -> NaN. */
export function numero(v: unknown): number {
  if (v === null || v === undefined || String(v).trim() === "") return NaN;
  const s = String(v).trim();
  // Com vírgula é formato BR: pontos são separador de milhar.
  return Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
}

const vazio = (v: unknown) => v === null || v === undefined || String(v).trim() === "";
const fmt = (v: unknown) => (vazio(v) ? "—" : String(numero(v)).replace(".", ","));

export const vigenciaEditavel = (vigenteDe: string, hoje: string) => vigenteDe >= hoje;

export function validarParametrosTransporte(p: Partial<Record<string, unknown>>): string[] {
  const erros: string[] = [];
  for (const chave of CHAVES_TRANSPORTE) {
    const { rotulo, percentual } = ROTULOS_PARAMETROS[chave];
    const v = numero(p[chave]);
    if (!Number.isFinite(v)) erros.push(`${rotulo}: informe um número.`);
    else if (v < 0) erros.push(`${rotulo}: não pode ser negativo.`);
    else if (percentual && v > 100) erros.push(`${rotulo}: não pode passar de 100%.`);
  }
  return erros;
}

export function validarFaixasIrrf(faixas: FaixaEdicao[]): string[] {
  const erros: string[] = [];
  if (faixas.length === 0) return ["Informe ao menos uma faixa."];
  let limiteAnterior = -Infinity;
  faixas.forEach((f, i) => {
    const n = i + 1;
    const ultima = i === faixas.length - 1;
    if (vazio(f.limiteAte)) {
      if (!ultima) erros.push(`Faixa ${n}: só a última faixa pode ficar sem limite.`);
    } else {
      const limite = numero(f.limiteAte);
      if (!Number.isFinite(limite) || limite <= 0) erros.push(`Faixa ${n}: limite inválido.`);
      else if (limite <= limiteAnterior) erros.push(`Faixa ${n}: o limite deve ser maior que o da faixa ${n - 1}.`);
      else limiteAnterior = limite;
      if (ultima) erros.push(`Faixa ${n}: a última faixa deve ficar sem limite ("acima de").`);
    }
    const aliquota = numero(f.aliquota);
    if (!Number.isFinite(aliquota) || aliquota < 0 || aliquota > 100) erros.push(`Faixa ${n}: alíquota deve estar entre 0 e 100.`);
    const parcela = numero(f.parcelaDeduzir);
    if (!Number.isFinite(parcela) || parcela < 0) erros.push(`Faixa ${n}: parcela a deduzir inválida.`);
  });
  return erros;
}

export function validarMunicipio(m: Partial<MunicipioEdicao>): string[] {
  const erros: string[] = [];
  if (!m.nome || !m.nome.trim()) erros.push("Informe o nome do município.");
  if (!/^[A-Za-z]{2}$/.test(String(m.uf ?? "").trim())) erros.push("UF deve ter 2 letras.");
  const aliquota = numero(m.aliquota);
  if (!Number.isFinite(aliquota) || aliquota < 0 || aliquota > 100) erros.push("Alíquota do ISS deve estar entre 0 e 100.");
  const taxa = numero(m.taxaExpediente);
  if (!Number.isFinite(taxa) || taxa < 0) erros.push("Taxa de expediente inválida.");
  return erros;
}

// ---------------------------------------------------------------------------
// Diffs para a confirmação antes de salvar
// ---------------------------------------------------------------------------
export function diffParametros(antes: Partial<Record<string, unknown>>, depois: Partial<Record<string, unknown>>): string[] {
  return CHAVES_TRANSPORTE.filter((c) => numero(antes[c]) !== numero(depois[c])).map(
    (c) => `${ROTULOS_PARAMETROS[c].rotulo}: ${fmt(antes[c])} → ${fmt(depois[c])}`
  );
}

export function diffFaixas(antes: FaixaEdicao[], depois: FaixaEdicao[]): string[] {
  const linhas: string[] = [];
  const total = Math.max(antes.length, depois.length);
  for (let i = 0; i < total; i++) {
    const a = antes[i];
    const d = depois[i];
    const n = i + 1;
    if (!a) {
      linhas.push(`Faixa ${n} incluída: até ${fmt(d!.limiteAte)} · ${fmt(d!.aliquota)}% · deduz ${fmt(d!.parcelaDeduzir)}`);
      continue;
    }
    if (!d) {
      linhas.push(`Faixa ${n} removida`);
      continue;
    }
    if (numero(a.limiteAte) !== numero(d.limiteAte) && !(vazio(a.limiteAte) && vazio(d.limiteAte))) {
      linhas.push(`Faixa ${n}: limite ${fmt(a.limiteAte)} → ${fmt(d.limiteAte)}`);
    }
    if (numero(a.aliquota) !== numero(d.aliquota)) linhas.push(`Faixa ${n}: ${fmt(a.aliquota)}% → ${fmt(d.aliquota)}%`);
    if (numero(a.parcelaDeduzir) !== numero(d.parcelaDeduzir)) {
      linhas.push(`Faixa ${n}: parcela a deduzir ${fmt(a.parcelaDeduzir)} → ${fmt(d.parcelaDeduzir)}`);
    }
  }
  return linhas;
}

export function diffMunicipio(antes: MunicipioEdicao | null, depois: MunicipioEdicao): string[] {
  if (!antes) {
    return [`Novo município: ${depois.nome}/${depois.uf.toUpperCase()} · ISS ${fmt(depois.aliquota)}% · expediente ${fmt(depois.taxaExpediente)}`];
  }
  const linhas: string[] = [];
  const nome = antes.nome;
  if (numero(antes.aliquota) !== numero(depois.aliquota)) linhas.push(`${nome}: ISS ${fmt(antes.aliquota)}% → ${fmt(depois.aliquota)}%`);
  if (numero(antes.taxaExpediente) !== numero(depois.taxaExpediente)) {
    linhas.push(`${nome}: taxa de expediente ${fmt(antes.taxaExpediente)} → ${fmt(depois.taxaExpediente)}`);
  }
  if ((antes.apelidos || "") !== (depois.apelidos || "")) linhas.push(`${nome}: apelidos "${antes.apelidos || ""}" → "${depois.apelidos || ""}"`);
  if (antes.uf.toUpperCase() !== depois.uf.toUpperCase()) linhas.push(`${nome}: UF ${antes.uf} → ${depois.uf.toUpperCase()}`);
  if (antes.ativo !== depois.ativo) linhas.push(`${nome}: ${depois.ativo ? "reativado" : "desativado"}`);
  return linhas;
}
