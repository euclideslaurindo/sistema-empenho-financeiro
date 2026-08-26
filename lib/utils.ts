import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
