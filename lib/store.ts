import { create } from 'zustand';
import type { PerfilUsuario } from '@/lib/perfis-usuario';

export interface UserProfile {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
}

interface AppState {
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile | null) => void;
  // Usado pela tela de Retenções (T07) para avisar o Sidebar que há
  // alterações não salvas, via onNavigate dos <Link> (ver components/sidebar.tsx).
  navigationBlocked: boolean;
  setNavigationBlocked: (blocked: boolean) => void;
}

export const useAppStore = create<AppState>()(
  (set) => ({
    userProfile: null,
    setUserProfile: (profile) => set({ userProfile: profile }),
    navigationBlocked: false,
    setNavigationBlocked: (blocked) => set({ navigationBlocked: blocked }),
  })
);
