// Regras de tela da seção "Retenções e Descontos" da OP (T11). Espelham as
// regras de lib/retencoes.ts pra tela nunca oferecer edição que o servidor
// vai ignorar — mas quem decide o valor gravado continua sendo o servidor.
import { CAMPOS_TRIBUTARIOS, type CampoDesconto, type CampoTributario } from "@/lib/retencoes";
import type { ConfigRetencaoCampoMapeado } from "@/lib/services/config-retencoes.service";
import { maskCurrency } from "@/lib/utils";
import { toCents } from "@/lib/money";

export type CampoRetencao = CampoTributario | CampoDesconto;
export type Perfil = "ADMIN" | "GESTOR" | "CONSULTA";

export const CAMPO_FORM: Record<CampoRetencao, string> = {
  irrf: "irrf",
  iss: "iss",
  inss: "inss",
  patronal: "patronal",
  sest_senat: "sestSenat",
  outros: "outrosDescontos",
  taxa_bancaria: "taxaBancaria",
  taxa_pix: "taxaPix",
};

export const CAMPOS_RETENCAO = Object.keys(CAMPO_FORM) as CampoRetencao[];

export function ehCampoRetencao(campo: string): campo is CampoRetencao {
  return campo in CAMPO_FORM;
}

export interface EstadoCampo {
  editavel: boolean;
  obrigatorio: boolean;
  dica: string | null;
}

export function estadoCampo(
  cfg: ConfigRetencaoCampoMapeado,
  elementoCodigo: string | null,
  regras: Record<string, string[]>,
  perfil: Perfil
): EstadoCampo {
  const podeEditar = cfg.editavelOperador || perfil === "ADMIN";
  if (!(CAMPOS_TRIBUTARIOS as string[]).includes(cfg.campo)) {
    return { editavel: podeEditar, obrigatorio: false, dica: null };
  }

  const aplicaveis = elementoCodigo !== null ? regras[elementoCodigo] : undefined;
  if (aplicaveis === undefined) {
    return { editavel: podeEditar, obrigatorio: false, dica: null };
  }
  if (!aplicaveis.includes(cfg.campo)) {
    return { editavel: false, obrigatorio: false, dica: `Não se aplica a ${elementoCodigo}` };
  }

  const automatico = cfg.calculoAutomatico && cfg.tipo === "PERCENTUAL" && cfg.aliquota != null;
  if (automatico) {
    return { editavel: podeEditar, obrigatorio: false, dica: null };
  }
  return { editavel: true, obrigatorio: true, dica: "Sem cálculo automático: informe o valor" };
}

export function rotuloCampo(cfg: ConfigRetencaoCampoMapeado): string {
  if (cfg.tipo === "PERCENTUAL" && cfg.aliquota != null) {
    const aliquota = cfg.aliquota.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
    return `${cfg.rotulo} (${aliquota}%)`;
  }
  return cfg.rotulo;
}

// maskCurrency devolve "" pra zero, o que impediria informar R$ 0,00 de
// propósito (ex.: ISS digitado que não é devido). Digitar 0 vira "0,00";
// apagar a partir de zero limpa o campo.
export function mascararValorDigitado(bruto: string, apagando: boolean): string {
  const digitos = bruto.replace(/\D/g, "");
  if (!digitos) return "";
  if (parseInt(digitos, 10) === 0) return apagando ? "" : "0,00";
  return maskCurrency(bruto);
}

export function informadosEmCentavos(
  valores: Record<string, unknown>,
  camposInformados: string[]
): Partial<Record<CampoRetencao, number>> {
  const informados: Partial<Record<CampoRetencao, number>> = {};
  for (const campo of camposInformados) {
    if (ehCampoRetencao(campo)) {
      informados[campo] = toCents(valores[CAMPO_FORM[campo]] as string | number | undefined);
    }
  }
  return informados;
}

export function somarDescontosCents(valores: Record<string, unknown>): number {
  return CAMPOS_RETENCAO.reduce(
    (total, campo) => total + toCents(valores[CAMPO_FORM[campo]] as string | number | undefined),
    0
  );
}
