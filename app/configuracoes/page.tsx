"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Key, Percent, Shapes, UserCircle, Users } from "lucide-react";
import { ChangePasswordModal } from "@/components/change-password-modal";
import { IdentificacaoRelatorios } from "@/components/admin/IdentificacaoRelatorios";
import { useAppStore } from "@/lib/store";

// Configurações (revisão da aba 7, CF2): só o que funciona. Antes a tela tinha
// abas de enfeite (perfil "global", notificações que não salvavam, 2FA e
// sessões fixas). A tabela configuracoes_sistema continua no banco, sem uso.

const cartao =
  "flex items-center justify-between gap-4 p-5 rounded-2xl border transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-900/20";

export default function Configuracoes() {
  const userProfile = useAppStore((s) => s.userProfile);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const ehAdmin = userProfile?.perfil === "ADMIN";

  return (
    <div className="flex flex-col h-full bg-slate-50/80">
      <div className="p-8 max-w-[1100px] mx-auto w-full flex-1 space-y-8">
        <div>
          <p className="section-title mb-1.5">Administração &gt; Configurações</p>
          <h1 className="text-3xl font-bold text-slate-800 mb-1 tracking-tight">Configurações</h1>
          <p className="text-slate-500 text-sm">
            {ehAdmin
              ? "Parâmetros de cálculo do sistema e a sua conta."
              : "A sua conta. Os parâmetros de cálculo são alterados só pelo administrador."}
          </p>
        </div>

        {ehAdmin && (
          <section aria-labelledby="config-sistema" className="space-y-3">
            <h2 id="config-sistema" className="text-xs font-black text-slate-500 uppercase tracking-widest">
              Sistema (somente administrador)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link href="/configuracoes/retencoes" className={`${cartao} bg-blue-50 border-blue-200`}>
                <span className="flex items-start gap-3">
                  <Percent className="w-5 h-5 mt-0.5 text-blue-700" />
                  <span>
                    <span className="block font-bold text-blue-900">Retenções e Descontos</span>
                    <span className="block text-xs text-blue-700/80 mt-1">
                      Alíquotas, regras por elemento, transporte (3.3.90.33), ISS por município, IRRF e simulador.
                    </span>
                  </span>
                </span>
                <ArrowRight className="w-5 h-5 text-blue-600 shrink-0" />
              </Link>
              <Link href="/configuracoes/elementos" className={`${cartao} bg-white border-slate-200`}>
                <span className="flex items-start gap-3">
                  <Shapes className="w-5 h-5 mt-0.5 text-slate-600" />
                  <span>
                    <span className="block font-bold text-slate-800">Elementos e Subelementos</span>
                    <span className="block text-xs text-slate-500 mt-1">Cadastre e desative elementos de despesa.</span>
                  </span>
                </span>
                <ArrowRight className="w-5 h-5 text-slate-500 shrink-0" />
              </Link>
              {/* A tela de Usuários não tinha atalho em nenhum menu (só pelo endereço). */}
              <Link href="/usuarios" className={`${cartao} bg-white border-slate-200`}>
                <span className="flex items-start gap-3">
                  <Users className="w-5 h-5 mt-0.5 text-slate-600" />
                  <span>
                    <span className="block font-bold text-slate-800">Usuários</span>
                    <span className="block text-xs text-slate-500 mt-1">Crie usuários, troque o perfil, bloqueie e exclua.</span>
                  </span>
                </span>
                <ArrowRight className="w-5 h-5 text-slate-500 shrink-0" />
              </Link>
              <IdentificacaoRelatorios />
            </div>
          </section>
        )}

        <section aria-labelledby="config-conta" className="space-y-3">
          <h2 id="config-conta" className="text-xs font-black text-slate-500 uppercase tracking-widest">
            Minha conta
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button type="button" onClick={() => setShowPasswordModal(true)} className={`${cartao} bg-white border-slate-200 text-left`}>
              <span className="flex items-start gap-3">
                <Key className="w-5 h-5 mt-0.5 text-amber-600" />
                <span>
                  <span className="block font-bold text-slate-800">Alterar senha</span>
                  <span className="block text-xs text-slate-500 mt-1">Informe a senha atual e a nova.</span>
                </span>
              </span>
              <ArrowRight className="w-5 h-5 text-slate-500 shrink-0" />
            </button>
            <Link href="/perfil" className={`${cartao} bg-white border-slate-200`}>
              <span className="flex items-start gap-3">
                <UserCircle className="w-5 h-5 mt-0.5 text-slate-600" />
                <span>
                  <span className="block font-bold text-slate-800">Meu Perfil</span>
                  <span className="block text-xs text-slate-500 mt-1">Nome, e-mail e perfil de acesso.</span>
                </span>
              </span>
              <ArrowRight className="w-5 h-5 text-slate-500 shrink-0" />
            </Link>
          </div>
        </section>
      </div>

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </div>
  );
}
