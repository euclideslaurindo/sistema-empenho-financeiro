"use client";
import { useFormContext, useFieldArray, useWatch } from "react-hook-form";
import { colunasDaMatriz } from "@/lib/retencoes-form";

type Coluna = { campo: string; rotulo: string };

function LinhaElemento({ index, totalLinhas, colunas }: { index: number; totalLinhas: number; colunas: Coluna[] }) {
  const { register, control, setValue, getValues } = useFormContext<any>();
  const codigo: string = useWatch({ control, name: `elementos.${index}.codigo` });
  const descricao: string = useWatch({ control, name: `elementos.${index}.descricao` });
  const legado: boolean = useWatch({ control, name: `elementos.${index}.legado` });

  const marcarLinha = (valor: boolean) => {
    for (const { campo } of colunas) {
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
      {colunas.map(({ campo, rotulo }) => (
        <td key={campo} className="py-3 text-center">
          <input
            type="checkbox"
            {...register(`elementos.${index}.campos.${campo}` as const)}
            aria-label={`${codigo} aplica ${rotulo}`}
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
  // B12: colunas = tributários fixos + taxas "x_" percentuais criadas pelo ADMIN.
  const campos = useWatch({ control, name: "campos" });
  const colunas = colunasDaMatriz(campos);

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
              {colunas.map(({ campo, rotulo }) => (
                <th key={campo} scope="col" className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span>{rotulo}</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => marcarColuna(campo, true)}
                        aria-label={`Marcar ${rotulo} em todos os elementos`}
                        className="text-[10px] font-bold text-blue-700 hover:underline normal-case"
                      >
                        todos
                      </button>
                      <button
                        type="button"
                        onClick={() => marcarColuna(campo, false)}
                        aria-label={`Limpar ${rotulo} em todos os elementos`}
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
              <LinhaElemento key={field.id} index={index} totalLinhas={fields.length} colunas={colunas} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
