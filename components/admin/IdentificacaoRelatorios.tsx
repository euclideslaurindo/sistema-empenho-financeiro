"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

const MAX = 120;
type Identificacao = { orgao: string; setor: string };

/**
 * Cabeçalho do relatório A4 das Análises (só o administrador edita). Mostra
 * uma prévia enquanto se digita; salvar só fica ativo quando há mudança.
 */
export function IdentificacaoRelatorios() {
  const [gravado, setGravado] = useState<Identificacao | null>(null);
  const [form, setForm] = useState<Identificacao>({ orgao: "", setor: "" });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    apiClient
      .get<Identificacao>("/api/configuracoes/identificacao")
      .then((d) => {
        if (cancelado) return;
        const valor = { orgao: d?.orgao ?? "", setor: d?.setor ?? "" };
        setGravado(valor);
        setForm(valor);
      })
      .catch((e: any) => !cancelado && setErro(e?.message || "Não foi possível carregar a identificação."));
    return () => {
      cancelado = true;
    };
  }, []);

  const mudou = !!gravado && (form.orgao.trim() !== gravado.orgao || form.setor.trim() !== gravado.setor);

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      const r = await apiClient.put<Identificacao>("/api/configuracoes/identificacao", { orgao: form.orgao, setor: form.setor });
      const valor = { orgao: r?.orgao ?? form.orgao.trim(), setor: r?.setor ?? form.setor.trim() };
      setGravado(valor);
      setForm(valor);
      toast.success("Identificação dos relatórios salva.");
    } catch (e: any) {
      setErro(e?.message || "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  };

  const campo = (chave: keyof Identificacao, rotulo: string, exemplo: string) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`ident-${chave}`} className="text-xs font-black uppercase tracking-widest text-slate-500">
        {rotulo}
      </label>
      <input
        id={`ident-${chave}`}
        type="text"
        maxLength={MAX}
        value={form[chave]}
        placeholder={exemplo}
        disabled={!gravado}
        onChange={(e) => setForm((f) => ({ ...f, [chave]: e.target.value }))}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-900/10 disabled:bg-slate-50"
      />
      <span className="text-right text-[11px] text-slate-400">
        {form[chave].length}/{MAX}
      </span>
    </div>
  );

  return (
    <section aria-labelledby="ident-titulo" className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:col-span-2">
      <div className="flex items-start gap-3">
        <FileText aria-hidden="true" className="mt-0.5 h-5 w-5 text-slate-600" />
        <div>
          <h3 id="ident-titulo" className="m-0 font-bold text-slate-800">
            Identificação nos relatórios
          </h3>
          <p className="m-0 mt-1 text-xs text-slate-500">Aparece no cabeçalho do relatório A4 das Análises, abaixo do brasão.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {campo("orgao", "Órgão", "Ex.: Secretaria de Educação")}
        {campo("setor", "Setor", "Ex.: Gerência Financeira")}
      </div>

      <div aria-label="Prévia do cabeçalho" className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3" data-testid="ident-previa">
        <Image src="/brasao_pernambuco.png" alt="" width={30} height={33} className="h-8 w-auto" />
        <div className="flex flex-col text-xs leading-snug text-slate-700">
          <strong className="uppercase tracking-wider">Estado de Pernambuco</strong>
          {form.orgao.trim() && <span>{form.orgao.trim()}</span>}
          {form.setor.trim() && <span>{form.setor.trim()}</span>}
        </div>
      </div>

      {erro && (
        <p role="alert" className="m-0 text-sm font-semibold text-red-700">
          {erro}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={salvar}
          disabled={!mudou || salvando}
          className="h-10 rounded-xl bg-blue-900 px-5 text-sm font-bold text-white hover:bg-blue-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </section>
  );
}
