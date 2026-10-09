"use client";
import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Hash } from "lucide-react";
import { apiClient } from "@/lib/api-client";

export interface PrevisaoNumero {
  numeroOp: string;
  sub: string;
  rotulo: string;
  previsto: true;
}

// Previsão, não reserva: o número definitivo só existe depois de salvar
// (outra OP salva antes pode "pegar" este número).
export function FaixaNumeroPrevisto() {
  const { control, setValue } = useFormContext<any>();
  const neCarregada: string = useWatch({ control, name: "neCarregada" }) || "";
  const previsao: PrevisaoNumero | null = useWatch({ control, name: "previsaoNumero" }) || null;

  // Zera a previsão a cada troca de NE; resposta de uma NE anterior é descartada.
  useEffect(() => {
    let cancelado = false;
    setValue("previsaoNumero", null);
    if (!neCarregada) return;

    apiClient
      .get<PrevisaoNumero>(`/api/ordens-pagamento/proximo-numero?numeroNe=${encodeURIComponent(neCarregada)}`)
      .then((data) => {
        if (!cancelado) setValue("previsaoNumero", data);
      })
      .catch(() => {
        // Sem faixa: a própria busca da NE já mostra o erro ao operador.
      });

    return () => {
      cancelado = true;
    };
  }, [neCarregada, setValue]);

  if (!previsao) return null;

  return (
    <div
      role="status"
      className="col-span-12 flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-900"
    >
      <Hash className="w-4 h-4" />
      Esta será a OP {previsao.numeroOp} · {previsao.rotulo}{" "}
      <span className="font-semibold text-blue-700">(previsto)</span>
    </div>
  );
}

export function placeholderNumeroOp(previsao: PrevisaoNumero | null | undefined): string {
  return previsao ? `${previsao.numeroOp} (previsto)` : "Gerado automaticamente";
}
