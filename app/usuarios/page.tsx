"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, ShieldAlert, Trash2, UserX, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { useAppStore } from "@/lib/store";
import { ID_ADMIN_RAIZ, PERFIS_USUARIO, ROTULO_PERFIL, SENHA_MINIMA } from "@/lib/perfis-usuario";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

const FORM_VAZIO = { nome: "", email: "", senha: "", perfil: "GESTOR" };
const PAGE_SIZE = 10;
const COR_PERFIL: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  GESTOR: "bg-blue-100 text-blue-700",
  CONSULTA: "bg-slate-100 text-slate-700",
};
const campo = "w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 font-bold focus:border-blue-800 outline-none";
const rotulo = "block text-sm font-black text-slate-500 uppercase tracking-widest mb-2";

export default function UsuariosPage() {
  const userProfile = useAppStore((s) => s.userProfile);
  const ehAdmin = userProfile?.perfil === "ADMIN";

  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(FORM_VAZIO);
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [trocaPerfil, setTrocaPerfil] = useState<{ usuario: any; perfil: string } | null>(null);

  const totalPaginas = Math.max(1, Math.ceil(usuarios.length / PAGE_SIZE));

  const fetchUsuarios = useCallback(async () => {
    try {
      const data = await apiClient.get<{ usuarios: any[] }>("/api/usuarios");
      setUsuarios(data.usuarios || []);
    } catch (error: any) {
      toast.error(error.message || "Erro ao carregar usuários.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Só o admin carrega a lista (os outros veem o aviso, sem chamar a API).
  useEffect(() => {
    if (!ehAdmin) return;
    const init = async () => {
      await fetchUsuarios();
    };
    init();
  }, [ehAdmin, fetchUsuarios]);

  // Excluir o último da página não deixa a lista numa página vazia.
  const paginaAtual = Math.min(currentPage, totalPaginas);

  // Sem botões de bloquear/excluir/trocar perfil para si mesmo e para o admin raiz
  // (o servidor recusa; antes a recusa só vinha depois do clique).
  const protegido = (u: any) => u.id === userProfile?.id || u.id === ID_ADMIN_RAIZ;

  const abrirNovo = () => {
    setFormData(FORM_VAZIO); // antes reabria com os dados (e a senha) do anterior
    setShowModal(true);
  };

  const handleCreate = async () => {
    if (!formData.nome.trim() || !formData.email.trim() || !formData.senha) {
      toast.error("Preencha todos os campos");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      toast.error("Formato de e-mail inválido.");
      return;
    }
    if (formData.senha.length < SENHA_MINIMA) {
      toast.error(`A senha provisória deve ter no mínimo ${SENHA_MINIMA} caracteres.`);
      return;
    }

    try {
      await apiClient.post("/api/usuarios", formData);
      toast.success("Usuário criado com sucesso!");
      setShowModal(false);
      setFormData(FORM_VAZIO);
      fetchUsuarios();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar usuário");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await apiClient.delete(`/api/usuarios/${deleteTargetId}`);
      toast.success("Usuário excluído");
      fetchUsuarios();
    } catch (error: any) {
      toast.error(error.message || "Erro ao excluir");
    } finally {
      setDeleteTargetId(null);
    }
  };

  const handleToggleBloqueio = async (id: string, ativoAtual: number) => {
    const novoStatus = Number(ativoAtual) === 1 ? 0 : 1;
    try {
      await apiClient.put(`/api/usuarios/${id}`, { ativo: novoStatus });
      toast.success(`Usuário ${novoStatus === 1 ? "desbloqueado" : "bloqueado"}!`);
      fetchUsuarios();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar status");
    }
  };

  const confirmarTrocaPerfil = async () => {
    if (!trocaPerfil) return;
    const { usuario, perfil } = trocaPerfil;
    try {
      await apiClient.put(`/api/usuarios/${usuario.id}`, { perfil });
      toast.success(`${usuario.nome} agora é ${ROTULO_PERFIL[perfil]}.`);
      fetchUsuarios();
    } catch (error: any) {
      toast.error(error.message || "Erro ao trocar o perfil");
    } finally {
      setTrocaPerfil(null);
    }
  };

  if (!userProfile) {
    return <div className="p-8 text-slate-400 font-bold">Carregando...</div>;
  }
  if (!ehAdmin) {
    return (
      <div className="p-8">
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
          <ShieldAlert className="w-5 h-5" /> Acesso restrito a administradores.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 relative p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Gerenciar Usuários</h1>
          <p className="text-sm font-semibold text-slate-500 mt-1 uppercase tracking-widest">
            Apenas Administradores
          </p>
        </div>
        <button
          onClick={abrirNovo}
          className="bg-blue-900 text-white px-6 py-3 rounded-xl font-bold uppercase tracking-wider text-xs hover:bg-blue-800 transition-colors shadow-[0_8px_20px_rgba(37,99,235,0.25)] flex items-center gap-2"
        >
          <Plus size={16} /> Novo Usuário
        </button>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex-1">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">Nome</th>
              <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">E-mail</th>
              <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">Perfil</th>
              <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">Status</th>
              <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-8 text-center text-slate-400 font-bold">Carregando...</td></tr>
            ) : usuarios.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE).map((u) => {
              const ativo = Number(u.ativo) === 1;
              return (
                <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-4 font-bold text-slate-700">{u.nome}</td>
                  <td className="py-4 font-semibold text-slate-500">{u.email}</td>
                  <td className="py-4">
                    {protegido(u) ? (
                      <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${COR_PERFIL[u.perfil] || COR_PERFIL.GESTOR}`}>
                        {ROTULO_PERFIL[u.perfil] || u.perfil}
                      </span>
                    ) : (
                      <select
                        aria-label={`Perfil de ${u.nome}`}
                        value={u.perfil}
                        onChange={(e) => setTrocaPerfil({ usuario: u, perfil: e.target.value })}
                        className={`px-2 py-1 rounded-full text-xs font-black uppercase border-0 ${COR_PERFIL[u.perfil] || COR_PERFIL.GESTOR}`}
                      >
                        {!(PERFIS_USUARIO as readonly string[]).includes(u.perfil) && <option value={u.perfil}>{u.perfil}</option>}
                        {PERFIS_USUARIO.map((p) => (
                          <option key={p} value={p}>{ROTULO_PERFIL[p]}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${ativo ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {ativo ? "Ativo" : "Bloqueado"}
                    </span>
                  </td>
                  <td className="py-4 flex items-center justify-end gap-2">
                    {protegido(u) ? (
                      <span className="text-xs font-semibold text-slate-400">
                        {u.id === userProfile.id ? "Você" : "Admin raiz"}
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleToggleBloqueio(u.id, u.ativo)}
                          className={`p-2 rounded-lg ${ativo ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}
                          title={ativo ? "Bloquear" : "Desbloquear"}
                          aria-label={`${ativo ? "Bloquear" : "Desbloquear"} ${u.nome}`}
                        >
                          {ativo ? <UserX size={16} /> : <UserCheck size={16} />}
                        </button>
                        <button
                          onClick={() => setDeleteTargetId(u.id)}
                          className="p-2 rounded-lg bg-red-100 text-red-700"
                          title="Excluir"
                          aria-label={`Excluir ${u.nome}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Paginação */}
        {!loading && usuarios.length > PAGE_SIZE && (
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-100">
            <span className="text-sm font-semibold text-slate-500">
              Página {paginaAtual} de {totalPaginas} — {usuarios.length} usuários
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, paginaAtual - 1))}
                disabled={paginaAtual === 1}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPaginas, paginaAtual + 1))}
                disabled={paginaAtual === totalPaginas}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogTitle className="text-2xl font-black text-slate-800 tracking-tight mb-6">Novo Usuário</DialogTitle>
          <div className="space-y-4">
            <div>
              <label htmlFor="novo-usuario-nome" className={rotulo}>Nome</label>
              <input id="novo-usuario-nome" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} className={campo} />
            </div>
            <div>
              <label htmlFor="novo-usuario-email" className={rotulo}>E-mail (Login)</label>
              <input id="novo-usuario-email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} type="email" className={campo} />
            </div>
            <div>
              <label htmlFor="novo-usuario-senha" className={rotulo}>Senha Provisória</label>
              <input
                id="novo-usuario-senha"
                value={formData.senha}
                onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                type="password"
                minLength={SENHA_MINIMA}
                aria-describedby="novo-usuario-senha-ajuda"
                className={campo}
              />
              <p id="novo-usuario-senha-ajuda" className="text-xs text-slate-500 mt-1">Mínimo de {SENHA_MINIMA} caracteres.</p>
            </div>
            <div>
              <label htmlFor="novo-usuario-perfil" className={rotulo}>Perfil</label>
              <select id="novo-usuario-perfil" value={formData.perfil} onChange={(e) => setFormData({ ...formData, perfil: e.target.value })} className={campo}>
                {PERFIS_USUARIO.map((p) => (
                  <option key={p} value={p}>{ROTULO_PERFIL[p]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-4 mt-8">
            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 font-bold uppercase rounded-xl hover:bg-slate-200">Cancelar</button>
            <button onClick={handleCreate} className="flex-1 px-4 py-3 bg-blue-900 text-white font-bold uppercase rounded-xl hover:bg-blue-800">Salvar</button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!trocaPerfil} onOpenChange={(open) => !open && setTrocaPerfil(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Trocar o perfil?</AlertDialogTitle>
          <AlertDialogDescription>
            {trocaPerfil?.usuario.nome} passa de {ROTULO_PERFIL[trocaPerfil?.usuario.perfil] || trocaPerfil?.usuario.perfil} para{" "}
            {trocaPerfil ? ROTULO_PERFIL[trocaPerfil.perfil] : ""}. Vale a partir do próximo clique dele no sistema.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarTrocaPerfil}>Trocar perfil</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
          <AlertDialogDescription>
            Só é possível excluir quem nunca registrou nada no sistema. Quem já tem NE, credor, OP, DARF ou registro na auditoria
            deve ser bloqueado, para preservar o histórico de quem fez cada coisa.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
