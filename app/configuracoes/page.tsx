"use client";
import { ActionToolbar, ActionButton } from "@/components/action-toolbar";
import { Save, Shield, Bell, User, Lock, Settings } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export default function Configuracoes() {
  const [activeTab, setActiveTab] = useState("perfil");
  const [mounted, setMounted] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [config, setConfig] = useState({
    nome_completo: "",
    email_corporativo: "",
    unidade_padrao: "Secretaria da Fazenda",
    gestao_padrao: "140101",
    auto_preencher_credor: true,
    notifica_email_empenho: false,
    exigir_2fa_op: false,
    alerta_integracao: true,
    aviso_manutencao: true,
  });

  useEffect(() => {
    setMounted(true);
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/configuracoes");
      const data = await res.json();
      if (res.ok && data.configuracoes) {
        setConfig({
          nome_completo: data.configuracoes.nome_completo,
          email_corporativo: data.configuracoes.email_corporativo,
          unidade_padrao: data.configuracoes.unidade_padrao,
          gestao_padrao: data.configuracoes.gestao_padrao,
          auto_preencher_credor: !!data.configuracoes.auto_preencher_credor,
          notifica_email_empenho: !!data.configuracoes.notifica_email_empenho,
          exigir_2fa_op: !!data.configuracoes.exigir_2fa_op,
          alerta_integracao: !!data.configuracoes.alerta_integracao,
          aviso_manutencao: !!data.configuracoes.aviso_manutencao,
        });
      }
    } catch (e) {
      console.error("Erro ao carregar configuracoes", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    toast.success("Sua senha foi redefinida com sucesso.");
    setShowPasswordModal(false);
    setCurrentPassword("");
    setNewPassword("");
  };

  const handleAction = async (action: string) => {
    if (action === "Salvar") {
      setIsSaving(true);
      try {
        const res = await fetch("/api/configuracoes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        });
        if (res.ok) {
          toast.success("Configurações atualizadas com sucesso!");
        } else {
          toast.error("Erro ao atualizar configurações no servidor.");
        }
      } catch (e) {
        toast.error("Erro de conexão.");
      } finally {
        setIsSaving(false);
      }
    }
  };

  const menuItems = [
    { id: "perfil", label: "Perfil", icon: User },
    { id: "permissoes", label: "Permissões", icon: Shield },
    { id: "notificacoes", label: "Notificações", icon: Bell },
    { id: "seguranca", label: "Segurança", icon: Lock },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-50/80">
      <ActionToolbar>
        <div className="flex-1"></div>
        <ActionButton
          icon={Save}
          label={isSaving ? "Salvando..." : "Salvar Alterações"}
          primary
          onClick={() => handleAction("Salvar")}
        />
      </ActionToolbar>

      <div className="p-8 max-w-[1280px] mx-auto w-full flex-1">
        <div className="mb-8 animate-slide-up">
          <p className="section-title mb-1.5">Administração &gt; Configurações</p>
          <h1 className="text-3xl font-bold text-slate-800 mb-1 tracking-tight flex items-center">
            Configurações do Sistema
          </h1>
          <p className="text-slate-500 text-sm">
            Gerencie preferências e parâmetros do sistema de empenhos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {/* Sidebar Params */}
          <div className="col-span-1 space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full text-left px-4 py-3.5 font-semibold rounded-xl transition-all flex items-center group ${
                  activeTab === item.id
                    ? "bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-500/20"
                    : "text-slate-600 hover:bg-white hover:text-slate-800 hover:shadow-sm"
                }`}
              >
                <item.icon className={`w-5 h-5 mr-3 transition-colors ${activeTab === item.id ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"}`} /> {item.label}
              </button>
            ))}
          </div>

          {/* Config Area */}
          <div className="col-span-3">
            {activeTab === "perfil" && (
              <div className="enterprise-card p-8 animate-scale-in">
                <div className="flex items-center mb-8 border-b border-slate-100 pb-5">
                  <div className="w-1.5 h-6 bg-blue-600 rounded-full mr-3"></div>
                  <h3 className="text-xl font-bold text-slate-800">
                    Dados do Perfil
                  </h3>
                </div>

                {isLoading ? (
                  <div className="py-8 text-center text-slate-500">
                    <span className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block mr-2 align-middle"></span> Carregando configurações...
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                          Nome Completo
                        </label>
                        <input
                          type="text"
                          value={config.nome_completo}
                          onChange={(e) => setConfig({ ...config, nome_completo: e.target.value })}
                          className="enterprise-input bg-slate-50/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                          E-mail Corporativo
                        </label>
                        <input
                          type="email"
                          value={config.email_corporativo}
                          onChange={(e) => setConfig({ ...config, email_corporativo: e.target.value })}
                          className="enterprise-input bg-slate-50/50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                          Unidade Orçamentária Padrão
                        </label>
                        <select 
                          value={config.unidade_padrao}
                          onChange={(e) => setConfig({ ...config, unidade_padrao: e.target.value })}
                          className="enterprise-input bg-slate-50/50">
                          <option value="Secretaria de Educação">Secretaria de Educação</option>
                          <option value="Secretaria de Saúde">Secretaria de Saúde</option>
                          <option value="Secretaria da Fazenda">Secretaria da Fazenda</option>
                          <option value="Secretaria de Obras">Secretaria de Obras</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                          Gestão / U.E. Padrão
                        </label>
                        <input
                          type="text"
                          value={config.gestao_padrao}
                          onChange={(e) => setConfig({ ...config, gestao_padrao: e.target.value })}
                          className="enterprise-input bg-slate-50/50"
                        />
                      </div>
                    </div>

                    <div className="flex items-center mb-6 border-b border-slate-100 pb-5">
                      <div className="w-1.5 h-6 bg-emerald-500 rounded-full mr-3"></div>
                      <h3 className="text-xl font-bold text-slate-800">
                        Preferências do Sistema
                      </h3>
                    </div>

                    <div className="space-y-4 max-w-2xl">
                      <label className="flex items-center p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer border border-transparent hover:border-slate-200">
                        <input
                          type="checkbox"
                          checked={config.auto_preencher_credor}
                          onChange={(e) => setConfig({ ...config, auto_preencher_credor: e.target.checked })}
                          className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500/20 bg-slate-50"
                        />
                        <span className="ml-3 text-sm text-slate-700 font-medium">
                          Autopreencher dados do credor com a base estadual
                        </span>
                      </label>
                      <label className="flex items-center p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer border border-transparent hover:border-slate-200">
                        <input
                          type="checkbox"
                          checked={config.notifica_email_empenho}
                          onChange={(e) => setConfig({ ...config, notifica_email_empenho: e.target.checked })}
                          className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500/20 bg-slate-50"
                        />
                        <span className="ml-3 text-sm text-slate-700 font-medium">
                          Enviar notificações de empenho por e-mail
                        </span>
                      </label>
                      <label className="flex items-center p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer border border-transparent hover:border-slate-200">
                        <input
                          type="checkbox"
                          checked={config.exigir_2fa_op}
                          onChange={(e) => setConfig({ ...config, exigir_2fa_op: e.target.checked })}
                          className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500/20 bg-slate-50"
                        />
                        <span className="ml-3 text-sm text-slate-700 font-medium">
                          Exigir autenticação em duas etapas (2FA) para emissão de
                          Ordens
                        </span>
                      </label>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "permissoes" && (
              <div className="enterprise-card p-8 animate-scale-in">
                <div className="flex items-center mb-6 border-b border-slate-100 pb-5">
                  <div className="w-1.5 h-6 bg-blue-600 rounded-full mr-3"></div>
                  <h3 className="text-xl font-bold text-slate-800">
                    Permissões de Acesso
                  </h3>
                </div>
                <p className="text-sm text-slate-500 mb-8 font-medium">
                  As permissões do seu perfil (Nível: Administrador) são
                  gerenciadas pela TI da Secretaria da Fazenda.
                </p>

                <div className="space-y-4">
                  <div className="flex justify-between items-center p-5 bg-slate-50/50 border border-slate-200/60 rounded-xl hover:shadow-sm transition-shadow">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">
                        Emitir Ordens de Pagamento
                      </h4>
                      <p className="text-slate-500 text-xs mt-1">
                        Permite a criação e edição de OPs.
                      </p>
                    </div>
                    <span className="bg-emerald-100/80 text-emerald-700 border border-emerald-200/60 text-xs font-bold px-3 py-1 rounded-full">
                      Ativo
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-5 bg-slate-50/50 border border-slate-200/60 rounded-xl hover:shadow-sm transition-shadow">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">
                        Estornar Liquidações
                      </h4>
                      <p className="text-slate-500 text-xs mt-1">
                        Permite a anulação de processos quitados.
                      </p>
                    </div>
                    <span className="bg-emerald-100/80 text-emerald-700 border border-emerald-200/60 text-xs font-bold px-3 py-1 rounded-full">
                      Ativo
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-5 bg-slate-50/50 border border-slate-200/60 rounded-xl hover:shadow-sm transition-shadow">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">
                        Gerenciar Cadastros Básicos
                      </h4>
                      <p className="text-slate-500 text-xs mt-1">
                        Acesso à inclusão de credores e rubricas.
                      </p>
                    </div>
                    <span className="bg-slate-200/60 text-slate-700 border border-slate-300 text-xs font-bold px-3 py-1 rounded-full">
                      Restrito
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "notificacoes" && (
              <div className="enterprise-card p-8 animate-scale-in">
                <div className="flex items-center mb-6 border-b border-slate-100 pb-5">
                  <div className="w-1.5 h-6 bg-blue-600 rounded-full mr-3"></div>
                  <h3 className="text-xl font-bold text-slate-800">
                    Configurações de Notificações
                  </h3>
                </div>

                <div className="space-y-8">
                  <div>
                    <h4 className="font-bold text-slate-600 uppercase tracking-wider text-xs mb-4">
                      Alertas por E-mail
                    </h4>
                    <div className="space-y-2">
                      <label className="flex items-center p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked
                          className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500/20 bg-slate-50"
                        />
                        <span className="ml-3 text-sm text-slate-700 font-medium">
                          Avisos sobre aprovação de OP
                        </span>
                      </label>
                      <label className="flex items-center p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked
                          className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500/20 bg-slate-50"
                        />
                        <span className="ml-3 text-sm text-slate-700 font-medium">
                          Cancelamentos e estornos
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100">
                    <h4 className="font-bold text-slate-600 uppercase tracking-wider text-xs mb-4">
                      Sistema (Pop-ups e Banners)
                    </h4>
                    <div className="space-y-2">
                      <label className="flex items-center p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked
                          className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500/20 bg-slate-50"
                        />
                        <span className="ml-3 text-sm text-slate-700 font-medium">
                          Alertas de integração falha
                        </span>
                      </label>
                      <label className="flex items-center p-3 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked
                          className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500/20 bg-slate-50"
                        />
                        <span className="ml-3 text-sm text-slate-700 font-medium">
                          Mensagens gerais de suporte e manutenção
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "seguranca" && (
              <div className="enterprise-card p-8 animate-scale-in">
                <div className="flex items-center mb-6 border-b border-slate-100 pb-5">
                  <div className="w-1.5 h-6 bg-blue-600 rounded-full mr-3"></div>
                  <h3 className="text-xl font-bold text-slate-800">
                    Segurança e Autenticação
                  </h3>
                </div>

                <div className="space-y-8">
                  <div>
                    <h4 className="font-bold text-slate-600 uppercase tracking-wider text-xs mb-3">
                      Alterar Senha
                    </h4>
                    <button
                      onClick={() => setShowPasswordModal(true)}
                      className="bg-white border border-slate-200 px-5 py-2.5 text-sm font-bold rounded-lg shadow-sm hover:bg-slate-50 text-slate-700 hover:border-slate-300 transition-all focus:ring-2 focus:ring-blue-500/20"
                    >
                      Solicitar redefinição de senha
                    </button>
                  </div>

                  <div className="pt-6 border-t border-slate-100">
                    <h4 className="font-bold text-slate-600 uppercase tracking-wider text-xs mb-3">
                      Sessões Ativas
                    </h4>
                    <div className="p-5 bg-slate-50/50 border border-slate-200/60 rounded-xl">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-sm text-slate-800 flex items-center">
                          <Lock className="w-4 h-4 mr-2 text-slate-400" />
                          Este Computador (Windows / Chrome)
                        </span>
                        <span className="text-xs bg-emerald-100/80 text-emerald-700 border border-emerald-200/60 px-2.5 py-1 rounded-full font-bold">
                          Ativo Agora
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium ml-6">
                        Último acesso:{" "}
                        {mounted
                          ? `${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`
                          : "Carregando..."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-8 animate-scale-in">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              Alterar Senha
            </h2>
            <p className="text-sm text-slate-500 mb-6 font-medium">
              Informe a senha atual e defina uma nova senha forte.
            </p>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  Senha Atual
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="enterprise-input"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  Nova Senha
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="enterprise-input mb-4"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold py-2.5 rounded-lg transition-colors shadow-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-all shadow-md shadow-blue-600/20"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
