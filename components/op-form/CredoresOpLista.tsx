"use client";
import { useFormContext } from "react-hook-form";
import { CalendarCheck, Users } from "lucide-react";
import { toast } from "sonner";
import type { Perfil } from "@/lib/retencoes-form";
import { numeroPrevistoDaLinha, type CredorApi, type NumeroPrevisto } from "@/lib/op-emissao";
import { CredorBusca } from "@/components/op-form/CredorBusca";
import { CredorOpLinha, type ErrosLinha } from "@/components/op-form/CredorOpLinha";
import type { ConfigRetencoes } from "@/hooks/use-retencoes-config";

/**
 * Lista de credores da emissão (T35-B): uma linha = uma OP, na ordem da lista
 * (que é a ordem dos números). Substitui o antigo bloco "Favorecido".
 */
export function CredoresOpLista({
  chaves,
  neCarregada,
  numeros,
  config,
  erroConfig,
  perfil,
  abertos,
  errosLinhas,
  onAdicionar,
  onRemover,
  onAlternar,
  onLimparErros,
}: {
  chaves: string[];
  neCarregada: string;
  numeros: NumeroPrevisto[] | null;
  config: ConfigRetencoes | null;
  erroConfig: string | null;
  perfil: Perfil;
  abertos: Set<string>;
  errosLinhas: Record<string, ErrosLinha>;
  onAdicionar: (credor: CredorApi) => void;
  onRemover: (indice: number) => void;
  onAlternar: (chave: string) => void;
  onLimparErros: (chave: string) => void;
}) {
  const { getValues, setValue } = useFormContext<any>();

  // D40: copia a data do pagamento do 1º credor para os demais.
  const aplicarDataATodos = () => {
    const data = getValues("credores.0.dataPagamento");
    if (!data) {
      toast.info("Informe a data do pagamento do 1º credor para copiar para os demais.");
      return;
    }
    for (let i = 1; i < chaves.length; i++) setValue(`credores.${i}.dataPagamento`, data, { shouldDirty: true });
    toast.success(`Data do pagamento aplicada aos ${chaves.length} credores.`);
  };

  return (
    <div className="bg-white border border-slate-200 p-5 md:p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 mr-3">
            <Users className="w-4 h-4" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Credores desta emissão</h2>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {chaves.length >= 2 && (
            <button
              type="button"
              onClick={aplicarDataATodos}
              className="flex items-center gap-1 text-sm font-bold text-blue-900 hover:underline"
            >
              <CalendarCheck className="w-4 h-4" /> Aplicar data do 1º a todos
            </button>
          )}
          <span className="text-sm font-bold text-slate-500">
            {chaves.length === 1 ? "1 credor" : `${chaves.length} credores`}
          </span>
        </div>
      </div>

      <div className="mb-6">
        <CredorBusca onEscolher={onAdicionar} desabilitado={!neCarregada} />
      </div>

      {chaves.length === 0 ? (
        <p className="text-sm font-semibold text-slate-500" data-testid="lista-credores-vazia">
          {neCarregada ? "Nenhum credor ainda. Use a busca acima para adicionar." : "Carregue a NE e adicione os credores."}
        </p>
      ) : (
        <div className="space-y-4">
          {chaves.map((chave, i) => (
            <CredorOpLinha
              key={chave}
              indice={i}
              total={chaves.length}
              numero={numeroPrevistoDaLinha(numeros, i)}
              config={config}
              erroConfig={erroConfig}
              perfil={perfil}
              aberto={abertos.has(chave)}
              erros={errosLinhas[chave]}
              onAlternar={() => onAlternar(chave)}
              onRemover={() => onRemover(i)}
              onLimparErros={() => onLimparErros(chave)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
