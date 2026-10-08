"use client";
import { useFormContext, useFieldArray, useWatch } from "react-hook-form";

const CAMPOS_TRIBUTARIOS = ["irrf", "iss", "inss", "patronal", "sest_senat"] as const;
const ROTULOS: Record<string, string> = {
  irrf: "IRRF",
  iss: "ISS",
  inss: "INSS",
  patronal: "Patronal",
  sest_senat: "SEST/SENAT",
};

function LinhaElemento({ index, totalLinhas }: { index: number; totalLinhas: number }) {
  const { register, control, setValue, getValues } = useFormContext<any>();
  const codigo: string = useWatch({ control, name: `elementos.${index}.codigo` });
  const descricao: string = useWatch({ control, name: `elementos.${index}.descricao` });
  const legado: boolean = useWatch({ control, name: `elementos.${index}.legado` });

  const marcarLinha = (valor: boolean) => {
    for (const campo of CAMPOS_TRIBUTARIOS) {
      setValue(`elementos.${index}.campos.${campo}`, valor, { shouldValidate: true, shouldDirty: true });
    }
  };

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <th scope="row" className="py-3 pr-2 text-left font-bold text-slate-700 whitespace-nowrap">
        {codigo} — {descricao}
        {legado && (
          <span className="ml-2 text-xs font-black uppercase tracking-widest bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full">
            legado
          </span>
        )}
      </th>
      {CAMPOS_TRIBUTARIOS.map((campo) => (
        <td key={campo} className="py-3 text-center">
          <input
            type="checkbox"
            {...register(`elementos.${index}.campos.${campo}` as const)}
            aria-label={`${codigo} aplica ${ROTULOS[campo]}`}
            className="rounded text-blue-900"
          />
        </td>
      ))}
      <td className="py-3 pl-2 text-right">
        <button
          type="button"
          onClick={() => marcarLinha(true)}
          className="text-xs font-bold text-blue-700 hover:underline mr-2"
        >
          Marcar
        </button>
        <button
          type="button"
          onClick={() => marcarLinha(false)}
          className="text-xs font-bold text-slate-500 hover:underline"
        >
          Limpar
        </button>
      </td>
    </tr>
  );
}

export default function RetencoesMatriz() {
  const { control, setValue, getValues } = useFormContext<any>();
  const { fields } = useFieldArray({ control, name: "elementos" });

  const marcarColuna = (campo: string, valor: boolean) => {
    const elementos = getValues("elementos") || [];
    elementos.forEach((_: any, i: number) => {
      setValue(`elementos.${i}.campos.${campo}`, valor, { shouldValidate: true, shouldDirty: true });
    });
  };

  return (
    <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] mb-8">
      <div className="flex items-center mb-6 pb-4 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-800">Regras por Elemento</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <caption className="sr-only">Matriz de quais impostos se aplicam a cada elemento de despesa</caption>
          <thead>
            <tr className="border-b border-slate-100">
              <th scope="col" className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest">Elemento</th>
              {CAMPOS_TRIBUTARIOS.map((campo) => (
                <th key={campo} scope="col" className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span>{ROTULOS[campo]}</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => marcarColuna(campo, true)}
                        aria-label={`Marcar ${ROTULOS[campo]} em todos os elementos`}
                        className="text-[10px] font-bold text-blue-700 hover:underline normal-case"
                      >
                        todos
                      </button>
                      <button
                        type="button"
                        onClick={() => marcarColuna(campo, false)}
                        aria-label={`Limpar ${ROTULOS[campo]} em todos os elementos`}
                        className="text-[10px] font-bold text-slate-500 hover:underline normal-case"
                      >
                        nenhum
                      </button>
                    </div>
                  </div>
                </th>
              ))}
              <th scope="col" className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => (
              <LinhaElemento key={field.id} index={index} totalLinhas={fields.length} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
