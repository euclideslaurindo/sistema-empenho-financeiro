"use client";
import { paleta } from "./paleta";

export interface DadosTabela {
  /** Vira o `caption` (lido pelo leitor de tela). */
  legenda: string;
  colunas: string[];
  linhas: string[][];
}

/** A tabela do "Ver tabela": os mesmos números do gráfico. A primeira coluna é texto; as outras, números à direita. */
export function TabelaDados({ dados, id }: { dados: DadosTabela; id?: string }) {
  return (
    <div id={id} className="overflow-x-auto">
      <table className="w-full border-collapse text-sm tabular-nums">
        <caption className="sr-only">{dados.legenda}</caption>
        <thead>
          <tr>
            {dados.colunas.map((c, i) => (
              <th
                key={c}
                scope="col"
                className={`border-b py-2 text-xs font-bold ${i === 0 ? "pr-4 text-left" : "pl-4 text-right"}`}
                style={{ color: paleta.textoMudo, borderColor: "#c8d1de" }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dados.linhas.map((l, li) => (
            <tr key={li}>
              {l.map((v, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className="border-b py-1.5 pr-4 text-left font-normal" style={{ borderColor: "#eef1f6", color: paleta.texto }}>
                    {v}
                  </th>
                ) : (
                  <td key={i} className="border-b py-1.5 pl-4 text-right" style={{ borderColor: "#eef1f6", color: paleta.texto }}>
                    {v}
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
