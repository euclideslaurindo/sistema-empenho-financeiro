// Pessoas físicas no IR (A2): regras puras do relatório anual por CPF.
// Sem banco e sem React: o service monta as linhas, aqui viram pessoas,
// totais e a planilha CSV. Dinheiro sempre passa por centavos inteiros.
import { fromCents, toCents, type Centavos } from '@/lib/money';
import { extrairCodigoElemento } from '@/lib/elementos';
import { somenteDigitos } from '@/lib/ne-credores';
import { formatCpfCnpj } from '@/lib/utils';

export const ANO_MIN = 2000;
export const ANO_MAX = 2100;

export interface NaturezaRendimento {
  codigo: string | null;
  descricao: string;
}

export interface InformeIr {
  /** 'AAAA-MM-DD HH:MM' */
  em: string | null;
  porNome: string | null;
  observacao: string | null;
}

export interface PessoaFisicaIr {
  cpf: string;
  cpfFormatado: string;
  nome: string;
  qtdOps: number;
  bruto: number;
  irrf: number;
  inss: number;
  iss: number;
  liquido: number;
  naturezas: NaturezaRendimento[];
  informado: InformeIr | null;
}

export interface TotaisIr {
  pessoas: number;
  informadas: number;
  pendentes: number;
  qtdOps: number;
  bruto: number;
  irrf: number;
  inss: number;
  iss: number;
  liquido: number;
}

/** Linha da consulta do relatório, como o mysql2 devolve (DECIMAL em texto). */
export interface LinhaIr {
  cpf: string;
  nomeCadastro: string | null;
  nomeOp: string | null;
  qtdOps: number | string;
  bruto: number | string | null;
  irrf: number | string | null;
  inss: number | string | null;
  iss: number | string | null;
  liquido: number | string | null;
  elementos: string | null;
}

/** "2026" → 2026; vazio, texto ou fora de 2000–2100 → null. */
export function lerAno(v: unknown): number | null {
  const s = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : '';
  if (!/^\d{4}$/.test(s)) return null;
  const ano = Number(s);
  return ano >= ANO_MIN && ano <= ANO_MAX ? ano : null;
}

/** Só os dígitos; null se não forem exatamente 11 (CNPJ fica de fora). */
export function cpfDoTexto(v: unknown): string | null {
  const d = somenteDigitos(v);
  return d.length === 11 ? d : null;
}

/** "12345678909" → "123.456.789-09". */
export function cpfFormatado(cpf: string): string {
  return formatCpfCnpj(cpf);
}

/** Valor do banco (DECIMAL em texto ou número) → reais com 2 casas exatas. */
const reais = (v: unknown) => fromCents(toCents(v as string | number | null | undefined));

/**
 * "3.3.90.36 - Outros serviços PF||3.3.90.33 - Transporte" → naturezas sem
 * repetir, ordenadas por código (texto sem código vai por último).
 */
export function naturezasDosElementos(texto: string | null | undefined): NaturezaRendimento[] {
  const vistos = new Map<string, NaturezaRendimento>();
  for (const parte of String(texto ?? '').split('||')) {
    const t = parte.trim();
    if (!t) continue;
    const codigo = extrairCodigoElemento(t);
    const descricao = codigo ? t.slice(t.indexOf(codigo) + codigo.length).replace(/^\s*-\s*/, '').trim() : t;
    const chave = codigo ?? `#${t}`;
    if (!vistos.has(chave)) vistos.set(chave, { codigo, descricao });
  }
  return [...vistos.values()].sort((a, b) => {
    if (a.codigo === null || b.codigo === null) return a.codigo === null ? (b.codigo === null ? 0 : 1) : -1;
    return a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true });
  });
}

/** Linha do banco → pessoa do relatório. O nome do cadastro tem preferência sobre o da OP. */
export function pessoaDaLinha(linha: LinhaIr, informe: InformeIr | null): PessoaFisicaIr {
  const cpf = somenteDigitos(linha.cpf);
  return {
    cpf,
    cpfFormatado: cpfFormatado(cpf),
    nome: String(linha.nomeCadastro || linha.nomeOp || '').trim(),
    qtdOps: Number(linha.qtdOps) || 0,
    bruto: reais(linha.bruto),
    irrf: reais(linha.irrf),
    inss: reais(linha.inss),
    iss: reais(linha.iss),
    liquido: reais(linha.liquido),
    naturezas: naturezasDosElementos(linha.elementos),
    informado: informe,
  };
}

/** Ordem do relatório: nome com acento (pt-BR), depois CPF. */
export function ordenarPessoas(pessoas: PessoaFisicaIr[]): PessoaFisicaIr[] {
  return [...pessoas].sort(
    (a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }) || a.cpf.localeCompare(b.cpf)
  );
}

const CAMPOS_VALOR = ['bruto', 'irrf', 'inss', 'iss', 'liquido'] as const;
type CampoValor = (typeof CAMPOS_VALOR)[number];

function somarEmCentavos(pessoas: PessoaFisicaIr[]): Record<CampoValor, Centavos> {
  const soma = { bruto: 0, irrf: 0, inss: 0, iss: 0, liquido: 0 };
  for (const p of pessoas) for (const c of CAMPOS_VALOR) soma[c] += toCents(p[c]);
  return soma;
}

/** Totais do ano somados em centavos (0,10 + 0,20 = 0,30 exato). */
export function totaisDoAno(pessoas: PessoaFisicaIr[]): TotaisIr {
  const soma = somarEmCentavos(pessoas);
  const informadas = pessoas.filter((p) => p.informado).length;
  return {
    pessoas: pessoas.length,
    informadas,
    pendentes: pessoas.length - informadas,
    qtdOps: pessoas.reduce((t, p) => t + p.qtdOps, 0),
    bruto: fromCents(soma.bruto),
    irrf: fromCents(soma.irrf),
    inss: fromCents(soma.inss),
    iss: fromCents(soma.iss),
    liquido: fromCents(soma.liquido),
  };
}

// ---------------------------------------------------------------------------
// CSV para o Excel em português
// ---------------------------------------------------------------------------

const BOM = '\uFEFF';
const SEP = ';';
const FIM_LINHA = '\r\n';

/** Centavos → "1234,50" (vírgula decimal, sem ponto de milhar). */
function valorCsv(c: Centavos): string {
  const abs = Math.abs(c);
  return `${c < 0 ? '-' : ''}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

/** Campo de texto: neutraliza fórmula (= + - @ tab CR no início) e protege ; " e quebras. */
function textoCsv(v: unknown): string {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** "2026-10-26 14:30" → "26/10/2026 14:30". */
function dataCsv(em: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(.*)$/.exec(String(em ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}${m[4]}` : '';
}

export const CABECALHO_CSV_IR = [
  'Ano',
  'CPF',
  'Nome',
  'Natureza do rendimento',
  'Qtd. OPs',
  'Rendimento bruto (R$)',
  'IRRF retido (R$)',
  'INSS retido (R$)',
  'ISS retido (R$)',
  'Líquido pago (R$)',
  'Informado',
  'Informado em',
  'Observação',
];

export function nomeArquivoCsvIr(ano: number): string {
  return `pessoas-fisicas-ir-${ano}.csv`;
}

/** Planilha do ano: BOM, ";", decimal com vírgula, CRLF e a linha de TOTAL no fim. */
export function montarCsvIr(ano: number, pessoas: PessoaFisicaIr[]): string {
  const linhas = [CABECALHO_CSV_IR.map(textoCsv).join(SEP)];
  for (const p of pessoas) {
    const natureza = p.naturezas.map((n) => (n.codigo ? `${n.codigo} - ${n.descricao}` : n.descricao)).join(' / ');
    linhas.push(
      [
        String(ano),
        textoCsv(p.cpfFormatado),
        textoCsv(p.nome),
        textoCsv(natureza),
        String(p.qtdOps),
        ...CAMPOS_VALOR.map((c) => valorCsv(toCents(p[c]))),
        p.informado ? 'Sim' : 'Não',
        textoCsv(dataCsv(p.informado?.em ?? null)),
        textoCsv(p.informado?.observacao ?? ''),
      ].join(SEP)
    );
  }
  const soma = somarEmCentavos(pessoas);
  linhas.push(
    [
      String(ano),
      'TOTAL',
      textoCsv(`${pessoas.length} pessoa(s)`),
      '',
      String(pessoas.reduce((t, p) => t + p.qtdOps, 0)),
      ...CAMPOS_VALOR.map((c) => valorCsv(soma[c])),
      '',
      '',
      '',
    ].join(SEP)
  );
  return BOM + linhas.join(FIM_LINHA) + FIM_LINHA;
}
