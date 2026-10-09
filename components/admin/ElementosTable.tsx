"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, ChevronDown, ChevronRight, Search } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { invalidateElementosCache } from "@/hooks/use-elementos";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const CAMPOS_TRIBUTARIOS = ["irrf", "iss", "inss", "patronal", "sest_senat"];
const ROTULOS: Record<string, string> = { irrf: "IRRF", iss: "ISS", inss: "INSS", patronal: "Patronal", sest_senat: "SEST/SENAT" };
const CODIGO_REGEX = /^\d(?:\.\d+)+$/;

interface ElementoItem {
  codigo: string;
  descricao: string;
  legado: boolean;
  ativo: boolean;
  ordem: number;
  retencoes: string[];
}
interface SubelementoItem {
  codigo: string;
  elementoCodigo: string;
  descricao: string;
  ativo: boolean;
  ordem: number;
}

function LinhaSubelemento({
  sub,
  onSalvar,
  onToggleAtivo,
}: {
  sub: SubelementoItem;
  onSalvar: (descricao: string, ordem: number) => void;
  onToggleAtivo: () => void;
}) {
  const [descricao, setDescricao] = useState(sub.descricao);
  const [ordem, setOrdem] = useState(sub.ordem);
  const sujo = descricao !== sub.descricao || ordem !== sub.ordem;

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-2 pr-2 text-sm font-bold text-slate-600">{sub.codigo}</td>
      <td className="py-2 pr-2">
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          aria-label={`Descrição do subelemento ${sub.codigo}`}
          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-sm"
        />
      </td>
      <td className="py-2 pr-2">
        <input
          type="number"
          value={ordem}
          onChange={(e) => setOrdem(Number(e.target.value))}
          aria-label={`Ordem do subelemento ${sub.codigo}`}
          className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-sm"
        />
      </td>
      <td className="py-2 pr-2 text-center">
        <input
          type="checkbox"
          checked={sub.ativo}
          onChange={onToggleAtivo}
          aria-label={`${sub.codigo} ativo`}
          className="rounded text-blue-900"
        />
      </td>
      <td className="py-2 text-right">
        {sujo && (
          <button type="button" onClick={() => onSalvar(descricao, ordem)} className="text-xs font-bold text-blue-700 hover:underline">
            Salvar
          </button>
        )}
      </td>
    </tr>
  );
}

function NovoSubelementoForm({ elementoCodigo, onCriar }: { elementoCodigo: string; onCriar: (codigo: string, descricao: string, ordem: number) => void }) {
  const [codigo, setCodigo] = useState(`${elementoCodigo}.`);
  const [descricao, setDescricao] = useState("");
  const [ordem, setOrdem] = useState(0);

  const valido = CODIGO_REGEX.test(codigo) && codigo.startsWith(`${elementoCodigo}.`) && descricao.trim().length > 0;

  return (
    <div className="flex flex-wrap items-end gap-2 pt-3 border-t border-slate-200 mt-2">
      <div>
        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Código</label>
        <input value={codigo} onChange={(e) => setCodigo(e.target.value)} className="px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-sm w-40" />
      </div>
      <div className="flex-1 min-w-[160px]">
        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Descrição</label>
        <input value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-sm" />
      </div>
      <div>
        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Ordem</label>
        <input type="number" value={ordem} onChange={(e) => setOrdem(Number(e.target.value))} className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-sm" />
      </div>
      <button
        type="button"
        disabled={!valido}
        onClick={() => {
          onCriar(codigo, descricao, ordem);
          setCodigo(`${elementoCodigo}.`);
          setDescricao("");
          setOrdem(0);
        }}
        className="bg-blue-50 text-blue-900 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-1"
      >
        <Plus className="w-3 h-3" /> Novo subelemento
      </button>
    </div>
  );
}

function LinhaElemento({
  elemento,
  subelementosDoElemento,
  expandido,
  onToggleExpandir,
  onSalvar,
  onToggleAtivo,
  onSalvarSub,
  onToggleAtivoSub,
  onCriarSub,
}: {
  elemento: ElementoItem;
  subelementosDoElemento: SubelementoItem[];
  expandido: boolean;
  onToggleExpandir: () => void;
  onSalvar: (descricao: string, ordem: number) => void;
  onToggleAtivo: () => void;
  onSalvarSub: (codigo: string, descricao: string, ordem: number) => void;
  onToggleAtivoSub: (codigo: string, ativo: boolean) => void;
  onCriarSub: (codigo: string, descricao: string, ordem: number) => void;
}) {
  const [descricao, setDescricao] = useState(elemento.descricao);
  const [ordem, setOrdem] = useState(elemento.ordem);
  const sujo = descricao !== elemento.descricao || ordem !== elemento.ordem;

  return (
    <>
      <tr className="border-b border-slate-100 last:border-0">
        <td className="py-3 pr-2">
          <button type="button" onClick={onToggleExpandir} className="flex items-center gap-1 text-slate-600 font-bold" aria-expanded={expandido}>
            {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            {elemento.codigo}
          </button>
        </td>
        <td className="py-3 pr-2">
          <input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            aria-label={`Descrição de ${elemento.codigo}`}
            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-sm"
          />
        </td>
        <td className="py-3 pr-2">
          <input
            type="number"
            value={ordem}
            onChange={(e) => setOrdem(Number(e.target.value))}
            aria-label={`Ordem de ${elemento.codigo}`}
            className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-sm"
          />
        </td>
        <td className="py-3 pr-2 text-center">
          {elemento.legado && (
            <span className="text-xs font-black uppercase tracking-widest bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded-full">
              legado
            </span>
          )}
        </td>
        <td className="py-3 pr-2 text-center">
          <input
            type="checkbox"
            checked={elemento.ativo}
            onChange={onToggleAtivo}
            aria-label={`${elemento.codigo} ativo`}
            className="rounded text-blue-900"
          />
        </td>
        <td className="py-3 text-right">
          {sujo && (
            <button type="button" onClick={() => onSalvar(descricao, ordem)} className="text-xs font-bold text-blue-700 hover:underline">
              Salvar
            </button>
          )}
        </td>
      </tr>
      {expandido && (
        <tr>
          <td colSpan={6} className="bg-slate-50/60 px-4 py-3">
            {subelementosDoElemento.length === 0 ? (
              <p className="text-xs text-slate-500">Nenhum subelemento cadastrado.</p>
            ) : (
              <table className="w-full text-sm text-left">
                <thead>
                  <tr>
                    <th scope="col" className="pb-1 text-[10px] font-black text-slate-500 uppercase tracking-widest">Código</th>
                    <th scope="col" className="pb-1 text-[10px] font-black text-slate-500 uppercase tracking-widest">Descrição</th>
                    <th scope="col" className="pb-1 text-[10px] font-black text-slate-500 uppercase tracking-widest">Ordem</th>
                    <th scope="col" className="pb-1 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Ativo</th>
                    <th scope="col" className="pb-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {subelementosDoElemento.map((sub) => (
                    <LinhaSubelemento
                      key={sub.codigo}
                      sub={sub}
                      onSalvar={(descricao, ordem) => onSalvarSub(sub.codigo, descricao, ordem)}
                      onToggleAtivo={() => onToggleAtivoSub(sub.codigo, sub.ativo)}
                    />
                  ))}
                </tbody>
              </table>
            )}
            <NovoSubelementoForm elementoCodigo={elemento.codigo} onCriar={onCriarSub} />
          </td>
        </tr>
      )}
    </>
  );
}

function ModalNovoElemento({
  aberto,
  onFechar,
  onCriar,
}: {
  aberto: boolean;
  onFechar: () => void;
  onCriar: (dados: { codigo: string; descricao: string; ordem: number; camposMarcados: string[] }) => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ordem, setOrdem] = useState(0);
  const [campos, setCampos] = useState<Record<string, boolean>>({});

  const valido = CODIGO_REGEX.test(codigo) && descricao.trim().length > 0;

  const limpar = () => {
    setCodigo("");
    setDescricao("");
    setOrdem(0);
    setCampos({});
  };

  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && onFechar()}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Novo elemento</DialogTitle>
        <DialogDescription>O código não pode ser alterado depois de criado.</DialogDescription>
        <div className="space-y-4">
          <div>
            <label htmlFor="novo-elemento-codigo" className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">
              Código
            </label>
            <input
              id="novo-elemento-codigo"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="3.3.90.99"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold"
            />
          </div>
          <div>
            <label htmlFor="novo-elemento-descricao" className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">
              Descrição
            </label>
            <input
              id="novo-elemento-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm"
            />
          </div>
          <div>
            <label htmlFor="novo-elemento-ordem" className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1">
              Ordem
            </label>
            <input
              id="novo-elemento-ordem"
              type="number"
              value={ordem}
              onChange={(e) => setOrdem(Number(e.target.value))}
              className="w-24 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm"
            />
          </div>
          <div>
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Quais impostos se aplicam?</p>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
              Elemento novo não aplica nenhum imposto até você marcar aqui.
            </p>
            <div className="flex flex-wrap gap-4">
              {CAMPOS_TRIBUTARIOS.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={!!campos[c]}
                    onChange={(e) => setCampos((prev) => ({ ...prev, [c]: e.target.checked }))}
                    aria-label={`Novo elemento aplica ${ROTULOS[c]}`}
                    className="rounded text-blue-900"
                  />
                  {ROTULOS[c]}
                </label>
              ))}
            </div>
          </div>
          <button
            type="button"
            disabled={!valido}
            onClick={() => {
              onCriar({ codigo, descricao, ordem, camposMarcados: CAMPOS_TRIBUTARIOS.filter((c) => campos[c]) });
              limpar();
            }}
            className="w-full bg-blue-900 hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold py-2.5 rounded-xl transition-colors"
          >
            Criar elemento
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ElementosTable() {
  const [elementos, setElementos] = useState<ElementoItem[]>([]);
  const [subelementos, setSubelementos] = useState<SubelementoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [expandido, setExpandido] = useState<Set<string>>(new Set());
  const [modalAberto, setModalAberto] = useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const [elData, subData] = await Promise.all([
        apiClient.get<{ elementos: ElementoItem[] }>("/api/elementos?incluirInativos=1"),
        apiClient.get<{ subelementos: SubelementoItem[] }>("/api/subelementos?incluirInativos=1"),
      ]);
      setElementos(elData.elementos || []);
      setSubelementos(subData.subelementos || []);
    } catch (err: any) {
      toast.error(err.message || "Erro ao carregar elementos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const elementosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return elementos;
    return elementos.filter((e) => e.codigo.toLowerCase().includes(termo) || e.descricao.toLowerCase().includes(termo));
  }, [elementos, busca]);

  const toggleExpandido = (codigo: string) => {
    setExpandido((prev) => {
      const next = new Set(prev);
      if (next.has(codigo)) next.delete(codigo);
      else next.add(codigo);
      return next;
    });
  };

  const salvarEdicaoElemento = async (codigo: string, descricao: string, ordem: number) => {
    try {
      await apiClient.put(`/api/elementos/${codigo}`, { descricao, ordem });
      toast.success("Elemento atualizado.");
      invalidateElementosCache();
      carregar();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar elemento.");
    }
  };

  const toggleAtivoElemento = async (el: ElementoItem) => {
    try {
      await apiClient.put(`/api/elementos/${el.codigo}`, { ativo: !el.ativo });
      toast.success(el.ativo ? "Elemento desativado." : "Elemento ativado.");
      invalidateElementosCache();
      carregar();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar elemento.");
    }
  };

  const salvarEdicaoSubelemento = async (codigo: string, descricao: string, ordem: number) => {
    try {
      await apiClient.put(`/api/subelementos/${codigo}`, { descricao, ordem });
      toast.success("Subelemento atualizado.");
      invalidateElementosCache();
      carregar();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar subelemento.");
    }
  };

  const toggleAtivoSubelemento = async (codigo: string, ativoAtual: boolean) => {
    try {
      await apiClient.put(`/api/subelementos/${codigo}`, { ativo: !ativoAtual });
      toast.success(ativoAtual ? "Subelemento desativado." : "Subelemento ativado.");
      invalidateElementosCache();
      carregar();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar subelemento.");
    }
  };

  const criarSubelemento = async (elementoCodigo: string, codigo: string, descricao: string, ordem: number) => {
    try {
      await apiClient.post("/api/subelementos", { codigo, elementoCodigo, descricao, ordem });
      toast.success("Subelemento criado.");
      invalidateElementosCache();
      carregar();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar subelemento.");
    }
  };

  const criarElemento = async (dados: { codigo: string; descricao: string; ordem: number; camposMarcados: string[] }) => {
    try {
      await apiClient.post("/api/elementos", { codigo: dados.codigo, descricao: dados.descricao, ordem: dados.ordem });

      if (dados.camposMarcados.length > 0) {
        const configAtual = await apiClient.get<{ campos: any[] }>("/api/configuracoes/retencoes");
        await apiClient.put("/api/configuracoes/retencoes", {
          campos: configAtual.campos,
          regras: { [dados.codigo]: dados.camposMarcados },
        });
      }

      toast.success("Elemento criado com sucesso!");
      invalidateElementosCache();
      setModalAberto(false);
      carregar();
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar elemento.");
    }
  };

  return (
    <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] mb-8">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-800">Elementos e Subelementos</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar..."
              className="pl-9 pr-3 py-2 rounded-full border border-slate-200 bg-slate-50 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => setModalAberto(true)}
            className="bg-blue-900 hover:bg-blue-800 text-white text-sm font-bold py-2 px-4 rounded-xl shadow-sm transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Novo Elemento
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-10 skeleton rounded-xl" />
          <div className="h-10 skeleton rounded-xl" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th scope="col" className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest">Código</th>
                <th scope="col" className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest">Descrição</th>
                <th scope="col" className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest">Ordem</th>
                <th scope="col" className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest text-center"></th>
                <th scope="col" className="pb-2 text-xs font-black text-slate-500 uppercase tracking-widest text-center">Ativo</th>
                <th scope="col" className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {elementosFiltrados.map((el) => (
                <LinhaElemento
                  key={el.codigo}
                  elemento={el}
                  subelementosDoElemento={subelementos.filter((s) => s.elementoCodigo === el.codigo)}
                  expandido={expandido.has(el.codigo)}
                  onToggleExpandir={() => toggleExpandido(el.codigo)}
                  onSalvar={(descricao, ordem) => salvarEdicaoElemento(el.codigo, descricao, ordem)}
                  onToggleAtivo={() => toggleAtivoElemento(el)}
                  onSalvarSub={salvarEdicaoSubelemento}
                  onToggleAtivoSub={toggleAtivoSubelemento}
                  onCriarSub={(codigo, descricao, ordem) => criarSubelemento(el.codigo, codigo, descricao, ordem)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ModalNovoElemento aberto={modalAberto} onFechar={() => setModalAberto(false)} onCriar={criarElemento} />
    </div>
  );
}
