// Motor único de cálculo de retenções (projeto Retenções v2, T10).
// Puro: sem acesso a banco/HTTP. O servidor (ordem-pagamento.service.ts) é
// quem busca config/regras do banco e chama calcularRetencoes com os dados
// já em mãos — isso é o que torna o resultado testável sem mock de SQL.
import { calcPercentCents } from "@/lib/money";
import type { ConfigRetencaoCampoMapeado } from "@/lib/services/config-retencoes.service";

export type CampoTributario = "irrf" | "iss" | "inss" | "patronal" | "sest_senat";
export type CampoDesconto = "outros" | "taxa_bancaria" | "taxa_pix";

export const CAMPOS_TRIBUTARIOS: CampoTributario[] = ["irrf", "iss", "inss", "patronal", "sest_senat"];
export const CAMPOS_DESCONTO: CampoDesconto[] = ["outros", "taxa_bancaria", "taxa_pix"];

export interface EntradaCalculo {
  brutoCents: number;
  elementoCodigo: string | null;
  config: ConfigRetencaoCampoMapeado[];
  regras: Record<string, string[]>;
  // Partial de propósito: a AUSÊNCIA de uma chave significa "o operador não
  // tocou nesse campo", diferente de presente-com-zero. O chamador (serviço)
  // só deve incluir uma chave se o valor realmente veio do payload do
  // cliente — ver nota no plano da T10 sobre o contrato que a T11 precisa
  // respeitar (não mandar sempre os 8 campos com "" / 0).
  informados: Partial<Record<CampoTributario | CampoDesconto, number>>;
  perfil: "ADMIN" | "GESTOR" | "CONSULTA";
}

export interface ResultadoCalculo {
  itens: Record<string, number>; // centavos, uma chave por um dos 8 campos
  totalDescontosCents: number;
  liquidoCents: number;
  avisos: string[];
  snapshot: Record<string, any>;
}

function validarInformado(campo: string, valor: number, brutoCents: number): number {
  if (!Number.isFinite(valor) || valor < 0 || valor > brutoCents) {
    throw { status: 422, error: `Valor informado para "${campo}" é inválido (deve estar entre 0 e o valor bruto).` };
  }
  return Math.round(valor);
}

export function calcularRetencoes(entrada: EntradaCalculo): ResultadoCalculo {
  const { brutoCents, elementoCodigo, config, regras, informados, perfil } = entrada;

  if (!Number.isInteger(brutoCents) || brutoCents < 0) {
    throw { status: 422, error: "Valor bruto inválido para cálculo de retenções." };
  }

  const avisos: string[] = [];
  const itens: Record<string, number> = {};
  const configPorCampo = new Map(config.map((c) => [c.campo, c]));
  const camposAplicaveis = elementoCodigo !== null ? regras[elementoCodigo] : undefined;
  const elementoDesconhecido = elementoCodigo === null || camposAplicaveis === undefined;

  if (elementoDesconhecido) {
    avisos.push("Elemento desconhecido: nenhuma retenção foi calculada automaticamente.");
  }

  for (const campo of CAMPOS_TRIBUTARIOS) {
    const cfg = configPorCampo.get(campo);
    if (!cfg || !cfg.ativo) {
      itens[campo] = 0;
      continue;
    }

    if (elementoDesconhecido) {
      // Regra 1: sem matriz pra consultar, nenhum cálculo automático — só
      // aceita valor digitado de quem tem permissão de editar esse campo.
      const podeEditar = cfg.editavelOperador || perfil === "ADMIN";
      const informado = informados[campo];
      if (podeEditar && informado !== undefined) {
        itens[campo] = validarInformado(campo, informado, brutoCents);
      } else {
        itens[campo] = 0;
        if (podeEditar) avisos.push(`Elemento desconhecido: informe "${campo}" manualmente se aplicável.`);
      }
      continue;
    }

    const aplica = (camposAplicaveis as string[]).includes(campo);
    if (!aplica) {
      itens[campo] = 0;
      continue;
    }

    let valor: number;
    if (cfg.calculoAutomatico && cfg.tipo === "PERCENTUAL" && cfg.aliquota != null) {
      valor = calcPercentCents(brutoCents, cfg.aliquota);
      // Regra 3: só sobrescreve um cálculo automático se o campo for
      // editável pelo operador ou o perfil for ADMIN — nunca por um cliente
      // simplesmente mandar um número (é o bug que esta task corrige).
      const podeSobrescrever = cfg.editavelOperador || perfil === "ADMIN";
      const informado = informados[campo];
      if (podeSobrescrever && informado !== undefined) {
        valor = validarInformado(campo, informado, brutoCents);
      }
    } else {
      // Não automático (ex.: ISS digitado, D1): qualquer perfil digita —
      // não existe cálculo automático aqui pra "sobrescrever".
      const informado = informados[campo];
      if (informado === undefined) {
        avisos.push(`"${campo}" não tem cálculo automático e nenhum valor foi informado; gravado como 0.`);
        valor = 0;
      } else {
        valor = validarInformado(campo, informado, brutoCents);
      }
    }

    itens[campo] = valor;
  }

  for (const campo of CAMPOS_DESCONTO) {
    const cfg = configPorCampo.get(campo);
    if (!cfg || !cfg.ativo) {
      itens[campo] = 0;
      continue;
    }
    const permitido = cfg.editavelOperador || perfil === "ADMIN";
    const informado = informados[campo];
    itens[campo] = permitido && informado !== undefined ? validarInformado(campo, informado, brutoCents) : 0;
  }

  const totalDescontosCents = Object.values(itens).reduce((a, b) => a + b, 0);
  if (totalDescontosCents > brutoCents) {
    throw { status: 422, error: "Total de descontos maior que o valor a pagar." };
  }

  // rotulo/ativo/aplica vão no snapshot pra impressão (T12) reproduzir a OP
  // como ela foi calculada, sem consultar a config atual.
  const tributarios = CAMPOS_TRIBUTARIOS as string[];
  const snapshot = {
    elemento: elementoCodigo,
    campos: Object.fromEntries(
      config.map((cfg) => [
        cfg.campo,
        {
          rotulo: cfg.rotulo,
          aliquota: cfg.aliquota,
          automatico: cfg.calculoAutomatico,
          ativo: cfg.ativo,
          aplica:
            !tributarios.includes(cfg.campo) || elementoDesconhecido || (camposAplicaveis as string[]).includes(cfg.campo),
          valor: (itens[cfg.campo] ?? 0) / 100,
        },
      ])
    ),
    calculadoEm: new Date().toISOString(),
    regra: "v1",
  };

  return {
    itens,
    totalDescontosCents,
    liquidoCents: brutoCents - totalDescontosCents,
    avisos,
    snapshot,
  };
}
