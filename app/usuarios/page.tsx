"use client";
import { useState, useEffect } from "react";
import { Plus, Save, Search, Trash2, ShieldAlert, UserX, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
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

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ nome: "", email: "", senha: "", perfil: "USER" });
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const PAGE_SIZE = 10;

  const fetchUsuarios = async () => {
    try {
      const data = await apiClient.get<{ usuarios: any[] }>("/api/usuarios");
      setUsuarios(data.usuarios);
    } catch (error: any) {
      toast.error(error.message || "Erro ao carregar usuários. Você é ADMIN?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const handleCreate = async () => {
    if (!formData.nome || !formData.email || !formData.senha) {
      toast.error("Preencha todos os campos");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      toast.error("Formato de e-mail inválido.");
      return;
    }

    try {
      const { error } = await apiClient.post("/api/usuarios", formData);
      if (error) throw new Error(error.message);
      toast.success("Usuário criado com sucesso!");
      setShowModal(false);
      fetchUsuarios();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar usuário");
    }
  };

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      const { error } = await apiClient.delete(`/api/usuarios/${deleteTargetId}`);
      if (error) throw new Error(error.message);
      toast.success("Usuário deletado");
      fetchUsuarios();
    } catch (error: any) {
      toast.error(error.message || "Erro ao deletar");
    } finally {
      setDeleteTargetId(null);
    }
  };

  const handleToggleBloqueio = async (id: string, ativoAtual: number) => {
    const novoStatus = ativoAtual === 1 ? 0 : 1;
    try {
      const { error } = await apiClient.put(`/api/usuarios/${id}`, { ativo: novoStatus });
      if (error) throw new Error(error.message);
      toast.success(`Usuário ${novoStatus === 1 ? 'desbloqueado' : 'bloqueado'}!`);
      fetchUsuarios();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar status");
    }
  };

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
          onClick={() => setShowModal(true)}
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
              <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">Cargo</th>
              <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">Status</th>
              <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-8 text-center text-slate-400 font-bold">Carregando...</td></tr>
            ) : usuarios.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((u) => (
              <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="py-4 font-bold text-slate-700">{u.nome}</td>
                <td className="py-4 font-semibold text-slate-500">{u.email}</td>
                <td className="py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${u.perfil === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {u.perfil}
                  </span>
                </td>
                <td className="py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${u.ativo === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {u.ativo === 1 ? 'Ativo' : 'Bloqueado'}
                  </span>
                </td>
                <td className="py-4 flex items-center justify-end gap-2">
                  <button onClick={() => handleToggleBloqueio(u.id, u.ativo)} className={`p-2 rounded-lg ${u.ativo === 1 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`} title={u.ativo === 1 ? 'Bloquear' : 'Desbloquear'}>
                    {u.ativo === 1 ? <UserX size={16} /> : <UserCheck size={16} />}
                  </button>
                  <button onClick={() => handleDelete(u.id)} className="p-2 rounded-lg bg-red-100 text-red-700" title="Excluir (CUIDADO)">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Paginação */}
        {!loading && usuarios.length > PAGE_SIZE && (
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-100">
            <span className="text-sm font-semibold text-slate-500">
              Página {currentPage} de {Math.ceil(usuarios.length / PAGE_SIZE)} — {usuarios.length} usuários
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(usuarios.length / PAGE_SIZE), p + 1))}
                disabled={currentPage === Math.ceil(usuarios.length / PAGE_SIZE)}
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
              <label htmlFor="novo-usuario-nome" className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Nome</label>
              <input id="novo-usuario-nome" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 font-bold focus:border-blue-800 outline-none" />
            </div>
            <div>
              <label htmlFor="novo-usuario-email" className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">E-mail (Login)</label>
              <input id="novo-usuario-email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} type="email" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 font-bold focus:border-blue-800 outline-none" />
            </div>
            <div>
              <label htmlFor="novo-usuario-senha" className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Senha Provisória</label>
              <input id="novo-usuario-senha" value={formData.senha} onChange={(e) => setFormData({ ...formData, senha: e.target.value })} type="password" className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 font-bold focus:border-blue-800 outline-none" />
            </div>
            <div>
              <label htmlFor="novo-usuario-perfil" className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">Permissão</label>
              <select id="novo-usuario-perfil" value={formData.perfil} onChange={(e) => setFormData({ ...formData, perfil: e.target.value })} className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 font-bold focus:border-blue-800 outline-none">
                <option value="USER">Comum</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
          </div>
          <div className="flex gap-4 mt-8">
            <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 font-bold uppercase rounded-xl hover:bg-slate-200">Cancelar</button>
            <button onClick={handleCreate} className="flex-1 px-4 py-3 bg-blue-900 text-white font-bold uppercase rounded-xl hover:bg-blue-800">Salvar</button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Deletar usuário</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja DELETAR este usuário? Essa ação não pode ser desfeita e pode quebrar dados caso ele tenha notas empenhadas.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Deletar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
