"use client";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type { NumeroPrevisto } from "@/lib/op-emissao";

/**
 * Números de OP previstos para as N linhas da emissão (T34-B), na ordem.
 * Previsão, não reserva: o definitivo só existe depois de emitir. Espera
 * `atraso` ms sem mudança em N antes de pedir; a resposta só vale para a
 * chave (NE + N + versão) que a pediu.
 */
export function useNumerosPrevistos(numeroNe: string | null | undefined, quantidade: number, atraso = 300) {
  const [versao, setVersao] = useState(0);
  const [resposta, setResposta] = useState<{ chave: string; numeros: NumeroPrevisto[] | null } | null>(null);
  const n = Math.min(Math.max(0, quantidade), 100);
  const chave = numeroNe && n > 0 ? `${numeroNe}|${n}|${versao}` : "";

  useEffect(() => {
    if (!chave || !numeroNe) return;
    let ativo = true;
    const timer = setTimeout(() => {
      apiClient
        .get<{ numeros: NumeroPrevisto[] }>(
          `/api/ordens-pagamento/proximo-numero?numeroNe=${encodeURIComponent(numeroNe)}&quantidade=${n}`
        )
        .then((data) => ativo && setResposta({ chave, numeros: data.numeros || null }))
        // sem selo: a emissão continua possível, o número definitivo vem do servidor
        .catch(() => ativo && setResposta({ chave, numeros: null }));
    }, atraso);
    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [chave, numeroNe, n, atraso]);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  return { numeros: resposta && resposta.chave === chave ? resposta.numeros : null, recarregar };
}
