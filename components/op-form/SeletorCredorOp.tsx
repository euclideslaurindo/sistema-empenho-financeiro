"use client";
import { useFormContext, useWatch } from "react-hook-form";
import { Users } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { maskCurrency } from "@/lib/utils";
import { formatarBRL, toCents } from "@/lib/money";
import { somenteDigitos } from "@/lib/ne-credores";
import type { NeCredorResposta } from "@/lib/types/db";

type SetValue = (name: string, value: unknown, options?: { shouldValidate?: boolean; shouldDirty?: boolean }) => void;

export function credorDaListaNe(credores: NeCredorResposta[] | undefined, cpfCnpj: unknown) {
  const digitos = somenteDigitos(cpfCnpj);
  if (!digitos) return undefined;
  return (credores || []).find((c) => somenteDigitos(c.cpfCnpj) === digitos);
}

/**
 * Preenche o favorecido da OP com o credor da NE e sugere o restante dele
 * como valor a pagar. RG e endereço vêm do cadastro de credores.
 */
export async function selecionarCredorOp(setValue: SetValue, credor: NeCredorResposta) {
  setValue("nomeCredor", credor.nome, { shouldValidate: true, shouldDirty: true });
  setValue("cpfCnpj", credor.cpfCnpj, { shouldValidate: true, shouldDirty: true });
  setValue("credorMei", !!credor.isMei);
  setValue("sobrescreverMei", false);
  const restanteCents = toCents(credor.saldo);
  setValue("valorPagamento", restanteCents > 0 ? maskCurrency(restanteCents / 100) : "", {
    shouldValidate: true,
    shouldDirty: true,
  });

  const digitos = somenteDigitos(credor.cpfCnpj);
  try {
    const data = await apiClient.get<{ credores: Array<{ cpfCnpj: string; rg?: string | null; endereco?: string | null; isMei?: number | boolean | null }> }>(
      `/api/credores?busca=${encodeURIComponent(digitos)}&limit=5`
    );
    const cadastro = data?.credores?.find((c) => somenteDigitos(c.cpfCnpj) === digitos);
    if (cadastro) {
      setValue("rgCredor", cadastro.rg || "");
      setValue("enderecoCredor", cadastro.endereco || "");
      setValue("credorMei", !!Number(cadastro.isMei));
    }
  } catch {
    // Sem RG/endereço: o operador completa à mão, como antes.
  }
}

/** Aparece só para NE com 2+ credores (com 1, o credor é escolhido ao carregar a NE). */
export function SeletorCredorOp() {
  const { control, setValue } = useFormContext<any>();
  const credores: NeCredorResposta[] = useWatch({ control, name: "credoresNe" }) || [];
  const cpfAtual = useWatch({ control, name: "cpfCnpj" });

  if (credores.length < 2) return null;
  const selecionado = credorDaListaNe(credores, cpfAtual);

  return (
    <fieldset className="col-span-12 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
      <legend className="flex items-center gap-2 px-1 text-sm font-black uppercase tracking-widest text-blue-900">
        <Users className="w-4 h-4" /> Credor desta OP
      </legend>
      <div role="radiogroup" aria-label="Credor desta OP" className="mt-2 grid gap-2 md:grid-cols-2">
        {credores.map((c) => {
          const restanteCents = toCents(c.saldo);
          const esgotado = restanteCents <= 0;
          const marcado = selecionado?.cpfCnpj === c.cpfCnpj;
          const id = `op-credor-${somenteDigitos(c.cpfCnpj)}`;
          return (
            <label
              key={c.cpfCnpj}
              htmlFor={id}
              className={`flex gap-3 rounded-lg border px-3 py-2 ${
                marcado ? "border-blue-500 bg-white" : "border-slate-200 bg-white/70"
              } ${esgotado ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-blue-300"}`}
            >
              <input
                id={id}
                type="radio"
                name="op-credor-ne"
                checked={marcado}
                disabled={esgotado}
                onChange={() => selecionarCredorOp(setValue, c)}
                className="mt-1"
              />
              <span className="text-sm">
                <span className="block font-bold text-slate-800">
                  {c.nome}
                  {c.isMei && (
                    <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-violet-700">MEI</span>
                  )}
                </span>
                <span className="block text-xs text-slate-500">{c.cpfCnpj}</span>
                <span className="block text-xs font-semibold text-slate-600">
                  Bruto R$ {formatarBRL(toCents(c.valorBruto))} · Pago R$ {formatarBRL(toCents(c.valorPago))} ·{" "}
                  <span className={esgotado ? "text-red-600" : "text-emerald-700"}>
                    Restante R$ {formatarBRL(restanteCents)}
                  </span>
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
