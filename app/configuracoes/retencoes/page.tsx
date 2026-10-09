"use client";
import { useEffect, useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, ShieldAlert } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useRetencoesConfig, type ConfigRetencoes } from "@/hooks/use-retencoes-config";
import { apiClient } from "@/lib/api-client";
import { parseFormNumber } from "@/lib/utils";
import RetencoesCamposTable from "@/components/admin/RetencoesCamposTable";
import RetencoesMatriz from "@/components/admin/RetencoesMatriz";
import RetencoesSimulador from "@/components/admin/RetencoesSimulador";
import TransporteConfig from "@/components/admin/TransporteConfig";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

const CAMPOS_TRIBUTARIOS = ["irrf", "iss", "inss", "patronal", "sest_senat"];
const ROTULOS_CAMPO: Record<string, string> = {
  irrf: "IRRF",
  iss: "ISS",
  inss: "INSS",
  patronal: "Patronal",
  sest_senat: "SEST/SENAT",
};

interface CampoFormValue {
  campo: string;
  rotulo: string;
  tipo: string;
  aliquota: string;
  calculoAutomatico: boolean;
  editavelOperador: boolean;
  entraDarf: boolean;
  ativo: boolean;
  ordem: number;
}
interface ElementoFormValue {
  codigo: string;
  descricao: string;
  legado: boolean;
  campos: Record<string, boolean>;
}
interface FormValues {
  campos: CampoFormValue[];
  elementos: ElementoFormValue[];
}

function montarDefaultValues(config: ConfigRetencoes, elementosApi: any[]): FormValues {
  const campos: CampoFormValue[] = config.campos.map((c) => ({
    campo: c.campo,
    rotulo: c.rotulo,
    tipo: c.tipo,
    aliquota: c.aliquota != null ? String(c.aliquota).replace(".", ",") : "",
    calculoAutomatico: c.calculoAutomatico,
    editavelOperador: c.editavelOperador,
    entraDarf: c.entraDarf,
    ativo: c.ativo,
    ordem: c.ordem,
  }));

  const elementos: ElementoFormValue[] = elementosApi.map((el) => {
    const aplicaveis = config.regras[el.codigo] || [];
    const camposMap: Record<string, boolean> = {};
    for (const c of CAMPOS_TRIBUTARIOS) camposMap[c] = aplicaveis.includes(c);
    return { codigo: el.codigo, descricao: el.descricao, legado: !!el.legado, campos: camposMap };
  });

  return { campos, elementos };
}

function gerarDiffCampos(original: CampoFormValue[], atual: CampoFormValue[]): string[] {
  const diffs: string[] = [];
  for (const c of atual) {
    const orig = original.find((o) => o.campo === c.campo);
    if (!orig) continue;
    if (orig.rotulo !== c.rotulo) diffs.push(`Rótulo de ${c.campo}: "${orig.rotulo}" → "${c.rotulo}"`);
    if (orig.aliquota !== c.aliquota) {
      diffs.push(`${c.rotulo}: ${orig.aliquota || "—"}% → ${c.aliquota || "—"}%`);
    }
    if (orig.calculoAutomatico !== c.calculoAutomatico) {
      diffs.push(`${c.rotulo}: cálculo automático ${c.calculoAutomatico ? "ativado" : "desativado"}`);
    }
    if (orig.editavelOperador !== c.editavelOperador) {
      diffs.push(`${c.rotulo}: editável pelo operador ${c.editavelOperador ? "ativado" : "desativado"}`);
    }
    if (orig.entraDarf !== c.entraDarf) {
      diffs.push(`${c.rotulo}: entra na DARF ${c.entraDarf ? "ativado" : "desativado"}`);
    }
    if (orig.ativo !== c.ativo) {
      diffs.push(`${c.rotulo}: ${c.ativo ? "ativado" : "desativado"}`);
    }
  }
  return diffs;
}

function gerarDiffMatriz(original: ElementoFormValue[], atual: ElementoFormValue[]): string[] {
  const diffs: string[] = [];
  for (const el of atual) {
    const orig = original.find((o) => o.codigo === el.codigo);
    if (!orig) continue;
    for (const campo of CAMPOS_TRIBUTARIOS) {
      const antes = !!orig.campos[campo];
      const depois = !!el.campos[campo];
      if (antes !== depois) {
        diffs.push(`${el.codigo} ${depois ? "passa a ter" : "deixa de ter"} ${ROTULOS_CAMPO[campo]}`);
      }
    }
  }
  return diffs;
}

function TelaCarregando() {
  return (
    <div className="p-8 max-w-[1400px] mx-auto w-full space-y-4">
      <div className="h-10 w-64 skeleton rounded-xl" />
      <div className="h-40 skeleton rounded-3xl" />
      <div className="h-64 skeleton rounded-3xl" />
    </div>
  );
}

export default function RetencoesConfigPage() {
  const router = useRouter();
  const userProfile = useAppStore((s) => s.userProfile);
  const setNavigationBlocked = useAppStore((s) => s.setNavigationBlocked);
  const { config, elementos, loading, erro, recarregar } = useRetencoesConfig();

  const [defaultValuesSnapshot, setDefaultValuesSnapshot] = useState<FormValues | null>(null);
  const [versaoBase, setVersaoBase] = useState<string | null>(null);
  const [diffPendente, setDiffPendente] = useState<string[] | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aba, setAba] = useState<"padrao" | "transporte">("padrao");
  const [transporteAberto, setTransporteAberto] = useState(false);
  const [transporteDirty, setTransporteDirty] = useState(false);

  const methods = useForm<FormValues>({ defaultValues: { campos: [], elementos: [] } });
  const {
    handleSubmit,
    reset,
    getValues,
    setError,
    formState: { isDirty },
  } = methods;

  // Guarda de acesso: trata userProfile===null como "ainda carregando"
  // (shell.tsx só popula depois do mount via GET /api/perfil) — não
  // redireciona precipitadamente antes do perfil real chegar.
  useEffect(() => {
    if (userProfile && userProfile.perfil !== "ADMIN") {
      toast.error("Acesso restrito a administradores.");
      router.push("/configuracoes");
    }
  }, [userProfile, router]);

  // Popula o form quando os dados chegam (1ª carga ou depois de recarregar()).
  useEffect(() => {
    if (config) {
      const dv = montarDefaultValues(config, elementos);
      reset(dv);
      setDefaultValuesSnapshot(dv);
      setVersaoBase(config.versao);
    }
  }, [config, elementos, reset]);

  // Bloqueio de navegação: avisa o Sidebar (onNavigate) enquanto houver
  // alteração não salva.
  const pendente = isDirty || transporteDirty;
  useEffect(() => {
    setNavigationBlocked(pendente);
    return () => setNavigationBlocked(false);
  }, [pendente, setNavigationBlocked]);

  // Fechar aba / atualizar / digitar URL nova — beforeunload nativo
  // (onNavigate do next/link não cobre esses casos).
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (pendente) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [pendente]);

  const abrirAba = (nova: "padrao" | "transporte") => {
    setAba(nova);
    if (nova === "transporte") setTransporteAberto(true);
  };

  const onSubmit = (data: FormValues) => {
    if (!defaultValuesSnapshot) return;
    const diff = [...gerarDiffCampos(defaultValuesSnapshot.campos, data.campos), ...gerarDiffMatriz(defaultValuesSnapshot.elementos, data.elementos)];
    if (diff.length === 0) {
      toast.info("Nada para salvar.");
      return;
    }
    setDiffPendente(diff);
  };

  const confirmarSalvar = async () => {
    const data = getValues();
    setSalvando(true);
    try {
      const payload = {
        campos: data.campos.map((c) => ({
          campo: c.campo,
          rotulo: c.rotulo,
          tipo: c.tipo,
          aliquota: c.tipo === "VALOR_DIGITADO" ? null : c.aliquota ? parseFormNumber(c.aliquota) : null,
          calculoAutomatico: c.calculoAutomatico,
          editavelOperador: c.editavelOperador,
          entraDarf: c.entraDarf,
          ativo: c.ativo,
          ordem: c.ordem,
        })),
        regras: Object.fromEntries(
          data.elementos.map((el) => [el.codigo, CAMPOS_TRIBUTARIOS.filter((c) => el.campos[c])])
        ),
        versaoBase,
      };
      await apiClient.put("/api/configuracoes/retencoes", payload);
      toast.success("Configuração salva com sucesso!");
      setDiffPendente(null);
      recarregar();
    } catch (err: any) {
      if (err.status === 409) {
        toast.error("Configuração alterada por outro administrador. Recarregando...");
        setDiffPendente(null);
        recarregar();
      } else if (err.status === 400 && Array.isArray(err.details)) {
        for (const issue of err.details) {
          const path = Array.isArray(issue.path) ? issue.path.join(".") : String(issue.path);
          setError(path as any, { message: issue.message });
        }
        toast.error("Corrija os campos destacados.");
      } else {
        toast.error(err.message || "Erro ao salvar configuração.");
      }
    } finally {
      setSalvando(false);
    }
  };

  if (!userProfile) {
    return <TelaCarregando />;
  }
  if (userProfile.perfil !== "ADMIN") {
    return null;
  }

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="p-8 max-w-[1400px] mx-auto w-full flex-1 space-y-8 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-end justify-between">
          <div>
            <div className="flex items-center text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">
              Início &gt; Configurações &gt; <span className="text-blue-900 ml-1">Retenções e Descontos</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight">Retenções e Descontos</h1>
          </div>
          {aba === "padrao" && (
            <button
              type="button"
              onClick={handleSubmit(onSubmit)}
              disabled={loading || salvando}
              className="mt-6 md:mt-0 bg-blue-900 hover:bg-blue-800 text-white text-sm font-bold py-2.5 px-5 rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> Salvar Alterações
            </button>
          )}
        </div>

        <div role="tablist" aria-label="Tipo de cálculo" className="flex gap-2 border-b border-slate-200">
          {(
            [
              ["padrao", "Retenções padrão"],
              ["transporte", "Transporte (3.3.90.33)"],
            ] as const
          ).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`aba-${id}`}
              aria-selected={aba === id}
              aria-controls={`painel-${id}`}
              onClick={() => abrirAba(id)}
              className={`px-4 py-2.5 text-sm font-bold border-b-2 -mb-px transition-colors ${
                aba === id ? "border-blue-900 text-blue-900" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>

        {erro && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-start gap-3 shadow-sm">
            <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5" />
            <p className="text-red-700 text-sm">
              {erro}{" "}
              <button type="button" onClick={recarregar} className="underline font-bold">
                Tentar de novo
              </button>
            </p>
          </div>
        )}

        {/* Os dois painéis ficam montados (só escondidos) para não perder edições ao trocar de aba. */}
        <div role="tabpanel" id="painel-padrao" aria-labelledby="aba-padrao" hidden={aba !== "padrao"}>
          {loading ? (
            <TelaCarregando />
          ) : (
            <FormProvider {...methods}>
              <form>
                <RetencoesCamposTable />
                <RetencoesMatriz />
                <RetencoesSimulador />
              </form>
            </FormProvider>
          )}
        </div>
        {transporteAberto && (
          <div role="tabpanel" id="painel-transporte" aria-labelledby="aba-transporte" hidden={aba !== "transporte"}>
            <TransporteConfig config={config?.campos ?? []} onDirtyChange={setTransporteDirty} />
          </div>
        )}
      </div>

      <AlertDialog open={!!diffPendente} onOpenChange={(open) => !open && setDiffPendente(null)}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogTitle>Confirmar alterações</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="block mb-3 font-bold text-amber-700">
              Vale para todas as OPs novas. OPs já emitidas não mudam.
            </span>
            <ul className="list-disc pl-5 space-y-1 text-slate-700 max-h-60 overflow-y-auto">
              {diffPendente?.map((linha, i) => (
                <li key={i}>{linha}</li>
              ))}
            </ul>
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarSalvar}
              disabled={salvando}
              className="bg-blue-900 hover:bg-blue-800 shadow-blue-900/20 focus:ring-blue-800"
            >
              {salvando ? "Salvando..." : "Confirmar e salvar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
