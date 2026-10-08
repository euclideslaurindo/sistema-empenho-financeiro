"use client";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

export interface SubelementoOption {
  codigo: string;
  descricao: string;
  valor: string;
}

export interface ElementoOption {
  codigo: string;
  descricao: string;
  valor: string;
  legado: boolean;
  ativo: boolean;
  retencoes: string[];
  subelementos: SubelementoOption[];
}

// Cache em memória em nível de módulo: evita refazer o fetch a cada
// montagem do componente na mesma sessão da aba. Não usa localStorage/
// sessionStorage (não precisa sobreviver a um reload de página).
let cache: ElementoOption[] | null = null;
let cachePromise: Promise<ElementoOption[]> | null = null;

async function fetchElementos(): Promise<ElementoOption[]> {
  const data = await apiClient.get<{ elementos: ElementoOption[] }>("/api/elementos");
  return data.elementos || [];
}

/** Limpa o cache (ex.: depois do admin editar elementos na tela da T08). */
export function invalidateElementosCache() {
  cache = null;
  cachePromise = null;
}

export function useElementos() {
  const [elementos, setElementos] = useState<ElementoOption[]>(cache || []);
  const [loading, setLoading] = useState(!cache);
  const [erro, setErro] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelado = false;

    if (cache && tick === 0) {
      setElementos(cache);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErro(null);

    // Deduplica requisição em voo: se dois componentes montarem o hook
    // antes do primeiro fetch resolver, os dois reaproveitam a mesma Promise.
    if (!cachePromise) {
      cachePromise = fetchElementos();
    }

    cachePromise
      .then((data) => {
        cache = data;
        if (!cancelado) setElementos(data);
      })
      .catch((err) => {
        cachePromise = null; // permite tentar de novo numa próxima chamada
        if (!cancelado) setErro(err?.message || "Erro ao carregar elementos.");
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [tick]);

  const recarregar = useCallback(() => {
    invalidateElementosCache();
    setTick((t) => t + 1);
  }, []);

  return { elementos, loading, erro, recarregar };
}
