"use client";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

export interface SaldoNe {
  valor: number;
  gasto: number;
  restante: number;
  percentualGasto: number;
  qtdOps: number;
}

interface Resposta {
  chave: string;
  saldo: SaldoNe | null;
  erro: string | null;
}

/**
 * Saldo da NE (T31) para a emissão (T35-B). `recarregar()` depois de emitir.
 * A resposta fica guardada com a chave do pedido (NE + versão): resposta de
 * uma NE anterior ou de um pedido mais antigo nunca aparece.
 */
export function useSaldoNe(numero: string | null | undefined) {
  const [versao, setVersao] = useState(0);
  const [resposta, setResposta] = useState<Resposta | null>(null);
  const chave = numero ? `${numero}|${versao}` : "";

  useEffect(() => {
    if (!numero) return;
    let ativo = true;
    apiClient
      .get<{ saldo: SaldoNe }>(`/api/notas-empenho/saldo?numero=${encodeURIComponent(numero)}`)
      .then((data) => ativo && setResposta({ chave, saldo: data.saldo, erro: null }))
      .catch((e: any) => ativo && setResposta({ chave, saldo: null, erro: e?.message || "Não foi possível carregar o saldo da NE." }));
    return () => {
      ativo = false;
    };
  }, [numero, chave]);

  const atual = resposta && resposta.chave === chave ? resposta : null;
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  return { saldo: atual?.saldo ?? null, erro: atual?.erro ?? null, carregando: !!numero && !atual, recarregar };
}
