"use client";
import { useEffect, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { apiClient } from "@/lib/api-client";
import { toCents } from "@/lib/money";
import { extrairCodigoElemento } from "@/lib/elementos";
import { perfilDoElemento } from "@/lib/perfis-calculo";
import { CAMPO_FORM, ehCampoRetencao, informadosValidosDaLinha, valoresCalculadosDoForm, type Perfil } from "@/lib/retencoes-form";
import { montarPayloadLote, type CredorLinha } from "@/lib/op-emissao";
import { aplicarCalculadosNaLinha, itensDaPreviaEmCentavos } from "@/components/op-form/OpTaxesSection";
import type { ConfigRetencoes } from "@/hooks/use-retencoes-config";

interface LinhaPrevia {
  indice: number;
  itens?: Record<string, number>;
  avisos?: string[];
  erro?: string;
}

/**
 * O que muda o cálculo de uma linha. Os valores CALCULADOS ficam de fora (só os
 * digitados entram) — senão aplicar o resultado mudaria a assinatura e pediria
 * a prévia de novo, sem fim.
 */
export function assinaturaDaLinha(c: Partial<CredorLinha>, dataEmissao: unknown): string {
  const informados = (c.camposInformados || [])
    .filter(ehCampoRetencao)
    .sort()
    .map((campo) => `${campo}=${toCents((c as any)[CAMPO_FORM[campo]])}`);
  return JSON.stringify([
    String(c.cpfCnpj ?? ""),
    toCents(c.valorPagamento),
    c.dataPagamento || "",
    dataEmissao || "",
    informados,
    !!c.credorMei,
    !!c.sobrescreverMei,
  ]);
}

/**
 * Prévia do transporte (3.3.90.33) da lista de credores (T35-B, D43): pede a
 * `previa-lote` só das linhas que mudaram, com debounce. O resultado é aplicado
 * na linha pela `chave` (estável ao remover/reordenar), e só se ela não mudou
 * de novo depois do envio. Nos demais elementos não faz nada (cálculo local).
 */
export function PreviaLoteEffect({ config, perfil, atraso = 400 }: { config: ConfigRetencoes; perfil: Perfil; atraso?: number }) {
  const { control, getValues, setValue } = useFormContext<any>();
  const elemento = useWatch({ control, name: "elemento" });
  const neCarregada: string = useWatch({ control, name: "neCarregada" }) || "";
  const dataEmissao = useWatch({ control, name: "dataEmissao" });
  const credores: CredorLinha[] = useWatch({ control, name: "credores" }) || [];

  const elementoCodigo = extrairCodigoElemento(elemento);
  const ativo = perfilDoElemento(elementoCodigo) === "TRANSPORTE_AUTONOMO" && !!neCarregada;
  // chave -> assinatura cujo resultado já está na linha
  const aplicadas = useRef(new Map<string, string>());
  // chave -> assinatura já enviada e ainda sem resposta (não manda duas vezes)
  const emVoo = useRef(new Map<string, string>());
  const montado = useRef(true);
  const chaveDasLinhas = JSON.stringify(credores.map((c) => [c?.chave, assinaturaDaLinha(c || {}, dataEmissao)]));

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  // Trocou de NE/elemento: nada do que foi aplicado vale mais.
  useEffect(() => {
    aplicadas.current = new Map();
    emVoo.current = new Map();
  }, [neCarregada, elementoCodigo]);

  useEffect(() => {
    if (!ativo) return;
    const timer = setTimeout(async () => {
      const linhas: CredorLinha[] = getValues("credores") || [];
      const basePath = (i: number) => `credores.${i}`;
      const prontas: Array<{ indice: number; chave: string; assinatura: string; payload: Record<string, unknown> }> = [];

      linhas.forEach((c, i) => {
        const mei = { credorMei: !!c.credorMei, sobrescreverMei: !!c.sobrescreverMei };
        const informados = c.camposInformados || [];
        const validos = informadosValidosDaLinha(informados, config, elementoCodigo, perfil, mei);
        // assinatura já com a lista corrigida: é a que a linha terá quando a resposta chegar
        const assinatura = assinaturaDaLinha({ ...c, camposInformados: validos }, dataEmissao);
        if (aplicadas.current.get(c.chave) === assinatura || emVoo.current.get(c.chave) === assinatura) return;
        if (validos.length !== informados.length) setValue(`${basePath(i)}.camposInformados`, validos);

        if (!c.cpfCnpj || toCents(c.valorPagamento) <= 0) {
          aplicarCalculadosNaLinha(getValues, setValue, basePath(i), valoresCalculadosDoForm({}, validos));
          setValue(`${basePath(i)}.previaAvisos`, [
            !c.cpfCnpj ? "Escolha o credor para calcular o transporte." : "Informe o valor a pagar para calcular o transporte.",
          ]);
          aplicadas.current.set(c.chave, assinatura);
          return;
        }
        const [payload] = montarPayloadLote({ neCarregada, dataEmissao, credores: [{ ...c, camposInformados: validos }] }).credores;
        prontas.push({ indice: i, chave: c.chave, assinatura, payload });
      });
      if (prontas.length === 0) return;
      for (const p of prontas) emVoo.current.set(p.chave, p.assinatura);
      const sairDoVoo = () => {
        for (const p of prontas) if (emVoo.current.get(p.chave) === p.assinatura) emVoo.current.delete(p.chave);
      };

      const aplicar = (pronta: (typeof prontas)[number], resultado: LinhaPrevia | { erro: string }) => {
        const atuais: CredorLinha[] = getValues("credores") || [];
        const i = atuais.findIndex((c) => c.chave === pronta.chave);
        if (i < 0) return; // linha removida enquanto a prévia estava em voo
        if (assinaturaDaLinha(atuais[i], getValues("dataEmissao")) !== pronta.assinatura) return; // mudou de novo
        const validos = (atuais[i].camposInformados || []).filter(ehCampoRetencao);
        if ("erro" in resultado && resultado.erro) {
          aplicarCalculadosNaLinha(getValues, setValue, basePath(i), valoresCalculadosDoForm({}, validos));
          setValue(`${basePath(i)}.previaAvisos`, [resultado.erro]);
        } else {
          const r = resultado as LinhaPrevia;
          aplicarCalculadosNaLinha(getValues, setValue, basePath(i), valoresCalculadosDoForm(itensDaPreviaEmCentavos(r.itens), validos));
          setValue(`${basePath(i)}.previaAvisos`, r.avisos || []);
        }
        aplicadas.current.set(pronta.chave, pronta.assinatura);
      };

      try {
        const resposta = await apiClient.post<{ linhas: LinhaPrevia[] }>("/api/ordens-pagamento/previa-lote", {
          numeroNe: neCarregada,
          dataEmissao: dataEmissao || null,
          credores: prontas.map((p) => ({ indice: p.indice, ...p.payload })),
        });
        sairDoVoo();
        if (!montado.current) return;
        for (const pronta of prontas) {
          const linha = resposta.linhas?.find((l) => l.indice === pronta.indice);
          if (linha) aplicar(pronta, linha);
        }
      } catch (e: any) {
        sairDoVoo();
        if (!montado.current) return;
        // Não marca como aplicada: a próxima mudança tenta de novo.
        for (const pronta of prontas) {
          const atuais: CredorLinha[] = getValues("credores") || [];
          const i = atuais.findIndex((c) => c.chave === pronta.chave);
          if (i < 0) continue;
          aplicarCalculadosNaLinha(getValues, setValue, basePath(i), valoresCalculadosDoForm({}, atuais[i].camposInformados || []));
          setValue(`${basePath(i)}.previaAvisos`, [e?.message || "Não foi possível calcular a prévia do transporte."]);
        }
      }
    }, atraso);
    return () => clearTimeout(timer);
    // chaveDasLinhas representa `credores` (a identidade do array muda a cada render)
  }, [ativo, neCarregada, elementoCodigo, dataEmissao, chaveDasLinhas, config, perfil, atraso, getValues, setValue]);

  return null;
}
