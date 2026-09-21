import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formata um valor para moeda brasileira (BRL).
 * - Se receber um NUMBER, trata como reais (ex: 1500 → "1.500,00").
 * - Se receber uma STRING (do onChange de input), trata como centavos sendo digitados
 *   (ex: "150000" → "1.500,00"), seguindo o padrão de máscara BR.
 */
export function maskCurrency(value: string | number): string {
  let centavosStr: string;
  if (typeof value === 'number') {
    // Número em reais → converte para centavos inteiros sem usar ponto flutuante
    if (!isFinite(value) || isNaN(value)) return '';
    // Multiply by 100 and round to avoid IEEE 754 drift
    centavosStr = String(Math.round(value * 100));
  } else {
    // String digitada pelo usuário → remove tudo que não é dígito
    centavosStr = String(value).replace(/\D/g, '');
  }
  if (!centavosStr || centavosStr === '0') return '';
  // Operação em inteiros: não há ponto flutuante → sem imprecisão
  const centavos = parseInt(centavosStr, 10);
  if (isNaN(centavos)) return '';
  const reais = Math.floor(centavos / 100);
  const cents = centavos % 100;
  const reaisStr = reais.toLocaleString('pt-BR');
  const centsStr = String(cents).padStart(2, '0');
  return `${reaisStr},${centsStr}`;
}

/**
 * Converte string de moeda BR mascarada ou number para float.
 * Ex: "1.500,00" → 1500, "10.000,50" → 10000.5, 1500 → 1500
 * Seguro contra NaN: retorna 0 para entradas inválidas.
 */
export function parseFormNumber(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim();
  // Detecta o separador decimal: se houver vírgula, é formato BR (1.500,00)
  // Senão, pode ser formato US (1500.00) ou número puro
  if (str.includes(',')) {
    // Formato BR: remove pontos de milhar, troca vírgula por ponto
    const clean = str.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  }
  // Formato sem vírgula: apenas remove caracteres não-numéricos exceto ponto final
  // Garante apenas um ponto decimal (pega o último)
  const parts = str.replace(/[^\d.]/g, '').split('.');
  const clean = parts.length > 1 
    ? parts.slice(0, -1).join('') + '.' + parts[parts.length - 1]
    : parts[0];
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
}

export function numeroPorExtenso(numero: number): string {
  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  if (numero === 0) return "zero";

  function converterGrupo(n: number): string {
    if (n === 100) return "cem";
    let texto = "";
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;

    if (c > 0) texto += centenas[c];
    if (d === 1) {
      if (texto) texto += " e ";
      texto += unidades[n % 100];
      return texto;
    }
    if (d > 1) {
      if (texto) texto += " e ";
      texto += dezenas[d];
    }
    if (u > 0) {
      if (texto) texto += " e ";
      texto += unidades[u];
    }
    return texto;
  }

  const reais = Math.floor(numero);
  const centavos = Math.round((numero - reais) * 100);
  
  let partes: string[] = [];
  
  if (reais > 0) {
    const milhoes = Math.floor(reais / 1000000);
    const milhares = Math.floor((reais % 1000000) / 1000);
    const unidadesReais = reais % 1000;
    
    if (milhoes > 0) partes.push(converterGrupo(milhoes) + (milhoes === 1 ? " milhão" : " milhões"));
    if (milhares > 0) partes.push(converterGrupo(milhares) + " mil");
    if (unidadesReais > 0) {
      const g = converterGrupo(unidadesReais);
      // add "e" before hundreds if it's less than 100 or hundreds is exact
      if (partes.length > 0 && (unidadesReais < 100 || unidadesReais % 100 === 0)) partes.push("e " + g);
      else partes.push(g);
    }
    
    let txtReais = partes.join(" ");
    txtReais += (reais === 1 ? " real" : " reais");
    partes = [txtReais];
  }
  
  if (centavos > 0) {
    const txtCentavos = converterGrupo(centavos) + (centavos === 1 ? " centavo" : " centavos");
    if (partes.length > 0) partes.push("e " + txtCentavos);
    else partes.push(txtCentavos);
  }
  
  return partes.join(" ");
}

/**
 * Valida o dígito verificador matemático de CPFs e CNPJs.
 */
/**
 * Formata um valor numérico como moeda brasileira (R$).
 * Usa Intl.NumberFormat para garantir localização correta.
 */
export function formatCurrency(val: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
}

/**
 * Extrai as iniciais de um nome completo.
 * Ex: "João Silva" → "JS", "Maria" → "MA"
 */
export function getInitials(name: string): string {
  if (!name) return "GF";
  const parts = name.split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

/**
 * Formata CPF (xxx.xxx.xxx-xx) ou CNPJ (xx.xxx.xxx/xxxx-xx) a partir de dígitos.
 */
export function formatCpfCnpj(value: string): string {
  const v = value.replace(/\D/g, "");
  if (v.length <= 11) {
    return v.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  } else {
    return v.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2").substr(0, 18);
  }
}

/**
 * Formata telefone fixo (xx) xxxx-xxxx ou celular (xx) xxxxx-xxxx.
 */
export function formatTelefone(value: string): string {
  const v = value.replace(/\D/g, "").slice(0, 11);
  if (v.length <= 10) {
    return v.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  } else {
    return v.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
  }
}

export function isValidCpfCnpj(val: string): boolean {
  if (!val) return false;
  const numbers = val.replace(/\D/g, '');
  
  if (numbers.length === 11) {
    if (/^(\d)\1{10}$/.test(numbers)) return false;
    let sum = 0, rest;
    for (let i = 1; i <= 9; i++) sum += parseInt(numbers.substring(i-1, i)) * (11 - i);
    rest = (sum * 10) % 11;
    if (rest === 10 || rest === 11) rest = 0;
    if (rest !== parseInt(numbers.substring(9, 10))) return false;
    sum = 0;
    for (let i = 1; i <= 10; i++) sum += parseInt(numbers.substring(i-1, i)) * (12 - i);
    rest = (sum * 10) % 11;
    if (rest === 10 || rest === 11) rest = 0;
    if (rest !== parseInt(numbers.substring(10, 11))) return false;
    return true;
  }
  
  if (numbers.length === 14) {
    if (/^(\d)\1{13}$/.test(numbers)) return false;
    let length = numbers.length - 2;
    let numbersSub = numbers.substring(0, length);
    const digits = numbers.substring(length);
    let sum = 0, pos = length - 7;
    for (let i = length; i >= 1; i--) {
      sum += parseInt(numbersSub.charAt(length - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    let result = sum % 11 < 2 ? 0 : 11 - sum % 11;
    if (result !== parseInt(digits.charAt(0))) return false;
    length = length + 1;
    numbersSub = numbers.substring(0, length);
    sum = 0;
    pos = length - 7;
    for (let i = length; i >= 1; i--) {
      sum += parseInt(numbersSub.charAt(length - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    result = sum % 11 < 2 ? 0 : 11 - sum % 11;
    if (result !== parseInt(digits.charAt(1))) return false;
    return true;
  }
  
  return false;
}

export function formatDateOnlyBR(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  const trimmed = dateStr.trim();
  if (!trimmed) return "-";
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "-";
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}
