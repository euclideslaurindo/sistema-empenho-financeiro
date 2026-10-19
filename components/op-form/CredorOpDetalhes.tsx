"use client";
import { AlertTriangle } from "lucide-react";
import OpItemsTable from "@/components/op-form/OpItemsTable";
import OpTaxesSection from "@/components/op-form/OpTaxesSection";
import type { Perfil } from "@/lib/retencoes-form";
import type { CredorLinha } from "@/lib/op-emissao";
import type { ConfigRetencoes } from "@/hooks/use-retencoes-config";
import type { ErrosLinha } from "@/components/op-form/CredorOpLinha";

/**
 * Painel de detalhes do credor (fechado por padrão): especificação do
 * pagamento (itens), retenções e os dados do cadastro, só para conferir.
 * Os efeitos de cálculo ficam na linha (sempre montados), não aqui.
 */
export function CredorOpDetalhes({
  id,
  basePath,
  linha,
  config,
  erroConfig,
  perfil,
  erros,
}: {
  id: string;
  basePath: string;
  linha: CredorLinha;
  config: ConfigRetencoes | null;
  erroConfig: string | null;
  perfil: Perfil;
  erros?: ErrosLinha;
}) {
  const cadastro: Array<[string, string]> = [
    ["RG", linha.rg],
    ["Endereço", linha.endereco],
    ["Banco", linha.banco],
    ["Agência", linha.agencia],
    ["Conta", linha.contaCorrente],
    ["PIX", linha.pix],
  ];

  return (
    <div id={id} className="mt-4 space-y-4">
      {erros?.itens && (
        <p role="alert" className="flex items-center gap-2 text-sm font-bold text-red-600">
          <AlertTriangle className="w-4 h-4" /> {erros.itens}
        </p>
      )}
      <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4">
        <OpItemsTable basePath={basePath} />
      </div>

      {erros?.retencoes && (
        <p role="alert" className="flex items-center gap-2 text-sm font-bold text-red-600">
          <AlertTriangle className="w-4 h-4" /> {erros.retencoes}
        </p>
      )}
      <OpTaxesSection userRole={perfil} config={config} erroConfig={erroConfig} basePath={basePath} efeitos={false} />

      <div className="rounded-2xl border border-slate-100 px-4 py-3">
        <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Dados do cadastro (somente leitura)</p>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
          {cadastro.map(([rotulo, valor]) => (
            <div key={rotulo}>
              <dt className="text-xs font-bold text-slate-400">{rotulo}</dt>
              <dd className="font-semibold text-slate-700">{valor || "-"}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
