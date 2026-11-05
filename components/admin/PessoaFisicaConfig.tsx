"use client";
import { useCallback, useEffect, useState } from "react";
import { Info, ShieldAlert } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { ConfigRetencaoCampoMapeado } from "@/lib/services/config-retencoes.service";
import TransporteParametros from "@/components/admin/TransporteParametros";
import PessoaFisicaSimulador from "@/components/admin/PessoaFisicaSimulador";
import type { ListaIrrf, ListaParametros } from "@/components/admin/transporte-tipos";

interface Props {
  config: ConfigRetencaoCampoMapeado[];
  regras: Record<string, string[]>;
  onDirtyChange: (dirty: boolean) => void;
}

/** B8: aba "Pessoa Física (3.3.90.36)" — IRRF progressivo 2026. */
export default function PessoaFisicaConfig({ config, regras, onDirtyChange }: Props) {
  const [parametros, setParametros] = useState<ListaParametros | null>(null);
  const [irrf, setIrrf] = useState<ListaIrrf | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  const carregar = useCallback(
    () =>
      Promise.all([
        apiClient.get<ListaParametros>("/api/configuracoes/calculo-pessoa-fisica"),
        apiClient.get<ListaIrrf>("/api/configuracoes/irrf"),
      ])
        .then(([p, i]) => {
          setParametros(p);
          setIrrf(i);
          setVersao((v) => v + 1);
        })
        .catch((e: any) => setErro(e?.message || "Erro ao carregar os parâmetros da pessoa física.")),
    []
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <div className="space-y-8">
      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-700 mt-0.5" />
        <div className="text-amber-800 text-sm font-bold space-y-1">
          <p>Vale para as OPs novas; OPs emitidas não mudam.</p>
          <p className="font-semibold">
            INSS = alíquota do INSS (Retenções padrão) sobre o bruto, até o teto. Base do IR = bruto − o maior entre o INSS e o
            desconto simplificado. Isento até o limite da isenção; o redutor vale até o limite do redutor. A tabela do IRRF é a
            mesma do transporte e é editada na aba Transporte.
          </p>
        </div>
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
                carregar();
              }}
              className="underline font-bold"
            >
              Tentar de novo
            </button>
          </p>
        </div>
      )}

      {!parametros || !irrf ? (
        !erro && <div className="h-40 skeleton rounded-3xl" />
      ) : parametros.vigencias.length === 0 ? (
        <p role="alert" className="text-sm font-bold text-red-700">
          Nenhum parâmetro cadastrado para a pessoa física: rode a migration_21.sql no banco.
        </p>
      ) : (
        <>
          <TransporteParametros
            key={`pf${versao}`}
            perfil="PESSOA_FISICA"
            dados={parametros}
            onSalvo={() => {
              carregar();
            }}
            onDirtyChange={onDirtyChange}
          />
          <PessoaFisicaSimulador parametros={parametros} irrf={irrf} config={config} regras={regras} />
        </>
      )}
    </div>
  );
}
