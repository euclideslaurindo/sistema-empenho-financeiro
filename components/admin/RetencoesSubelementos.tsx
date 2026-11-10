"use client";
import { useState } from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { perfilDoElemento } from "@/lib/perfis-calculo";
import { numero } from "@/lib/transporte-admin";
import { colunasDaMatriz } from "@/lib/retencoes-form";
import type { ElementoOption } from "@/hooks/use-elementos";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// B7a: exceções por subelemento. Um subelemento com "regra própria" troca a
// regra do elemento no cálculo da OP (lista vazia = nenhuma retenção, como os
// estagiários do 3.3.90.36.08). Cada linha salva sozinha, com confirmação.
// B9: cada subelemento pode ter a alíquota do IRRF pela natureza (IN RFB
// 1.234/2012, ex.: 3.3.90.39.22 Limpeza = 4,80%); vazio = alíquota padrão.

type Coluna = { campo: string; rotulo: string };
/** Os 5 tributários fixos; B12: a tela passa também as taxas "x_" percentuais. */
const COLUNAS_FIXAS: Coluna[] = colunasDaMatriz([]);

/** null = sem regra própria (segue o elemento). */
type Regra = string[] | null;

export interface SubelementoDaLista {
  codigo: string;
  descricao: string;
  elementoCodigo: string;
}

/** Subelementos que aceitam regra própria: todos, menos os do transporte (3.3.90.33). */
export function subelementosComRegra(elementos: ElementoOption[]): SubelementoDaLista[] {
  return elementos
    .filter((el) => perfilDoElemento(el.codigo) !== "TRANSPORTE_AUTONOMO")
    .flatMap((el) => (el.subelementos || []).map((s) => ({ codigo: s.codigo, descricao: s.descricao, elementoCodigo: el.codigo })));
}

export const nomesDosCampos = (campos: string[], colunas: Coluna[] = COLUNAS_FIXAS) => {
  if (campos.length === 0) return "nenhuma retenção";
  const conhecidas = colunas.filter((c) => campos.includes(c.campo)).map((c) => c.rotulo);
  const outras = campos.filter((c) => !colunas.some((k) => k.campo === c));
  return [...conhecidas, ...outras].join(", ");
};

const mesmaRegra = (a: Regra, b: Regra) =>
  a === null || b === null ? a === b : a.length === b.length && a.every((c) => b.includes(c));

/** "4.8" -> "4,8"; null -> "" (alíquota padrão). */
export const textoAliquota = (v: number | null | undefined) =>
  v === null || v === undefined ? "" : v.toLocaleString("pt-BR", { maximumFractionDigits: 4 });

/** Texto digitado -> alíquota (null = vazio) ou "invalida". */
export function lerAliquota(texto: string): number | null | "invalida" {
  if (!texto.trim()) return null;
  const v = numero(texto);
  return Number.isFinite(v) && v >= 0 && v <= 100 ? Math.round(v * 10000) / 10000 : "invalida";
}

export function descreverMudancaAliquota(codigo: string, antes: number | null, depois: number | null): string {
  const texto = (v: number | null) => (v === null ? "alíquota padrão do IRRF" : `IRRF de ${textoAliquota(v)}%`);
  return `${codigo}: ${texto(antes)} → ${texto(depois)}`;
}

/** Texto da confirmação: o que valia e o que passa a valer. */
export function descreverMudanca(
  codigo: string,
  antes: Regra,
  depois: Regra,
  regraElemento: string[],
  colunas: Coluna[] = COLUNAS_FIXAS
): string {
  const texto = (r: Regra) =>
    r === null ? `segue o elemento (${nomesDosCampos(regraElemento, colunas)})` : `regra própria: ${nomesDosCampos(r, colunas)}`;
  return `${codigo}: ${texto(antes)} → ${texto(depois)}`;
}

function LinhaSubelemento({
  sub,
  salva,
  regraElemento,
  onSalvo,
  aliquotaSalva,
  onSalvoAliquota,
  colunas = COLUNAS_FIXAS,
}: {
  colunas?: Coluna[];
  sub: SubelementoDaLista;
  salva: Regra;
  regraElemento: string[];
  onSalvo: (codigo: string, regra: Regra) => void;
  aliquotaSalva: number | null;
  onSalvoAliquota: (codigo: string, aliquota: number | null) => void;
}) {
  const [regra, setRegra] = useState<Regra>(salva);
  const [aliquotaTexto, setAliquotaTexto] = useState(textoAliquota(aliquotaSalva));
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const aliquota = lerAliquota(aliquotaTexto);
  const aliquotaInvalida = aliquota === "invalida";
  const aliquotaAlterada = !aliquotaInvalida && aliquota !== aliquotaSalva;
  const regraAlterada = !mesmaRegra(regra, salva);
  const alterada = (regraAlterada || aliquotaAlterada) && !aliquotaInvalida;
  const propria = regra !== null;
  const marcados = regra ?? [];

  const alternarCampo = (campo: string, marcado: boolean) =>
    setRegra((r) => (r === null ? r : marcado ? [...r.filter((c) => c !== campo), campo] : r.filter((c) => c !== campo)));

  const salvar = async () => {
    setSalvando(true);
    try {
      if (regraAlterada) {
        await apiClient.put("/api/configuracoes/retencoes/subelementos", { subelementoCodigo: sub.codigo, campos: regra });
      }
      if (aliquotaAlterada) {
        await apiClient.put("/api/configuracoes/retencoes/subelementos/irrf", { subelementoCodigo: sub.codigo, aliquota });
      }
      toast.success(`Regra do subelemento ${sub.codigo} salva.`);
      setConfirmando(false);
      if (aliquotaAlterada) onSalvoAliquota(sub.codigo, aliquota as number | null);
      if (regraAlterada) onSalvo(sub.codigo, regra === null ? null : colunas.map((c) => c.campo).filter((c) => regra.includes(c)));
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar a regra do subelemento.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <tr className="border-b border-slate-100 last:border-0 align-top">
      <th scope="row" className="py-3 pr-2 text-left font-bold text-slate-700">
        {sub.codigo} — {sub.descricao}
      </th>
      <td className="py-3 px-2 whitespace-nowrap">
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
          <input
            type="checkbox"
            checked={propria}
            onChange={(e) => setRegra(e.target.checked ? [] : null)}
            aria-label={`${sub.codigo} tem regra própria`}
            className="rounded text-blue-900"
          />
          Regra própria
        </label>
      </td>
      {propria ? (
        colunas.map(({ campo, rotulo }) => (
          <td key={campo} className="py-3 text-center">
            <input
              type="checkbox"
              checked={marcados.includes(campo)}
              onChange={(e) => alternarCampo(campo, e.target.checked)}
              aria-label={`${sub.codigo} aplica ${rotulo}`}
              className="rounded text-blue-900"
            />
          </td>
        ))
      ) : (
        <td colSpan={colunas.length} className="py-3 text-xs text-slate-500">
          Segue o elemento {sub.elementoCodigo}: {nomesDosCampos(regraElemento, colunas)}
        </td>
      )}
      <td className="py-3 px-2 whitespace-nowrap">
        <input
          type="text"
          inputMode="decimal"
          value={aliquotaTexto}
          onChange={(e) => setAliquotaTexto(e.target.value)}
          placeholder="padrão"
          aria-label={`${sub.codigo} alíquota do IR pela natureza (%)`}
          aria-invalid={aliquotaInvalida}
          className={`w-20 px-2 py-1 rounded-lg border text-xs font-bold text-right ${aliquotaInvalida ? "border-red-400 bg-red-50" : "border-slate-200 bg-slate-50"}`}
        />
        {aliquotaInvalida && <span className="ml-1 text-xs font-bold text-red-700">0 a 100</span>}
      </td>
      <td className="py-3 pl-2 text-right whitespace-nowrap">
        {propria && marcados.length === 0 && (
          <span className="mr-3 text-xs font-bold text-emerald-700">Sem retenções</span>
        )}
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          disabled={!alterada || salvando}
          className="text-xs font-bold text-blue-700 hover:underline disabled:text-slate-300 disabled:no-underline"
        >
          Salvar
        </button>
        <AlertDialog open={confirmando} onOpenChange={(open) => !open && setConfirmando(false)}>
          <AlertDialogContent className="max-w-lg">
            <AlertDialogTitle>Confirmar regra do subelemento</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="block mb-3 font-bold text-amber-700">Vale para todas as OPs novas. OPs já emitidas não mudam.</span>
              {regraAlterada && (
                <span className="block text-slate-700">{descreverMudanca(sub.codigo, salva, regra, regraElemento, colunas)}</span>
              )}
              {aliquotaAlterada && (
                <span className="block text-slate-700">
                  {descreverMudancaAliquota(sub.codigo, aliquotaSalva, aliquota as number | null)}
                </span>
              )}
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={salvar} disabled={salvando} className="bg-blue-900 hover:bg-blue-800">
                {salvando ? "Salvando..." : "Confirmar e salvar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </td>
    </tr>
  );
}

export default function RetencoesSubelementos({
  elementos,
  regras,
  regrasSubelemento,
  onSalvo,
  irrfSubelemento = {},
  onSalvoAliquota = () => {},
  colunas = COLUNAS_FIXAS,
}: {
  /** B12: colunas da Matriz (tributários + taxas "x_" percentuais). */
  colunas?: Coluna[];
  elementos: ElementoOption[];
  /** Regras salvas por elemento (o que o subelemento sem regra própria segue). */
  regras: Record<string, string[]>;
  regrasSubelemento: Record<string, string[]>;
  onSalvo: (codigo: string, regra: Regra) => void;
  /** B9: alíquotas do IRRF pela natureza, salvas. */
  irrfSubelemento?: Record<string, number>;
  onSalvoAliquota?: (codigo: string, aliquota: number | null) => void;
}) {
  const lista = subelementosComRegra(elementos);

  return (
    <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] mb-8">
      <div className="flex items-center mb-2 pb-4 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-800">Exceções por Subelemento</h2>
      </div>
      <p className="text-xs text-slate-500 mb-6">
        Um subelemento com <strong>regra própria</strong> usa só os impostos marcados aqui, no lugar da regra do elemento. Sem
        nada marcado, a OP sai sem retenções (ex.: estagiários). O transporte (3.3.90.33) tem cálculo próprio e não aparece aqui.
        Cada linha é salva separadamente. A <strong>alíquota do IR pela natureza</strong> (ex.: 4,8 para Limpeza) troca a
        alíquota padrão do IRRF nas OPs desse subelemento; vazio = alíquota padrão.
      </p>
      {lista.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum subelemento cadastrado. Cadastre em Configurações &gt; Elementos.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <caption className="sr-only">Regras de retenção próprias de cada subelemento</caption>
            <thead>
              <tr className="border-b border-slate-100">
                <th scope="col" className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest">Subelemento</th>
                <th scope="col" className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest">Regra</th>
                {colunas.map(({ campo, rotulo }) => (
                  <th key={campo} scope="col" className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest text-center">
                    {rotulo}
                  </th>
                ))}
                <th scope="col" className="pb-2 px-2 text-xs font-black text-slate-500 uppercase tracking-widest">IR natureza (%)</th>
                <th scope="col" className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((sub) => (
                <LinhaSubelemento
                  // A chave muda quando a regra salva muda: a linha recomeça do salvo.
                  key={`${sub.codigo}|${JSON.stringify(regrasSubelemento[sub.codigo] ?? null)}|${irrfSubelemento[sub.codigo] ?? ""}`}
                  sub={sub}
                  salva={regrasSubelemento[sub.codigo] ?? null}
                  regraElemento={regras[sub.elementoCodigo] ?? []}
                  onSalvo={onSalvo}
                  aliquotaSalva={irrfSubelemento[sub.codigo] ?? null}
                  onSalvoAliquota={onSalvoAliquota}
                  colunas={colunas}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
