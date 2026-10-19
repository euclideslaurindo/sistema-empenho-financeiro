"use client";
import { useWatch } from "react-hook-form";
import { maskCurrency, parseFormNumber } from "@/lib/utils";
import { idNaLinha, nomeNaLinha } from "@/lib/retencoes-form";

// Valor a pagar (bruto) do credor. O saldo da NE é da emissão (raiz).
export function InputValorPagamento({
  register,
  control,
  errors,
  setValue,
  basePath = "",
}: {
  register: any;
  control: any;
  errors: any;
  setValue: any;
  /** Prefixo da linha do credor (T35-A); `errors` já vem recortado na linha. */
  basePath?: string;
}) {
  const nome = nomeNaLinha(basePath, "valorPagamento");
  const inputId = idNaLinha(basePath, "op-valor-pagamento");
  const erroId = `${inputId}-error`;
  const saldoAnterior = useWatch({ control, name: "saldoAnterior" });
  const valorPagamento = useWatch({ control, name: nome });

  const valorPg = parseFormNumber(valorPagamento);
  const saldoAtual = Number(saldoAnterior) || 0;
  const ultrapassouSaldo = valorPg > saldoAtual && saldoAtual > 0;

  return (
    <div className="col-span-12 md:col-span-4 mt-4">
      <label htmlFor={inputId} className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Valor a Pagar R$</label>
      <input
        id={inputId}
        type="text"
        placeholder="0,00"
        {...register(nome)}
        onChange={(e: any) => {
          const masked = maskCurrency(e.target.value);
          e.target.value = masked;
          // setValue explícito (em vez de só mutar e.target.value): o
          // onChange passado como opção do register() roda DEPOIS do
          // react-hook-form já ter capturado o valor bruto (sem máscara)
          // do evento, então o estado interno do form ficava sempre um
          // dígito atrasado em relação ao que aparecia na tela (R$ 150,00
          // exibido, mas R$ 15,00 usado nos cálculos de useWatch, como
          // "Saldo Restante Após Pagamento"). setValue corrige o estado
          // do form direto, sem essa defasagem.
          setValue(nome, masked, { shouldValidate: true, shouldDirty: true });
        }}
        aria-invalid={!!errors?.valorPagamento}
        aria-describedby={errors?.valorPagamento ? erroId : undefined}
        className={`w-full px-4 py-3 rounded-xl border text-lg font-black focus:outline-none focus:ring-4 transition-all duration-300 ${errors?.valorPagamento || ultrapassouSaldo ? 'border-red-400 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-emerald-700 focus:border-emerald-400 focus:ring-emerald-500/10'}`}
      />
      {errors?.valorPagamento && <p id={erroId} className="text-red-500 text-xs mt-1 font-semibold">{errors.valorPagamento.message}</p>}
    </div>
  );
}
