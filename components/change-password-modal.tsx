"use client";
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ChangePasswordModalProps {
  onClose: () => void;
}

export function ChangePasswordModal({ onClose }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  // Confirmação: um erro de digitação na senha nova deixava o usuário sem acesso.
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const senhasDiferentes = confirmPassword.length > 0 && confirmPassword !== newPassword;

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Por favor, preencha todas as senhas.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("A confirmação não é igual à nova senha.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("A nova senha deve ter no mínimo 8 caracteres.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/perfil/senha', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senhaAtual: currentPassword, novaSenha: newPassword })
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Sua senha foi redefinida com sucesso.");
        onClose();
      } else {
        toast.error(data.error || "Erro ao alterar a senha.");
      }
    } catch (err) {
      toast.error("Erro de conexão com o servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogTitle>Alterar Senha</DialogTitle>
        <DialogDescription>
          Informe a senha atual e defina uma nova senha forte.
        </DialogDescription>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label htmlFor="current-password" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Senha Atual
            </label>
            <input
              id="current-password"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0f2942]"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label htmlFor="new-password" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Nova Senha
            </label>
            <input
              id="new-password"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0f2942]"
              disabled={isSubmitting}
              minLength={8}
              aria-describedby="new-password-ajuda"
            />
            <p id="new-password-ajuda" className="text-xs text-slate-500 mt-1">Mínimo de 8 caracteres.</p>
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Confirmar Nova Senha
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              aria-invalid={senhasDiferentes}
              aria-describedby={senhasDiferentes ? "confirm-password-erro" : undefined}
              className={`w-full px-4 py-3 mb-2 bg-zinc-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0f2942] ${senhasDiferentes ? "border-red-400" : "border-zinc-200"}`}
              disabled={isSubmitting}
            />
            {senhasDiferentes && (
              <p id="confirm-password-erro" role="alert" className="text-xs font-semibold text-red-600">
                A confirmação não é igual à nova senha.
              </p>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold py-2.5 rounded-lg transition-colors shadow-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || senhasDiferentes}
              className="flex-1 bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-md shadow-slate-900/20 ring-1 ring-white/10 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
