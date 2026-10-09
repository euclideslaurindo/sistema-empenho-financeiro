"use client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Save } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { diffMunicipio, numero, validarMunicipio, type MunicipioEdicao } from "@/lib/transporte-admin";
import ConfirmarDiffDialog from "@/components/admin/ConfirmarDiffDialog";
import { paraCampo, type IssMunicipioAdmin } from "@/components/admin/transporte-tipos";

interface Props {
  municipios: IssMunicipioAdmin[];
  onSalvo: () => void;
  onDirtyChange: (dirty: boolean) => void;
}

const paraEdicao = (m: IssMunicipioAdmin): MunicipioEdicao => ({
  nome: m.nome,
  uf: m.uf,
  aliquota: paraCampo(m.aliquota),
  taxaExpediente: paraCampo(m.taxaExpediente),
  apelidos: m.apelidos ?? "",
  ativo: m.ativo,
});
const NOVO_VAZIO: MunicipioEdicao = { nome: "", uf: "PE", aliquota: "5", taxaExpediente: "0", apelidos: "", ativo: true };

type Pendente = { tipo: "novo"; dados: MunicipioEdicao } | { tipo: "editar"; chave: string; dados: MunicipioEdicao };

/** Quem usa remonta o componente (key) quando os dados são recarregados. */
export default function IssMunicipiosTable({ municipios, onSalvo, onDirtyChange }: Props) {
  const [edicoes, setEdicoes] = useState<Record<string, MunicipioEdicao>>(() =>
    Object.fromEntries(municipios.map((m) => [m.chave, paraEdicao(m)]))
  );
  const [novo, setNovo] = useState<MunicipioEdicao | null>(null);
  const [busca, setBusca] = useState("");
  const [pendente, setPendente] = useState<Pendente | null>(null);
  const [diff, setDiff] = useState<string[] | null>(null);
  const [salvando, setSalvando] = useState(false);

  const originais = useMemo(() => new Map(municipios.map((m) => [m.chave, paraEdicao(m)])), [municipios]);
  const alteradas = useMemo(
    () => new Set(Object.entries(edicoes).filter(([chave, e]) => {
      const o = originais.get(chave);
      return o && diffMunicipio(o, e).length > 0;
    }).map(([chave]) => chave)),
    [edicoes, originais]
  );
  const dirty = alteradas.size > 0 || !!novo?.nome.trim();
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const visiveis = municipios.filter((m) => {
    const termo = busca.trim().toLowerCase();
    return !termo || m.nome.toLowerCase().includes(termo) || (m.apelidos ?? "").includes(termo);
  });

  const alterar = (chave: string, campo: keyof MunicipioEdicao, valor: string | boolean) =>
    setEdicoes((ed) => ({ ...ed, [chave]: { ...ed[chave], [campo]: valor } }));

  const pedirSalvar = (p: Pendente) => {
    const erros = validarMunicipio(p.dados);
    if (erros.length > 0) {
      toast.error(erros.join(" "));
      return;
    }
    const linhas = p.tipo === "novo" ? diffMunicipio(null, p.dados) : diffMunicipio(originais.get(p.chave)!, p.dados);
    if (linhas.length === 0) {
      toast.info("Nada para salvar.");
      return;
    }
    setPendente(p);
    setDiff(linhas);
  };

  const confirmar = async () => {
    if (!pendente) return;
    const d = pendente.dados;
    const corpo = {
      nome: d.nome,
      uf: d.uf,
      aliquota: numero(d.aliquota),
      taxaExpediente: numero(d.taxaExpediente),
      apelidos: d.apelidos,
      ativo: d.ativo,
    };
    setSalvando(true);
    try {
      if (pendente.tipo === "novo") {
        await apiClient.post("/api/configuracoes/iss-municipios", corpo);
        setNovo(null);
      } else {
        await apiClient.put("/api/configuracoes/iss-municipios", { ...corpo, chave: pendente.chave });
      }
      toast.success("Município salvo. Vale a partir da próxima OP.");
      setDiff(null);
      setPendente(null);
      onSalvo();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar o município.");
    } finally {
      setSalvando(false);
    }
  };

  const input = "w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold";

  return (
    <section className="bg-white border border-slate-200 p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2 pb-4 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-800">ISS por município</h2>
        <div className="flex items-center gap-2">
          <input
            aria-label="Buscar município"
            placeholder="Buscar município"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm"
          />
          {!novo && (
            <button
              type="button"
              onClick={() => setNovo({ ...NOVO_VAZIO })}
              className="text-sm font-bold text-blue-900 border border-blue-200 hover:bg-blue-50 px-3 py-2 rounded-xl flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Incluir município
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Sem vigência: a mudança vale a partir da próxima OP. Apelidos separados por &quot;;&quot; (grafias usadas no
        cadastro do credor). Para tirar de uso, desative em vez de apagar.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-black text-slate-500 uppercase tracking-widest">
              <th className="py-2 pr-2">Município</th>
              <th className="py-2 pr-2 w-16">UF</th>
              <th className="py-2 pr-2 w-24">ISS (%)</th>
              <th className="py-2 pr-2 w-28">Expediente (R$)</th>
              <th className="py-2 pr-2">Apelidos</th>
              <th className="py-2 pr-2 w-16">Ativo</th>
              <th className="py-2 w-24" />
            </tr>
          </thead>
          <tbody>
            {novo && (
              <tr className="border-t border-slate-100 bg-blue-50/40">
                <td className="py-2 pr-2">
                  <input aria-label="Nome do novo município" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} className={input} />
                </td>
                <td className="py-2 pr-2">
                  <input aria-label="UF do novo município" maxLength={2} value={novo.uf} onChange={(e) => setNovo({ ...novo, uf: e.target.value })} className={input} />
                </td>
                <td className="py-2 pr-2">
                  <input aria-label="ISS do novo município" inputMode="decimal" value={String(novo.aliquota)} onChange={(e) => setNovo({ ...novo, aliquota: e.target.value })} className={input} />
                </td>
                <td className="py-2 pr-2">
                  <input aria-label="Expediente do novo município" inputMode="decimal" value={String(novo.taxaExpediente)} onChange={(e) => setNovo({ ...novo, taxaExpediente: e.target.value })} className={input} />
                </td>
                <td className="py-2 pr-2">
                  <input aria-label="Apelidos do novo município" value={novo.apelidos ?? ""} onChange={(e) => setNovo({ ...novo, apelidos: e.target.value })} className={input} />
                </td>
                <td className="py-2 pr-2" />
                <td className="py-2 flex gap-1">
                  <button type="button" onClick={() => pedirSalvar({ tipo: "novo", dados: novo })} className="text-blue-900 font-bold px-2 py-1.5 rounded-lg hover:bg-blue-100">
                    Incluir
                  </button>
                  <button type="button" onClick={() => setNovo(null)} className="text-slate-500 font-bold px-2 py-1.5 rounded-lg hover:bg-slate-100">
                    Cancelar
                  </button>
                </td>
              </tr>
            )}
            {visiveis.map((m) => {
              const e = edicoes[m.chave];
              if (!e) return null;
              const alterada = alteradas.has(m.chave);
              return (
                <tr key={m.chave} className={`border-t border-slate-100 ${e.ativo ? "" : "opacity-60"}`}>
                  <td className="py-2 pr-2 font-bold text-slate-700">{m.nome}</td>
                  <td className="py-2 pr-2">
                    <input aria-label={`UF de ${m.nome}`} maxLength={2} value={e.uf} onChange={(ev) => alterar(m.chave, "uf", ev.target.value)} className={input} />
                  </td>
                  <td className="py-2 pr-2">
                    <input aria-label={`ISS de ${m.nome}`} inputMode="decimal" value={String(e.aliquota)} onChange={(ev) => alterar(m.chave, "aliquota", ev.target.value)} className={input} />
                  </td>
                  <td className="py-2 pr-2">
                    <input aria-label={`Expediente de ${m.nome}`} inputMode="decimal" value={String(e.taxaExpediente)} onChange={(ev) => alterar(m.chave, "taxaExpediente", ev.target.value)} className={input} />
                  </td>
                  <td className="py-2 pr-2">
                    <input aria-label={`Apelidos de ${m.nome}`} value={e.apelidos ?? ""} onChange={(ev) => alterar(m.chave, "apelidos", ev.target.value)} className={input} />
                  </td>
                  <td className="py-2 pr-2">
                    <input type="checkbox" aria-label={`${m.nome} ativo`} checked={e.ativo} onChange={(ev) => alterar(m.chave, "ativo", ev.target.checked)} className="w-4 h-4" />
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      aria-label={`Salvar ${m.nome}`}
                      disabled={!alterada || salvando}
                      onClick={() => pedirSalvar({ tipo: "editar", chave: m.chave, dados: e })}
                      className="text-blue-900 font-bold px-2 py-1.5 rounded-lg hover:bg-blue-100 flex items-center gap-1 disabled:opacity-30"
                    >
                      <Save className="w-4 h-4" /> Salvar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmarDiffDialog
        linhas={diff}
        salvando={salvando}
        onConfirmar={confirmar}
        onCancelar={() => {
          setDiff(null);
          setPendente(null);
        }}
      />
    </section>
  );
}
