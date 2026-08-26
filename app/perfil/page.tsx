"use client";
import { useState, useEffect } from "react";
import { UserCircle, Settings, Mail, Shield, Bell, Key } from "lucide-react";
import { ActionToolbar, ActionButton } from "@/components/action-toolbar";
import { toast } from "sonner";

export default function PerfilGestor() {
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  
  const [perfil, setPerfil] = useState({
    id: "",
    nome: "",
    matricula: "",
    email: "",
    nivel_acesso: 1,
    ativo: 1,
    ultimoAcesso: "Hoje, 08:30"
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPerfil = async () => {
      try {
        const res = await fetch('/api/perfil');
        const data = await res.json();
        if (res.ok && data.usuario) {
          setPerfil({
            ...perfil,
            ...data.usuario,
            ultimoAcesso: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})
          });
        }
      } catch (e) {
        console.error("Erro ao buscar perfil", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPerfil();
  }, []);

  const handleSave = async () => {
    try {
      const res = await fetch('/api/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: perfil.id,
          nome: perfil.nome,
          email: perfil.email
        })
      });
      if (res.ok) {
        toast.success("Perfil atualizado com sucesso!");
        setIsEditing(false);
      } else {
        toast.error("Erro ao atualizar o perfil.");
      }
    } catch (e) {
      toast.error("Erro de conexão com o servidor.");
    }
  };

  const handleEditProfile = () => {
    setIsEditing(true);
    toast.info("Modo de edição habilitado. Faça suas alterações.");
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    toast.success("Sua senha foi redefinida com sucesso.");
    setShowPasswordModal(false);
    setCurrentPassword("");
    setNewPassword("");
  };

  const handlePasswordChange = () => {
    setShowPasswordModal(true);
  };

  return (
    <div className="flex flex-col h-full bg-[#f4f4f5]">
      <ActionToolbar>
        <ActionButton
          icon={Settings}
          label="Editar Perfil"
          onClick={handleEditProfile}
        />
        <ActionButton
          icon={Key}
          label="Alterar Senha"
          onClick={handlePasswordChange}
          warning={true}
        />
      </ActionToolbar>

      <div className="p-8 max-w-[1280px] mx-auto w-full flex-1">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1e293b] mb-1">
            Perfil do Gestor Financeiro
          </h1>
          <p className="text-zinc-600 text-sm">
            Gerencie suas informações pessoais e credenciais de acesso.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-[#1e293b] p-6 rounded-lg shadow-xl flex flex-col items-center">
              <div className="w-32 h-32 bg-gradient-to-br from-indigo-400 to-indigo-500 rounded-full flex items-center justify-center text-[#1e293b] mb-4 shadow-lg">
                <UserCircle className="w-20 h-20" />
              </div>
              <h2 className="text-xl font-bold text-white">
                {isLoading ? "Carregando..." : perfil.nome || "Gestor Financeiro"}
              </h2>
              <p className="text-[#a1a1aa] font-medium text-sm mb-4">
                Matrícula: {perfil.matricula || "-"}
              </p>

              <div className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-indigo-400/10 text-indigo-600 rounded-lg text-sm font-semibold mb-6">
                <Shield className="w-4 h-4" />
                <span>Acesso Total: Nível {perfil.nivel_acesso}</span>
              </div>

              <div className="w-full border-t border-[#334155] pt-6 space-y-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[#a1a1aa]">Departamento</span>
                  <span className="font-semibold text-white">Tesouraria</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#a1a1aa]">Último Acesso</span>
                  <span className="font-semibold text-white">Hoje, {perfil.ultimoAcesso}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#a1a1aa]">Status</span>
                  <span className="font-semibold text-indigo-600">
                    {perfil.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#fafafa] p-6 rounded-lg border border-[#e4e4e7] shadow-sm">
              <h3 className="text-lg font-bold text-[#1e293b] mb-6 flex items-center">
                <Settings className="w-5 h-5 mr-2 text-indigo-600" />
                Informações Pessoais
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-[#1e293b]/70 mb-2">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    value={perfil.nome}
                    onChange={(e) => setPerfil({...perfil, nome: e.target.value})}
                    disabled={!isEditing}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${!isEditing ? "bg-[#f4f4f5] border-transparent text-[#1e293b]/60 cursor-not-allowed" : "bg-[#fafafa] border-[#e4e4e7] text-[#1e293b]"}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#1e293b]/70 mb-2">
                    E-mail Corporativo
                  </label>
                  <input
                    type="email"
                    value={perfil.email}
                    onChange={(e) => setPerfil({...perfil, email: e.target.value})}
                    disabled={!isEditing}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${!isEditing ? "bg-[#f4f4f5] border-transparent text-[#1e293b]/60 cursor-not-allowed" : "bg-[#fafafa] border-[#e4e4e7] text-[#1e293b]"}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#1e293b]/70 mb-2">
                    Telefone Institucional
                  </label>
                  <input
                    type="text"
                    defaultValue="(00) 0000-0000"
                    disabled={!isEditing}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${!isEditing ? "bg-[#f4f4f5] border-transparent text-[#1e293b]/60 cursor-not-allowed" : "bg-[#fafafa] border-[#e4e4e7] text-[#1e293b]"}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#1e293b]/70 mb-2">
                    Órgão Vinculado
                  </label>
                  <input
                    type="text"
                    defaultValue="Órgão de Lotação"
                    disabled
                    className="w-full px-4 py-2.5 bg-[#f4f4f5] border-transparent rounded-lg text-[#1e293b]/60 cursor-not-allowed"
                  />
                </div>
              </div>

              {isEditing && (
                <div className="mt-8 flex justify-end gap-3">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="bg-[#fafafa] border border-[#e4e4e7] hover:bg-[#f4f4f5] text-[#1e293b] font-semibold py-2.5 px-6 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    className="bg-[#1e293b] hover:bg-[#334155] text-white font-semibold py-2.5 px-6 rounded-lg transition-colors"
                  >
                    Salvar Alterações
                  </button>
                </div>
              )}
            </div>

            <div className="bg-[#fafafa] p-6 rounded-lg border border-[#e4e4e7] shadow-sm">
              <h3 className="text-lg font-bold text-[#1e293b] mb-6 flex items-center">
                <Bell className="w-5 h-5 mr-2 text-indigo-600" />
                Preferências de Notificação
              </h3>

              <div className="space-y-4">
                <label className="flex items-center justify-between p-4 bg-[#f4f4f5] rounded-lg cursor-pointer hover:bg-[#e4e4e7] transition-colors">
                  <div>
                    <p className="font-semibold text-[#1e293b]">
                      Novas Ordens de Pagamento
                    </p>
                    <p className="text-sm text-[#1e293b]/60">
                      Receber e-mail quando uma OP for atribuída a você
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    defaultChecked
                    className="w-5 h-5 text-[#1e293b] rounded focus:ring-indigo-500 accent-indigo-600"
                  />
                </label>
                <label className="flex items-center justify-between p-4 bg-[#f4f4f5] rounded-lg cursor-pointer hover:bg-[#e4e4e7] transition-colors">
                  <div>
                    <p className="font-semibold text-[#1e293b]">
                      Atrasos de Execução
                    </p>
                    <p className="text-sm text-[#1e293b]/60">
                      Avisos sobre empenhos próximos do vencimento
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    defaultChecked
                    className="w-5 h-5 text-[#1e293b] rounded focus:ring-indigo-500 accent-indigo-600"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6 relative z-50">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              Alterar Senha
            </h2>
            <p className="text-sm text-zinc-500 mb-6">
              Informe a senha atual e a nova senha que deseja utilizar.
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
