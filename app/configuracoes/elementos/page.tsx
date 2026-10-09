"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import ElementosTable from "@/components/admin/ElementosTable";

function TelaCarregando() {
  return (
    <div className="p-8 max-w-[1400px] mx-auto w-full space-y-4">
      <div className="h-10 w-64 skeleton rounded-xl" />
      <div className="h-64 skeleton rounded-3xl" />
    </div>
  );
}

export default function ElementosConfigPage() {
  const router = useRouter();
  const userProfile = useAppStore((s) => s.userProfile);

  useEffect(() => {
    if (userProfile && userProfile.perfil !== "ADMIN") {
      toast.error("Acesso restrito a administradores.");
      router.push("/configuracoes");
    }
  }, [userProfile, router]);

  if (!userProfile) {
    return <TelaCarregando />;
  }
  if (userProfile.perfil !== "ADMIN") {
    return null;
  }

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="p-8 max-w-[1400px] mx-auto w-full flex-1 space-y-8 animate-fade-in">
        <div>
          <div className="flex items-center text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">
            Início &gt; Configurações &gt; <span className="text-blue-900 ml-1">Elementos</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight">Elementos e Subelementos</h1>
        </div>
        <ElementosTable />
      </div>
    </div>
  );
}
