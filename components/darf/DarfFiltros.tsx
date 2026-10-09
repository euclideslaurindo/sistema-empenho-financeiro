"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { useDebouncedCallback } from "@/hooks/use-debounce";
import { mesAtual, type Agrupamento, type FiltrosTela } from "./tipos";

const campo =
  "w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-blue-900/10 focus:border-blue-800";
const rotulo = "block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5";

export function DarfFiltros({
  filtros,
  onChange,
}: {
  filtros: FiltrosTela;
  onChange: (parcial: Partial<FiltrosTela>) => void;
}) {
  const [busca, setBusca] = useState(filtros.busca);
  const aplicarBusca = useDebouncedCallback((v: string) => onChange({ busca: v }), 400);

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
      <div className="md:col-span-3">
        <label htmlFor="darf-competencia" className={rotulo}>
          Competência
        </label>
        <div className="flex gap-2">
          <input
            id="darf-competencia"
            type="month"
            value={filtros.competencia}
            onChange={(e) => onChange({ competencia: e.target.value })}
            className={campo}
          />
          <button
            type="button"
            onClick={() => onChange({ competencia: mesAtual() })}
            className="shrink-0 px-3 rounded-xl border border-slate-200 bg-white text-xs font-black uppercase tracking-widest text-blue-900 hover:bg-blue-50"
          >
            Mês atual
          </button>
        </div>
      </div>

      <div className="md:col-span-2">
        <label htmlFor="darf-status" className={rotulo}>
          Status
        </label>
        <select
          id="darf-status"
          value={filtros.status}
          onChange={(e) => onChange({ status: e.target.value as FiltrosTela["status"] })}
          className={campo}
        >
          <option value="">Todos</option>
          <option value="PENDENTE">Pendente</option>
          <option value="PAGA">Paga</option>
        </select>
      </div>

      <div className="md:col-span-4">
        <label htmlFor="darf-busca" className={rotulo}>
          Buscar
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            id="darf-busca"
            type="search"
            value={busca}
            placeholder="Credor, CPF/CNPJ, NE ou OP"
            onChange={(e) => {
              setBusca(e.target.value);
              aplicarBusca(e.target.value);
            }}
            className={`${campo} pl-10`}
          />
        </div>
      </div>

      <div className="md:col-span-3">
        <span id="darf-agrupar-rotulo" className={rotulo}>
          Visualizar
        </span>
        <div role="radiogroup" aria-labelledby="darf-agrupar-rotulo" className="flex rounded-xl border border-slate-200 bg-white p-1">
          {(
            [
              ["op", "Por OP"],
              ["credor", "Por credor"],
            ] as Array<[Agrupamento, string]>
          ).map(([valor, texto]) => {
            const ativo = filtros.agrupar === valor;
            return (
              <button
                key={valor}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => onChange({ agrupar: valor })}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-widest ${
                  ativo ? "bg-blue-900 text-white" : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                {texto}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
