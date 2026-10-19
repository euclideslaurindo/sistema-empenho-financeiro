"use client";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useDebouncedCallback } from "@/hooks/use-debounce";
import { useListboxKeyboardNav } from "@/hooks/use-listbox-keyboard-nav";
import { rotuloMunicipio } from "@/lib/credor-endereco";
import type { CredorApi } from "@/lib/op-emissao";

type CredorSugestao = CredorApi & { id: string; cidade?: string | null; uf?: string | null };

/** "Adicionar credor": busca no cadastro por nome ou CPF/CNPJ (T35-B). */
export function CredorBusca({ onEscolher, desabilitado }: { onEscolher: (credor: CredorApi) => void; desabilitado?: boolean }) {
  const [texto, setTexto] = useState("");
  const [sugestoes, setSugestoes] = useState<CredorSugestao[]>([]);
  const [aberto, setAberto] = useState(false);

  const buscar = useDebouncedCallback(async (val: string) => {
    try {
      const data = await apiClient.get<{ credores: CredorSugestao[] }>(`/api/credores?busca=${encodeURIComponent(val)}&limit=8`);
      setSugestoes(data?.credores || []);
      setAberto(true);
    } catch {
      setSugestoes([]);
    }
  }, 350);

  const escolher = (c: CredorSugestao) => {
    onEscolher(c);
    setTexto("");
    setSugestoes([]);
    setAberto(false);
  };
  const nav = useListboxKeyboardNav(sugestoes, escolher);

  const onChange = (val: string) => {
    setTexto(val);
    const digitos = val.replace(/\D/g, "");
    if (val.trim().length >= 2 || digitos.length >= 4) buscar(val);
    else {
      setSugestoes([]);
      setAberto(false);
    }
  };

  return (
    <div className="relative">
      <label htmlFor="op-adicionar-credor" className="flex items-center gap-2 text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
        <UserPlus className="w-4 h-4" /> Adicionar credor
      </label>
      <input
        id="op-adicionar-credor"
        type="text"
        value={texto}
        disabled={desabilitado}
        placeholder={desabilitado ? "Carregue a NE para adicionar credores" : "Nome ou CPF/CNPJ do credor"}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTimeout(() => setAberto(false), 200)}
        onFocus={() => sugestoes.length > 0 && setAberto(true)}
        onKeyDown={nav.onKeyDown}
        role="combobox"
        aria-expanded={aberto && sugestoes.length > 0}
        aria-controls="op-credor-sugestoes"
        aria-activedescendant={nav.highlightedIndex >= 0 ? `op-credor-opcao-${nav.highlightedIndex}` : undefined}
        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-blue-800 transition-all duration-300 disabled:opacity-60"
      />
      {aberto && sugestoes.length > 0 && (
        <div id="op-credor-sugestoes" role="listbox" className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-xl border border-slate-100 max-h-64 overflow-y-auto">
          {sugestoes.map((c, i) => (
            <div
              key={c.id}
              id={`op-credor-opcao-${i}`}
              role="option"
              aria-selected={nav.highlightedIndex === i}
              onMouseDown={() => escolher(c)}
              onMouseEnter={() => nav.setHighlightedIndex(i)}
              className={`p-3 cursor-pointer border-b border-slate-50 last:border-0 transition-colors ${nav.highlightedIndex === i ? "bg-blue-50" : "hover:bg-blue-50"}`}
            >
              <div className="font-bold text-slate-800 text-sm">
                {c.nome}
                {Number(c.isMei ?? c.is_mei) ? <span className="text-emerald-600 ml-1 font-black text-xs uppercase bg-emerald-100 px-1 rounded">MEI</span> : null}
              </div>
              <div className="text-xs text-slate-500">
                {c.cpfCnpj || c.cpf_cnpj}
                {rotuloMunicipio(c.cidade, c.uf) && ` · ${rotuloMunicipio(c.cidade, c.uf)}`}
                {c.municipioExpediente && ` · expediente: ${c.municipioExpediente}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
