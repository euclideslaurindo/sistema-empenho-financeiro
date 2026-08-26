"use client";
import { useState } from "react";
import { Lock, User, AlertCircle, Loader2 } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });
      const data = await res.json();
      
      if (res.ok) {
        window.location.href = "/";
      } else {
        setError(data.error || "Credenciais inválidas");
      }
    } catch (e) {
      setError("Erro de conexão com o servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f4f5] relative overflow-hidden">
      <div className="absolute top-[-100px] left-[-100px] w-96 h-96 bg-[#1e293b] rounded-full blur-3xl opacity-20"></div>
      <div className="absolute bottom-[-100px] right-[-100px] w-96 h-96 bg-blue-900 rounded-full blur-3xl opacity-20"></div>
      
      <div className="bg-white p-10 rounded-2xl shadow-[0px_10px_30px_rgba(0,0,0,0.05)] w-full max-w-md relative z-10 border border-gray-100">
        <div className="mb-10 text-center">
          <div className="w-16 h-16 bg-[#1e293b] rounded-2xl mx-auto flex items-center justify-center shadow-lg mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Sistema de Empenho</h1>
          <p className="text-sm text-zinc-500 mt-1">Gestão Financeira Integrada</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm flex items-center gap-2 mb-6 animate-in slide-in-from-top-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-2 uppercase tracking-wide">
              E-mail ou Usuário
            </label>
            <div className="relative">
              <User className="w-5 h-5 absolute left-3 top-[10px] text-zinc-400" />
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@admin.com"
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e293b] focus:bg-white transition-all text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-2 uppercase tracking-wide">
              Senha de Acesso
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 absolute left-3 top-[10px] text-zinc-400" />
              <input
                type="password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e293b] focus:bg-white transition-all text-slate-800"
              />
            </div>
            <div className="flex justify-end mt-2">
              <a href="#" className="text-xs text-blue-600 hover:underline font-medium">Esqueceu a senha?</a>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#1e293b] hover:bg-[#0f172a] text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 mt-4 shadow-md"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Acessar Sistema"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-zinc-400">© 2026 - Departamento Financeiro</p>
        </div>
      </div>
    </div>
  );
}
