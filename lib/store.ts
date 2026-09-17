import { create } from 'zustand';

export interface UserProfile {
  id: string;
  nome: string;
  email: string;
  perfil: 'ADMIN' | 'USER' | 'CONSULTA';
}

interface AppState {
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile | null) => void;
}

export const useAppStore = create<AppState>()(
  (set) => ({
    userProfile: null,
    setUserProfile: (profile) => set({ userProfile: profile }),
  })
);
