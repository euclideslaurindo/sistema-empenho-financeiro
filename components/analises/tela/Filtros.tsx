"use client";
import { X } from "lucide-react";
import type { ElementoOption } from "@/hooks/use-elementos";
import { MESES_LONGOS } from "@/lib/analises";
import type { BaseTela, FiltrosAnalises, PeriodoTela } from "./url";

const rotulo = "text-[11px] font-bold uppercase tracking-[0.12em] text-[#5b6678]";
const campo = "h-10 rounded-lg border border-[#c8d1de] bg-white px-2.5 text-sm text-slate-900 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber-500";

const PERIODOS: Array<[PeriodoTela, string]> = [
  ["s1", "1º semestre"],
  ["s2", "2º semestre"],
  ["ano", "Ano"],
  ["mes", "Mês"],
  ["intervalo", "Intervalo"],
];
const BASES: Array<[BaseTela, string, string]> = [
  ["civil", "Ano civil (pagamento)", "OPs pagas no período, inclusive restos a pagar de NEs de anos anteriores."],
  ["exercicio", "Exercício da NE", "Só OPs de NEs do exercício do ano."],
];

function Segmentado<T extends string>({ id, titulo, opcoes, valor, onChange }: { id: string; titulo: string; opcoes: Array<[T, string, string?]>; valor: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className={rotulo}>
        {titulo}
      </span>
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-[3px] rounded-lg border border-[#c8d1de] p-[3px]">
        {opcoes.map(([v, texto, dica]) => (
          <button
            key={v}
            type="button"
            aria-pressed={valor === v}
            title={dica}
            onClick={() => onChange(v)}
            className={`h-8 rounded-md px-3 text-[13px] font-semibold focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
              valor === v ? "bg-blue-900 text-white" : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            {texto}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FiltrosAnalisesBarra({
  filtros,
  anoExibido,
  anos,
  elementos,
  erroIntervalo,
  onChange,
}: {
  filtros: FiltrosAnalises;
  /** O ano que está na tela (o da resposta, quando o filtro ainda é "o mais recente"). */
  anoExibido: number;
  anos: number[];
  elementos: ElementoOption[];
  erroIntervalo: string | null;
  onChange: (parcial: Partial<FiltrosAnalises>) => void;
}) {
  const listaAnos = [...new Set([...anos, anoExibido])].sort((a, b) => b - a);
  const opcoesElemento = elementos.filter((e) => e.ativo && e.codigo);
  // B7b: tipos de despesa (subelementos) do elemento escolhido; sem elemento, todos, por elemento.
  const gruposTipo = opcoesElemento
    .filter((e) => !filtros.elemento || e.codigo === filtros.elemento)
    .map((e) => ({ elemento: e, subs: (e.subelementos || []).filter((s) => s.codigo) }))
    .filter((g) => g.subs.length > 0);
  const tipoNaLista = gruposTipo.some((g) => g.subs.some((s) => s.codigo === filtros.subelemento));

  return (
    <section aria-label="Filtros" className="flex flex-col gap-3 rounded-xl border border-[#dde3ec] bg-white px-6 py-5">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <Segmentado id="f-periodo" titulo="Período" opcoes={PERIODOS} valor={filtros.periodo} onChange={(periodo) => onChange({ periodo })} />

        {filtros.periodo === "intervalo" ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="f-inicio" className={rotulo}>
                De
              </label>
              <input id="f-inicio" type="date" value={filtros.inicio} onChange={(e) => onChange({ inicio: e.target.value })} aria-invalid={!!erroIntervalo} aria-describedby={erroIntervalo ? "f-intervalo-erro" : undefined} className={campo} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="f-fim" className={rotulo}>
                Até
              </label>
              <input id="f-fim" type="date" value={filtros.fim} onChange={(e) => onChange({ fim: e.target.value })} aria-invalid={!!erroIntervalo} aria-describedby={erroIntervalo ? "f-intervalo-erro" : undefined} className={campo} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="f-ano" className={rotulo}>
              Ano
            </label>
            <select id="f-ano" value={anoExibido} onChange={(e) => onChange({ ano: Number(e.target.value) })} className={`${campo} min-w-[96px]`}>
              {listaAnos.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        )}

        {filtros.periodo === "mes" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="f-mes" className={rotulo}>
              Mês
            </label>
            <select id="f-mes" value={filtros.mes ?? ""} onChange={(e) => onChange({ mes: Number(e.target.value) })} className={`${campo} min-w-[130px]`}>
              {MESES_LONGOS.map((nome, i) => (
                <option key={nome} value={i + 1}>
                  {nome}
                </option>
              ))}
            </select>
          </div>
        )}

        <Segmentado id="f-base" titulo="Base" opcoes={BASES} valor={filtros.base} onChange={(base) => onChange({ base })} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="f-elemento" className={rotulo}>
            Elemento
          </label>
          <select id="f-elemento" value={filtros.elemento} onChange={(e) => onChange({ elemento: e.target.value })} className={`${campo} min-w-[220px] max-w-full`}>
            <option value="">Todos os elementos</option>
            {opcoesElemento.map((e) => (
              <option key={e.codigo} value={e.codigo}>
                {e.codigo} {e.descricao}
              </option>
            ))}
            {filtros.elemento && !opcoesElemento.some((e) => e.codigo === filtros.elemento) && <option value={filtros.elemento}>{filtros.elemento}</option>}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="f-tipo" className={rotulo}>
            Tipo de despesa
          </label>
          <select id="f-tipo" value={filtros.subelemento} onChange={(e) => onChange({ subelemento: e.target.value })} className={`${campo} min-w-[220px] max-w-full`}>
            <option value="">Todos os tipos</option>
            {gruposTipo.map((g) => (
              <optgroup key={g.elemento.codigo} label={`${g.elemento.codigo} ${g.elemento.descricao}`}>
                {g.subs.map((s) => (
                  <option key={s.codigo} value={s.codigo}>
                    {s.codigo} {s.descricao}
                  </option>
                ))}
              </optgroup>
            ))}
            {filtros.subelemento && !tipoNaLista && <option value={filtros.subelemento}>{filtros.subelemento}</option>}
          </select>
        </div>
      </div>

      {erroIntervalo && (
        <p id="f-intervalo-erro" role="alert" className="m-0 text-sm font-semibold text-red-700">
          {erroIntervalo}
        </p>
      )}

      {(filtros.elemento || filtros.subelemento) && (
        <div className="flex flex-wrap gap-2">
          {filtros.elemento && (
            <button
              type="button"
              onClick={() => onChange({ elemento: "" })}
              aria-label={`Tirar o filtro do elemento ${filtros.elemento}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-blue-900 bg-blue-50 px-3 text-xs font-semibold text-blue-900 hover:bg-blue-100"
            >
              Elemento: {filtros.elemento}
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          )}
          {filtros.subelemento && (
            <button
              type="button"
              onClick={() => onChange({ subelemento: "" })}
              aria-label={`Tirar o filtro do tipo ${filtros.subelemento}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-blue-900 bg-blue-50 px-3 text-xs font-semibold text-blue-900 hover:bg-blue-100"
            >
              Tipo: {filtros.subelemento}
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
