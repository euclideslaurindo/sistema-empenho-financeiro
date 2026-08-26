import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Credor {
  id: string;
  nome: string;
  endereco: string;
  cpfCnpj: string;
  pis: string;
  rg: string;
  dataExpedicao: string;
}

interface AppState {
  credores: Credor[];
  addCredor: (credor: Credor) => void;
  updateCredor: (id: string, credor: Credor) => void;
  deleteCredor: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      credores: [
        { id: '1', nome: 'Jose Silva Oliveira', endereco: 'Rua A, 123', cpfCnpj: '111.111.111-11', pis: '', rg: '123456 SDS-PE', dataExpedicao: '2020-01-01' },
        { id: '2', nome: 'Maria Cavalcanti S/A', endereco: 'Av B, 456', cpfCnpj: '22.222.222/0001-22', pis: '', rg: '654321 SDS-PE', dataExpedicao: '2019-05-10' },
        { id: '3', nome: 'Tech Solution LTDA', endereco: 'Praça C, 789', cpfCnpj: '33.333.333/0001-33', pis: '', rg: '987654 SDS-PE', dataExpedicao: '2021-10-20' },
      ],
      addCredor: (credor) => set((state) => ({ credores: [...state.credores, credor] })),
      updateCredor: (id, updatedCredor) => set((state) => ({
        credores: state.credores.map((c) => c.id === id ? updatedCredor : c)
      })),
      deleteCredor: (id) => set((state) => ({
        credores: state.credores.filter((c) => c.id !== id)
      })),
    }),
    {
      name: 'sistema-empenho-storage',
    }
  )
);
