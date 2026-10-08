"use client";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { ElementoOption } from "@/hooks/use-elementos";

export interface ConfigRetencaoCampo {
  campo: string;
  rotulo: string;
  tipo: "PERCENTUAL" | "VALOR_DIGITADO";
  aliquota: number | null;
  calculoAutomatico: boolean;
  editavelOperador: boolean;
  entraDarf: boolean;
  ativo: boolean;
  ordem: number;
}

export interface ConfigRetencoes {
  campos: ConfigRetencaoCampo[];
  regras: Record<string, string[]>;
  versao: string;
}

interface UseRetencoesConfigResult {
  config: ConfigRetencoes | null;
  elementos: ElementoOption[];
  loading: boolean;
  erro: string | null;
  recarregar: () => void;
}

// Diferente de use-elementos.ts (T05): aqui NÃO há cache em memória — esta
// tela é editada por ADMIN e precisa sempre do estado mais recente do banco,
// nunca de um valor da sessão anterior.
export function useRetencoesConfig(): UseRetencoesConfigResult {
  const [config, setConfig] = useState<ConfigRetencoes | null>(null);
  const [elementos, setElementos] = useState<ElementoOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setErro(null);

    Promise.all([
      apiClient.get<ConfigRetencoes>("/api/configuracoes/retencoes"),
      apiClient.get<{ elementos: ElementoOption[] }>("/api/elementos?incluirInativos=1"),
    ])
      .then(([configData, elementosData]) => {
        if (cancelado) return;
        setConfig(configData);
        setElementos(elementosData.elementos || []);
      })
      .catch((err) => {
        if (!cancelado) setErro(err?.message || "Erro ao carregar configuração de retenções.");
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [tick]);

  const recarregar = useCallback(() => setTick((t) => t + 1), []);

  return { config, elementos, loading, erro, recarregar };
}
