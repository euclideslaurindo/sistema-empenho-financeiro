"use client";
import { ActionToolbar, ActionButton } from "@/components/action-toolbar";
import { Save, Shield, Bell, User, Lock } from "lucide-react";
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
    <div className="flex flex-col h-full bg-[#f4f4f5]">
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1e293b]">
            Configurações do Sistema
          </h1>
          <p className="text-zinc-600 text-sm mt-1">
            Gerencie preferências e parâmetros do sistema de empenhos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Sidebar Params */}
          <div className="col-span-1 space-y-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full text-left px-4 py-3 font-medium rounded-lg transition-colors flex items-center ${
                  activeTab === item.id
                    ? "bg-[#fafafa] border border-[#1e293b] text-[#1e293b] font-bold shadow-sm"
                    : "text-zinc-600 hover:bg-[#e1e3e4] hover:text-[#1e293b]"
                }`}
              >
                <item.icon className="w-5 h-5 mr-3" /> {item.label}
              </button>
            ))}
          </div>

          {/* Config Area */}
          <div className="col-span-3">
            {activeTab === "perfil" && (
              <div className="bg-[#fafafa] rounded-lg border border-[#e4e4e7] shadow-sm p-8">
                <h3 className="text-xl font-bold text-slate-800 mb-6 border-b border-[#e4e4e7] pb-4">
                  Dados do Perfil
                </h3>

                {isLoading ? (
                  <p className="text-sm text-zinc-500">Carregando dados...</p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-600 mb-2">
                          Nome Completo
                        </label>
                        <input
                          type="text"
                          value={config.nome_completo}
                          onChange={(e) => setConfig({ ...config, nome_completo: e.target.value })}
                          className="w-full p-2.5 border border-[#d9dadb] rounded text-sm focus:outline-none focus:border-[#1e293b] text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-600 mb-2">
                          E-mail Corporativo
                        </label>
                        <input
                          type="email"
                          value={config.email_corporativo}
                          onChange={(e) => setConfig({ ...config, email_corporativo: e.target.value })}
                          className="w-full p-2.5 border border-[#d9dadb] rounded text-sm focus:outline-none focus:border-[#1e293b] text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-600 mb-2">
                          Unidade Orçamentária Padrão
                        </label>
                        <select 
                          value={config.unidade_padrao}
                          onChange={(e) => setConfig({ ...config, unidade_padrao: e.target.value })}
                          className="w-full p-2.5 border border-[#d9dadb] rounded text-sm focus:outline-none focus:border-[#1e293b] text-slate-800 bg-[#fafafa]">
                          <option value="Secretaria de Educação">Secretaria de Educação</option>
                          <option value="Secretaria de Saúde">Secretaria de Saúde</option>
                          <option value="Secretaria da Fazenda">Secretaria da Fazenda</option>
                          <option value="Secretaria de Obras">Secretaria de Obras</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-600 mb-2">
                          Gestão / U.E. Padrão
                        </label>
                        <input
                          type="text"
                          value={config.gestao_padrao}
                          onChange={(e) => setConfig({ ...config, gestao_padrao: e.target.value })}
                          className="w-full p-2.5 border border-[#d9dadb] rounded text-sm focus:outline-none focus:border-[#1e293b] text-slate-800"
                        />
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-slate-800 mb-6 border-b border-[#e4e4e7] pb-4">
                      Preferências do Sistema
                    </h3>

                    <div className="space-y-4">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.auto_preencher_credor}
                          onChange={(e) => setConfig({ ...config, auto_preencher_credor: e.target.checked })}
                          className="w-4 h-4 text-[#1e293b] rounded border-[#d9dadb]"
                        />
                        <span className="text-sm text-slate-800 font-medium">
                          Autopreencher dados do credor com a base estadual
                        </span>
                      </label>
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.notifica_email_empenho}
                          onChange={(e) => setConfig({ ...config, notifica_email_empenho: e.target.checked })}
                          className="w-4 h-4 text-[#1e293b] rounded border-[#d9dadb]"
                        />
                        <span className="text-sm text-slate-800 font-medium">
                          Enviar notificações de empenho por e-mail
                        </span>
                      </label>
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.exigir_2fa_op}
                          onChange={(e) => setConfig({ ...config, exigir_2fa_op: e.target.checked })}
                          className="w-4 h-4 text-[#1e293b] rounded border-[#d9dadb]"
                        />
                        <span className="text-sm text-slate-800 font-medium">
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
              <div className="bg-[#fafafa] rounded-lg border border-[#e4e4e7] shadow-sm p-8">
                <h3 className="text-xl font-bold text-slate-800 mb-6 border-b border-[#e4e4e7] pb-4">
                  Permissões de Acesso
                </h3>
                <p className="text-sm text-zinc-600 mb-6">
                  As permissões do seu perfil (Nível: Administrador) são
                  gerenciadas pela TI da Secretaria da Fazenda.
                </p>

                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-[#f4f4f5] border border-[#e4e4e7] rounded-lg">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">
                        Emitir Ordens de Pagamento
                      </h4>
                      <p className="text-zinc-500 text-xs mt-1">
                        Permite a criação e edição de OPs.
                      </p>
                    </div>
                    <span className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full">
                      Ativo
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-[#f4f4f5] border border-[#e4e4e7] rounded-lg">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">
                        Estornar Liquidações
                      </h4>
                      <p className="text-zinc-500 text-xs mt-1">
                        Permite a anulação de processos quitados.
                      </p>
                    </div>
                    <span className="bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full">
                      Ativo
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-[#f4f4f5] border border-[#e4e4e7] rounded-lg">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">
                        Gerenciar Cadastros Básicos
                      </h4>
                      <p className="text-zinc-500 text-xs mt-1">
                        Acesso à inclusão de credores e rubricas.
                      </p>
                    </div>
                    <span className="bg-gray-100 text-gray-800 text-xs font-bold px-3 py-1 rounded-full">
                      Restrito
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "notificacoes" && (
              <div className="bg-[#fafafa] rounded-lg border border-[#e4e4e7] shadow-sm p-8">
                <h3 className="text-xl font-bold text-slate-800 mb-6 border-b border-[#e4e4e7] pb-4">
                  Configurações de Notificações
                </h3>

                <div className="space-y-6">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm mb-3">
                      E-mail
                    </h4>
                    <div className="space-y-3">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked
                          className="w-4 h-4 text-[#1e293b] rounded border-[#d9dadb]"
                        />
                        <span className="text-sm text-slate-800">
                          Avisos sobre aprovação de OP
                        </span>
                      </label>
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked
                          className="w-4 h-4 text-[#1e293b] rounded border-[#d9dadb]"
                        />
                        <span className="text-sm text-slate-800">
                          Cancelamentos e estornos
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#e4e4e7]">
                    <h4 className="font-bold text-slate-800 text-sm mb-3">
                      Sistema (Pop-ups)
                    </h4>
                    <div className="space-y-3">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked
                          className="w-4 h-4 text-[#1e293b] rounded border-[#d9dadb]"
                        />
                        <span className="text-sm text-slate-800">
                          Alertas de integração falha
                        </span>
                      </label>
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          defaultChecked
                          className="w-4 h-4 text-[#1e293b] rounded border-[#d9dadb]"
                        />
                        <span className="text-sm text-slate-800">
                          Mensagens gerais de suporte e manutenção
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "seguranca" && (
              <div className="bg-[#fafafa] rounded-lg border border-[#e4e4e7] shadow-sm p-8">
                <h3 className="text-xl font-bold text-slate-800 mb-6 border-b border-[#e4e4e7] pb-4">
                  Segurança e Autenticação
                </h3>

                <div className="space-y-6">
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm mb-2">
                      Alterar Senha
                    </h4>
                    <button
                      onClick={() => setShowPasswordModal(true)}
                      className="bg-[#fafafa] border border-[#d9dadb] px-4 py-2 text-sm font-bold rounded shadow-sm hover:bg-[#f4f4f5] text-[#1e293b]"
                    >
                      Solicitar redefinição de senha
                    </button>
                  </div>

                  <div className="pt-4 border-t border-[#e4e4e7]">
                    <h4 className="font-bold text-slate-800 text-sm mb-2">
                      Sessões Ativas
                    </h4>
                    <div className="p-4 bg-[#f4f4f5] border border-[#e4e4e7] rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-sm text-slate-800">
                          Este Computador (Windows / Chrome)
                        </span>
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          Ativo Agora
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              Alterar Senha
            </h2>
            <p className="text-sm text-zinc-500 mb-6">
              Informe a senha atual e defina uma nova senha forte.
            </p>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1">
                  Senha Atual
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0f2942]"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1">
                  Nova Senha
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 mb-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0f2942]"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold py-3 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#1e293b] hover:bg-[#334155] text-white font-semibold py-3 rounded-xl transition-colors"
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
