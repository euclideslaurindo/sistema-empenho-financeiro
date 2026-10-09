"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Info, ShieldAlert } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { ConfigRetencaoCampoMapeado } from "@/lib/services/config-retencoes.service";
import TransporteParametros from "@/components/admin/TransporteParametros";
import IrrfFaixasEditor from "@/components/admin/IrrfFaixasEditor";
import IssMunicipiosTable from "@/components/admin/IssMunicipiosTable";
import TransporteSimulador from "@/components/admin/TransporteSimulador";
import type { IssMunicipioAdmin, ListaIrrf, ListaParametros } from "@/components/admin/transporte-tipos";

interface Props {
  config: ConfigRetencaoCampoMapeado[];
  onDirtyChange: (dirty: boolean) => void;
}

type Secao = "parametros" | "irrf" | "iss";

/** Aba "Transporte (3.3.90.33)" da configuração de retenções (T27). */
export default function TransporteConfig({ config, onDirtyChange }: Props) {
  const [parametros, setParametros] = useState<ListaParametros | null>(null);
  const [irrf, setIrrf] = useState<ListaIrrf | null>(null);
  const [municipios, setMunicipios] = useState<IssMunicipioAdmin[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [dirty, setDirty] = useState<Record<Secao, boolean>>({ parametros: false, irrf: false, iss: false });

  // Cada recarga incrementa a versão da seção: o editor remonta (key) com os dados novos.
  const [versao, setVersao] = useState<Record<Secao, number>>({ parametros: 0, irrf: 0, iss: 0 });
  const novaVersao = (secao: Secao) => setVersao((v) => ({ ...v, [secao]: v[secao] + 1 }));

  const carregarParametros = useCallback(
    () =>
      apiClient.get<ListaParametros>("/api/configuracoes/calculo-transporte").then((d) => {
        setParametros(d);
        novaVersao("parametros");
      }),
    []
  );
  const carregarIrrf = useCallback(
    () =>
      apiClient.get<ListaIrrf>("/api/configuracoes/irrf").then((d) => {
        setIrrf(d);
        novaVersao("irrf");
      }),
    []
  );
  const carregarMunicipios = useCallback(
    () =>
      apiClient.get<{ municipios: IssMunicipioAdmin[] }>("/api/configuracoes/iss-municipios").then((d) => {
        setMunicipios(d.municipios);
        novaVersao("iss");
      }),
    []
  );

  const carregarTudo = useCallback(
    () =>
      Promise.all([carregarParametros(), carregarIrrf(), carregarMunicipios()]).catch((e: any) =>
        setErro(e?.message || "Erro ao carregar os parâmetros do transporte.")
      ),
    [carregarParametros, carregarIrrf, carregarMunicipios]
  );

  useEffect(() => {
    carregarTudo();
  }, [carregarTudo]);

  const algumDirty = dirty.parametros || dirty.irrf || dirty.iss;
  useEffect(() => onDirtyChange(algumDirty), [algumDirty, onDirtyChange]);

  const marcar = useCallback(
    (secao: Secao) => (valor: boolean) => setDirty((d) => (d[secao] === valor ? d : { ...d, [secao]: valor })),
    []
  );
  const onDirtyParametros = useMemo(() => marcar("parametros"), [marcar]);
  const onDirtyIrrf = useMemo(() => marcar("irrf"), [marcar]);
  const onDirtyIss = useMemo(() => marcar("iss"), [marcar]);

  const recarregar = (fn: () => Promise<unknown>) => () => {
    fn().catch((e: any) => setErro(e?.message || "Erro ao recarregar."));
  };

  return (
    <div className="space-y-8">
      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-700 mt-0.5" />
        <p className="text-amber-800 text-sm font-bold">Vale para as OPs novas; OPs emitidas não mudam.</p>
      </div>

      {erro && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-start gap-3 shadow-sm">
          <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5" />
          <p className="text-red-700 text-sm">
            {erro}{" "}
            <button
              type="button"
              onClick={() => {
                setErro(null);
                carregarTudo();
              }}
              className="underline font-bold"
            >
              Tentar de novo
            </button>
          </p>
        </div>
      )}

      {!parametros || !irrf || !municipios ? (
        !erro && (
          <div className="space-y-4">
            <div className="h-40 skeleton rounded-3xl" />
            <div className="h-64 skeleton rounded-3xl" />
          </div>
        )
      ) : (
        <>
          <TransporteParametros
            key={`p${versao.parametros}`}
            dados={parametros}
            onSalvo={recarregar(carregarParametros)}
            onDirtyChange={onDirtyParametros}
          />
          <IrrfFaixasEditor key={`i${versao.irrf}`} dados={irrf} onSalvo={recarregar(carregarIrrf)} onDirtyChange={onDirtyIrrf} />
          <IssMunicipiosTable
            key={`m${versao.iss}`}
            municipios={municipios}
            onSalvo={recarregar(carregarMunicipios)}
            onDirtyChange={onDirtyIss}
          />
          <TransporteSimulador parametros={parametros} irrf={irrf} municipios={municipios} config={config} />
        </>
      )}
    </div>
  );
}
