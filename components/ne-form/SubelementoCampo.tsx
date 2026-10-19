"use client";
import { useFormContext, useWatch } from "react-hook-form";
import type { SubelementoOption } from "@/hooks/use-elementos";

/** Tamanho da coluna notas_empenho.subelemento (VARCHAR(250), migration_11). */
export const SUBELEMENTO_MAX = 250;

const classeCampo =
  "w-full px-4 py-3 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-bold focus:outline-none focus:ring-4 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10 text-slate-700 transition-all duration-300";

/**
 * Subelemento da NE, sempre visível (T29, D26):
 * - o elemento tem subelementos cadastrados -> lista, com "(legado) …" para valor antigo fora dela;
 * - sem lista (ou nenhum elemento escolhido) -> texto livre, opcional.
 * Quem troca o elemento é responsável por limpar o subelemento (só na troca manual).
 */
export function SubelementoCampo({ subelementos }: { subelementos: SubelementoOption[] }) {
  const { register, control } = useFormContext();
  const valor: string = useWatch({ control, name: "subelemento" }) || "";

  if (subelementos.length > 0) {
    const reconhecido = subelementos.some((s) => s.valor === valor);
    return (
      <div className="md:col-span-2">
        <label htmlFor="ne-subelemento" className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
          Subelemento
        </label>
        <select id="ne-subelemento" {...register("subelemento")} className={classeCampo}>
          <option value="">Selecione o Subelemento</option>
          {subelementos.map((sub) => (
            <option key={sub.codigo} value={sub.valor}>
              {sub.valor}
            </option>
          ))}
          {!!valor && !reconhecido && <option value={valor}>(legado) {valor}</option>}
        </select>
      </div>
    );
  }

  return (
    <div className="md:col-span-2">
      <label htmlFor="ne-subelemento" className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
        Subelemento
      </label>
      <input
        id="ne-subelemento"
        type="text"
        maxLength={SUBELEMENTO_MAX}
        placeholder="Subelemento (opcional)"
        {...register("subelemento")}
        className={classeCampo}
      />
    </div>
  );
}
