"use client";
import { useState } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { Save, Search, Trash2, Users } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { maskCurrency } from "@/lib/utils";
import { formatarBRL, toCents } from "@/lib/money";
import { diferencaBrutos, dividirIgualmente, somenteDigitos, type CredorFormulario } from "@/lib/ne-credores";
import { useListboxKeyboardNav } from "@/hooks/use-listbox-keyboard-nav";
import { useDebouncedCallback } from "@/hooks/use-debounce";
import { rotuloMunicipio } from "@/lib/credor-endereco";

interface CredorCadastro {
  id: string;
  cpfCnpj: string;
  nome: string;
  cidade?: string | null;
  uf?: string | null;
  isMei?: number | boolean | null;
}

const ID_BUSCA = "ne-credores-busca";
const idBruto = (i: number) => `ne-credor-bruto-${i}`;

function BuscaCredor({
  jaAdicionados,
  onAdicionar,
}: {
  jaAdicionados: Set<string>;
  onAdicionar: (c: CredorCadastro) => void;
}) {
  const [termo, setTermo] = useState("");
  const [sugestoes, setSugestoes] = useState<CredorCadastro[]>([]);
  const [aberto, setAberto] = useState(false);

  const buscar = useDebouncedCallback(async (valor: string) => {
    try {
      const data = await apiClient.get<{ credores: CredorCadastro[] }>(
        `/api/credores?busca=${encodeURIComponent(valor)}&limit=8`
      );
      setSugestoes(data?.credores || []);
      setAberto(true);
    } catch {
      setSugestoes([]);
    }
  }, 350);

  const repetido = (c: CredorCadastro) => jaAdicionados.has(somenteDigitos(c.cpfCnpj));

  const selecionar = (c: CredorCadastro) => {
    if (repetido(c)) return;
    onAdicionar(c);
    setTermo("");
    setSugestoes([]);
    setAberto(false);
  };

  const nav = useListboxKeyboardNav(sugestoes, selecionar);
  const listaVisivel = aberto && sugestoes.length > 0;

  return (
    <div className="relative">
      <label htmlFor={ID_BUSCA} className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
        Adicionar credor
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          id={ID_BUSCA}
          type="text"
          value={termo}
          placeholder="Buscar por nome ou CPF/CNPJ"
          autoComplete="off"
          role="combobox"
          aria-expanded={listaVisivel}
          aria-controls="ne-credores-listbox"
          aria-activedescendant={nav.highlightedIndex >= 0 ? `ne-credor-opcao-${nav.highlightedIndex}` : undefined}
          onChange={(e) => {
            const v = e.target.value;
            setTermo(v);
            nav.reset();
            if (v.trim().length >= 2) buscar(v.trim());
            else {
              setSugestoes([]);
              setAberto(false);
            }
          }}
          onKeyDown={nav.onKeyDown}
          onBlur={() => setTimeout(() => setAberto(false), 200)}
          onFocus={() => sugestoes.length > 0 && setAberto(true)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10 transition-all duration-300"
        />
      </div>
      {listaVisivel && (
        <div
          id="ne-credores-listbox"
          role="listbox"
          className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 max-h-60 overflow-y-auto"
        >
          {sugestoes.map((c, i) => {
            const jaTem = repetido(c);
            return (
              <div
                key={c.id}
                id={`ne-credor-opcao-${i}`}
                role="option"
                aria-selected={nav.highlightedIndex === i}
                aria-disabled={jaTem}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selecionar(c)}
                onMouseEnter={() => nav.setHighlightedIndex(i)}
                className={`p-3 border-b border-slate-50 last:border-0 ${
                  jaTem ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                } ${nav.highlightedIndex === i ? "bg-blue-50" : "hover:bg-blue-50"}`}
              >
                <div className="font-bold text-slate-700">{c.nome}</div>
                <div className="text-xs text-slate-500">
                  {c.cpfCnpj}
                  {rotuloMunicipio(c.cidade, c.uf) && ` · ${rotuloMunicipio(c.cidade, c.uf)}`}
                  {jaTem && " · já adicionado"}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BarraConferencia() {
  const { control } = useFormContext<any>();
  const credores: CredorFormulario[] = useWatch({ control, name: "credores" }) || [];
  const valorNE = useWatch({ control, name: "valorNE" });
  const d = diferencaBrutos(credores.map((c) => c?.valorBruto), valorNE);
  const ok = d.diferencaCents === 0 && credores.length > 0;

  return (
    <div
      aria-live="polite"
      data-testid="barra-conferencia"
      className={`mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border px-4 py-3 text-sm font-bold ${
        ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"
      }`}
    >
      <span>Soma dos brutos R$ {formatarBRL(d.somaCents)}</span>
      <span>Valor da NE R$ {formatarBRL(d.valorCents)}</span>
      <span data-testid="diferenca-brutos">{credores.length === 0 ? "Adicione ao menos um credor" : d.texto}</span>
    </div>
  );
}

function LinhaCredor({ index, onRemover }: { index: number; onRemover: (index: number) => void }) {
  const { control, register, setValue } = useFormContext<any>();
  const credor: CredorFormulario = useWatch({ control, name: `credores.${index}` });
  if (!credor) return null;

  const pagoCents = toCents(credor.valorPago ?? 0);
  const temOp = pagoCents > 0;
  const dicaId = `ne-credor-dica-${index}`;

  return (
    <li className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="md:col-span-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-slate-800">{credor.nome || "(sem nome)"}</span>
          {credor.isMei && (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-violet-700">
              MEI
            </span>
          )}
        </div>
        <div className="text-xs font-semibold text-slate-500">
          {credor.cpfCnpj}
          {credor.municipio ? ` · ${credor.municipio}` : ""}
        </div>
        {(temOp || credor.legado) && (
          <p id={dicaId} className="mt-1 text-xs font-semibold text-amber-700">
            {temOp && `Já recebeu R$ ${formatarBRL(pagoCents)} em OP (mín. R$ ${formatarBRL(pagoCents)}). `}
            {credor.legado && "Credor não verificado no cadastro."}
          </p>
        )}
      </div>
      <div className="md:col-span-4">
        <label htmlFor={idBruto(index)} className="sr-only">
          Valor bruto de {credor.nome}
        </label>
        <input
          id={idBruto(index)}
          type="text"
          inputMode="numeric"
          placeholder="Valor bruto"
          aria-describedby={temOp || credor.legado ? dicaId : undefined}
          {...register(`credores.${index}.valorBruto`)}
          onChange={(e) => {
            const masked = maskCurrency(e.target.value);
            e.target.value = masked;
            setValue(`credores.${index}.valorBruto`, masked, { shouldDirty: true });
          }}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-black text-slate-800 focus:outline-none focus:ring-4 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10"
        />
      </div>
      <div className="md:col-span-2 flex justify-end">
        <button
          type="button"
          onClick={() => onRemover(index)}
          disabled={temOp}
          aria-label={`Remover ${credor.nome}`}
          title={temOp ? "Credor com OP emitida nesta NE não pode ser removido" : "Remover credor"}
          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-400"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </li>
  );
}

export function NeCredoresField() {
  const { control, getValues, setValue } = useFormContext<any>();
  const { fields, append, remove } = useFieldArray({ control, name: "credores" });

  // cpfCnpj de uma linha nunca muda depois de adicionada, então `fields` basta.
  const jaAdicionados = new Set(fields.map((f: any) => somenteDigitos(f.cpfCnpj)));

  const adicionar = (c: CredorCadastro) => {
    append({
      cpfCnpj: c.cpfCnpj,
      nome: c.nome,
      valorBruto: "",
      valorPago: 0,
      doCadastro: true,
      isMei: !!Number(c.isMei),
      municipio: rotuloMunicipio(c.cidade, c.uf) || undefined,
    } satisfies CredorFormulario);
    setTimeout(() => document.getElementById(idBruto(fields.length))?.focus(), 0);
  };

  const remover = (index: number) => {
    remove(index);
    setTimeout(() => {
      const alvo = index > 0 ? document.getElementById(idBruto(index - 1)) : document.getElementById(ID_BUSCA);
      alvo?.focus();
    }, 0);
  };

  const dividir = () => {
    const partes = dividirIgualmente(toCents(getValues("valorNE")), fields.length);
    partes.forEach((cents, i) => setValue(`credores.${i}.valorBruto`, cents > 0 ? maskCurrency(cents / 100) : "", { shouldDirty: true }));
  };

  return (
    <section aria-labelledby="ne-credores-titulo" className="md:col-span-4">
      <div className="flex items-center justify-between mb-3">
        <h3 id="ne-credores-titulo" className="flex items-center gap-2 text-sm font-black text-slate-500 uppercase tracking-widest">
          <Users className="w-4 h-4" /> Credores
        </h3>
        {fields.length >= 2 && (
          <button
            type="button"
            onClick={dividir}
            className="text-xs font-black uppercase tracking-widest text-blue-900 hover:underline"
          >
            Dividir igualmente
          </button>
        )}
      </div>

      <BuscaCredor jaAdicionados={jaAdicionados} onAdicionar={adicionar} />

      {fields.length === 0 ? (
        <p className="mt-4 text-sm font-semibold text-slate-400">Adicione ao menos um credor.</p>
      ) : (
        <ul className="mt-4 space-y-2" aria-label="Credores da NE">
          {fields.map((f, i) => (
            <LinhaCredor key={f.id} index={i} onRemover={remover} />
          ))}
        </ul>
      )}

      <BarraConferencia />
    </section>
  );
}

/** Salvar isolado: só ele re-renderiza com a soma; fica desabilitado até fechar. */
export function BotaoSalvarNe({ onClick, className }: { onClick: () => void; className?: string }) {
  const { control } = useFormContext<any>();
  const credores: CredorFormulario[] = useWatch({ control, name: "credores" }) || [];
  const valorNE = useWatch({ control, name: "valorNE" });
  const d = diferencaBrutos(credores.map((c) => c?.valorBruto), valorNE);
  const motivo =
    credores.length === 0 ? "Adicione ao menos um credor." : d.diferencaCents !== 0 ? `A soma dos brutos não fecha: ${d.texto}.` : null;

  return (
    <button type="button" onClick={onClick} disabled={!!motivo} title={motivo ?? undefined} className={className}>
      <Save className="w-4 h-4" /> Salvar
    </button>
  );
}
