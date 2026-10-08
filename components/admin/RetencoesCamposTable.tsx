"use client";
import { useFormContext, useFieldArray, useWatch } from "react-hook-form";

// Campos não-tributários: "Entra na DARF" nunca se aplica a eles (mesma
// regra do Zod em lib/schemas.ts, T06).
const CAMPOS_NAO_TRIBUTARIOS = ["outros", "taxa_bancaria", "taxa_pix"];

/** Mantém só dígitos + 1 vírgula, no máximo 4 casas decimais. Diferente de
 * maskCurrency (que é de centavos/2 casas) — alíquota aceita até 4 casas. */
function sanitizarPercentual(raw: string): string {
  let v = raw.replace(/[^\d,]/g, "");
  const partes = v.split(",");
  if (partes.length > 2) v = partes[0] + "," + partes.slice(1).join("");
  const [inteiro, decimal] = v.split(",");
  if (decimal && decimal.length > 4) v = inteiro + "," + decimal.slice(0, 4);
  return v;
}

function LinhaCampo({ index }: { index: number }) {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<any>();
  const erroAliquota = (errors as any)?.campos?.[index]?.aliquota;
  const campo: string = useWatch({ control, name: `campos.${index}.campo` });
  const tipo: string = useWatch({ control, name: `campos.${index}.tipo` });
  const calculoAutomatico: boolean = useWatch({ control, name: `campos.${index}.calculoAutomatico` });
  const rotulo: string = useWatch({ control, name: `campos.${index}.rotulo` }) || campo;

  const aliquotaDesabilitada = tipo !== "PERCENTUAL" || !calculoAutomatico;
  const calculoAutomaticoDesabilitado = tipo !== "PERCENTUAL";
  const entraDarfDesabilitado = CAMPOS_NAO_TRIBUTARIOS.includes(campo);

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-3 pr-2">
        <input
          type="text"
          {...register(`campos.${index}.rotulo` as const)}
          aria-label={`Rótulo de ${campo}`}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold focus:outline-none focus:border-blue-800"
        />
      </td>
      <td className="py-3 pr-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
        {tipo === "PERCENTUAL" ? "Percentual" : "Valor digitado"}
      </td>
      <td className="py-3 pr-2">
        <input
          type="text"
          placeholder="0,0000"
          {...register(`campos.${index}.aliquota` as const)}
          onChange={(e) => {
            const v = sanitizarPercentual(e.target.value);
            e.target.value = v;
            setValue(`campos.${index}.aliquota`, v, { shouldValidate: true, shouldDirty: true });
          }}
          disabled={aliquotaDesabilitada}
          aria-label={`Alíquota de ${rotulo}`}
          aria-invalid={!!erroAliquota}
          aria-describedby={erroAliquota ? `campo-${index}-aliquota-erro` : undefined}
          className={`w-full px-3 py-2 rounded-lg border text-sm font-bold text-right disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none ${erroAliquota ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50 focus:border-blue-800"}`}
        />
        {erroAliquota && (
          <p id={`campo-${index}-aliquota-erro`} className="text-red-500 text-xs mt-1 font-semibold">
            {erroAliquota.message}
          </p>
        )}
      </td>
      <td className="py-3 pr-2 text-center">
        <input
          type="checkbox"
          {...register(`campos.${index}.calculoAutomatico` as const)}
          disabled={calculoAutomaticoDesabilitado}
          aria-label={`${rotulo} — Cálculo automático`}
          className="rounded text-blue-900 disabled:opacity-40"
        />
      </td>
      <td className="py-3 pr-2 text-center">
        <input
          type="checkbox"
          {...register(`campos.${index}.editavelOperador` as const)}
          aria-label={`${rotulo} — Editável pelo operador`}
          className="rounded text-blue-900"
        />
      </td>
      <td className="py-3 pr-2 text-center">
        <input
          type="checkbox"
          {...register(`campos.${index}.entraDarf` as const)}
          disabled={entraDarfDesabilitado}
          aria-label={`${rotulo} — Entra na DARF`}
          className="rounded text-blue-900 disabled:opacity-40"
        />
      </td>
      <td className="py-3 text-center">
        <input
          type="checkbox"
          {...register(`campos.${index}.ativo` as const)}
          aria-label={`${rotulo} — Ativo`}
          className="rounded text-blue-900"
        />
      </td>
    </tr>
  );
}

export default function RetencoesCamposTable() {
  const { control } = useFormContext<any>();
  const { fields } = useFieldArray({ control, name: "campos" });

  return (
    <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] mb-8">
      <div className="flex items-center mb-6 pb-4 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-800">Campos de Retenções e Descontos</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-slate-100">
              <th scope="col" className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest">Rótulo</th>
              <th scope="col" className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest">Tipo</th>
              <th scope="col" className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest">Alíquota (%)</th>
              <th scope="col" className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest text-center">Automático</th>
              <th scope="col" className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest text-center">Editável operador</th>
              <th scope="col" className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest text-center">Entra na DARF</th>
              <th scope="col" className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest text-center">Ativo</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => (
              <LinhaCampo key={field.id} index={index} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
