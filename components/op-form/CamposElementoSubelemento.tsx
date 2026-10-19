"use client";
import { useWatch } from "react-hook-form";

// Elemento/subelemento da NE (somente leitura). São da emissão, não do credor:
// ficam sempre na raiz do formulário.
export function CamposElementoSubelemento({ control }: { control: any }) {
  const elemento = useWatch({ control, name: "elemento" });
  const subelemento = useWatch({ control, name: "subelemento" });

  return (
    <>
      <div className="col-span-12 md:col-span-4">
        <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Elemento</label>
        <input
          type="text"
          value={elemento || ''}
          disabled
          readOnly
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed transition-all duration-300"
        />
      </div>
      <div className="col-span-12 md:col-span-4">
        <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Subelemento</label>
        <input
          type="text"
          value={subelemento || ''}
          disabled
          readOnly
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed transition-all duration-300"
        />
      </div>
    </>
  );
}
