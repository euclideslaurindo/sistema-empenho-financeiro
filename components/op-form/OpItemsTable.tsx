"use client";
import { useFormContext, useFieldArray, useWatch } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { maskCurrency, parseFormNumber, formatCurrency } from "@/lib/utils";

// Componente isolado para calcular e exibir o total (evita re-render da tabela inteira)
function TotalItensInfo({ control, setValue }: { control: any, setValue: any }) {
  const wItens = useWatch({ control, name: "itens" }) || [];
  const totalItens = wItens.reduce((acc: number, item: any) => {
    return acc + (Number(item?.quantidade) || 0) * parseFormNumber(item?.valorUnitario);
  }, 0);

  const valorPg = parseFormNumber(useWatch({ control, name: "valorPagamento" }));

  const handleConfirmarItens = () => {
    if (totalItens <= 0) {
      toast.error('Preencha ao menos um item com quantidade e valor unitário.');
      return;
    }
    const formatado = maskCurrency(totalItens);
    setValue('valorPagamento', formatado as any, { shouldDirty: true, shouldValidate: true });
    toast.success(`Valor a Pagar atualizado para ${formatCurrency(totalItens)}`);
  };

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-black text-slate-500 uppercase tracking-widest">V. Total dos Itens:</span>
        <span className={`text-lg font-black ${
          totalItens !== valorPg && valorPg > 0 ? 'text-red-600' : 'text-slate-800'
        }`}>
          {formatCurrency(totalItens)}
        </span>
        {totalItens !== valorPg && valorPg > 0 && (
          <span className="text-xs text-red-500 font-bold ml-1">⚠ Deve ser exatamente igual ao Valor a Pagar</span>
        )}
      </div>
      <button
        type="button"
        onClick={handleConfirmarItens}
        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-widest px-4 py-2 rounded-lg shadow-sm transition-all flex items-center gap-2"
      >
        ✔ Confirmar Itens
      </button>
    </div>
  );
}

// Componente de Linha Isolado (evita que a digitação de um item re-renderize os outros)
function ItemRow({ field, index, remove, control, register, setValue }: any) {
  const qty = useWatch({ control, name: `itens.${index}.quantidade` }) || 0;
  const unitVal = useWatch({ control, name: `itens.${index}.valorUnitario` }) || 0;
  const total = Number(qty) * parseFormNumber(unitVal);

  return (
    <tr className="border-b border-slate-50 last:border-0">
      <td className="py-3 font-bold text-slate-400">{index + 1}</td>
      <td className="py-3 pr-2">
        <input
          type="text"
          {...register(`itens.${index}.especificacao` as const)}
          placeholder="Descrição do item"
          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:border-blue-800 transition-colors text-sm"
        />
      </td>
      <td className="py-3 pr-2">
        <input
          type="number"
          {...register(`itens.${index}.quantidade` as const)}
          onChange={(e) => {
            setValue(`itens.${index}.quantidade`, e.target.value, { shouldValidate: true, shouldDirty: true });
          }}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:border-blue-800 transition-colors text-sm"
        />
      </td>
      <td className="py-3 pr-2">
        <input
          type="text"
          {...register(`itens.${index}.unidade` as const)}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:border-blue-800 transition-colors text-sm"
        />
      </td>
      <td className="py-3 pr-2">
        <input
          type="text"
          placeholder="0,00"
          {...register(`itens.${index}.valorUnitario` as const)}
          onChange={(e) => {
            const val = maskCurrency(e.target.value);
            e.target.value = val;
            setValue(`itens.${index}.valorUnitario`, val, { shouldValidate: true, shouldDirty: true });
          }}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 focus:border-blue-800 transition-colors text-sm"
        />
      </td>
      <td className="py-3 font-bold text-slate-700">
        {formatCurrency(total)}
      </td>
      <td className="py-3 text-right">
        <button
          type="button"
          onClick={() => remove(index)}
          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}

export default function OpItemsTable() {
  const { register, control, setValue } = useFormContext<any>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: "itens"
  });



  return (
    <div className="col-span-12 mt-4">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest">Especificação do que está sendo pago</h3>
        <button
          type="button"
          onClick={() => append({ especificacao: "", quantidade: 1, unidade: "UN", valorUnitario: 0 })}
          className="bg-blue-50 text-blue-900 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> Adicionar Item
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest w-12">Item</th>
              <th className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest">Especificação</th>
              <th className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest w-24">Quant.</th>
              <th className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest w-24">Unid.</th>
              <th className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest w-32">V. Unitário</th>
              <th className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest w-32">V. Total</th>
              <th className="pb-2 w-12"></th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => (
              <ItemRow
                key={field.id}
                field={field}
                index={index}
                remove={remove}
                control={control}
                register={register}
                setValue={setValue}
              />
            ))}
          </tbody>
        </table>

        <TotalItensInfo control={control} setValue={setValue} />
      </div>
    </div>
  );
}
