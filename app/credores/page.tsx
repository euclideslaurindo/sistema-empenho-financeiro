"use client";
import { useState, useEffect, useCallback } from "react";
import { ActionToolbar, ActionButton } from "@/components/action-toolbar";
import {
  Plus,
  Save,
  Edit2,
  Search,
  Trash2,
  MapPin,
  X,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface Credor {
  id: string;
  nome: string;
  endereco: string;
  cpfCnpj: string;
  pis: string;
  rg: string;
  dataExpedicao: string;
}

export default function Credores() {
  const [credores, setCredores] = useState<Credor[]>([]);
  const [formData, setFormData] = useState<Partial<Credor>>({});
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Busca credores da API
  const fetchCredores = useCallback(async (busca = "") => {
    setIsLoading(true);
    try {
      const url = busca
        ? `/api/credores?busca=${encodeURIComponent(busca)}`
        : "/api/credores";
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setCredores(data.credores || []);
      } else {
        toast.error(data.error || "Erro ao carregar credores.");
      }
    } catch {
      toast.error("Erro de conexão com o servidor.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredores();
  }, [fetchCredores]);

  // Validações locais (UI rápida)
  const checkDuplicateCpfCnpj = (cpfCnpj: string, currentId?: string) => {
    if (!cpfCnpj) return null;
    const clean = cpfCnpj.replace(/\D/g, "");
    if (!clean) return null;
    return credores.find(
      (c) => c.id !== currentId && c.cpfCnpj.replace(/\D/g, "") === clean
    );
  };

  const checkDuplicateName = (nome: string, currentId?: string) => {
    if (!nome) return null;
    const clean = nome.trim().toLowerCase();
    return credores.find(
      (c) => c.id !== currentId && c.nome.trim().toLowerCase() === clean
    );
  };

  const dupCpfCnpj = formData.cpfCnpj
    ? checkDuplicateCpfCnpj(formData.cpfCnpj, formData.id)
    : null;
  const dupName = formData.nome
    ? checkDuplicateName(formData.nome, formData.id)
    : null;

  const formatCpfCnpj = (value: string) => {
    const v = value.replace(/\D/g, "");
    if (v.length <= 11) {
      return v.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
      return v.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2").substr(0, 18);
    }
  };

  const formatPis = (value: string) => {
    return value.replace(/\D/g, "").replace(/^(\d{3})(\d)/, "$1.$2").replace(/^(\d{3})\.(\d{5})(\d)/, "$1.$2.$3").replace(/\.(\d{5})\.(\d{2})(\d)/, ".$1.$2-$3").substr(0, 14);
  };

  const handleChange = (field: keyof Credor, value: string) => {
    let val = value;
    if (field === 'cpfCnpj') val = formatCpfCnpj(val);
    if (field === 'pis') val = formatPis(val);
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  const handleClear = () => {
    setFormData({});
    toast.info("Formulário limpo");
  };

  const handleIncluir = () => {
    setFormData({});
  };

  const handleSalvar = async () => {
    if (!formData.nome || !formData.endereco || !formData.cpfCnpj || !formData.rg) {
      toast.error("Preencha os campos obrigatórios (*)");
      return;
    }
    if (dupCpfCnpj) {
      toast.error(`CPF/CNPJ já pertence ao credor "${dupCpfCnpj.nome}".`);
      return;
    }
    if (dupName) {
      toast.error(`Nome já pertence ao credor "${dupName.nome}".`);
      return;
    }

    setIsSaving(true);
    try {
      let res: Response;
      if (formData.id) {
        // UPDATE
        res = await fetch(`/api/credores/${formData.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
      } else {
        // CREATE
        const newId = crypto.randomUUID();
        res = await fetch("/api/credores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...formData, id: newId }),
        });
        if (res.ok) setFormData((prev) => ({ ...prev, id: newId }));
      }

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erro ao salvar credor.");
        return;
      }

      toast.success(formData.id ? "Credor atualizado com sucesso!" : "Credor salvo com sucesso!");
      await fetchCredores();
    } catch {
      toast.error("Erro de conexão com o servidor.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExcluir = async () => {
    if (!formData.id) {
      toast.error("Nenhum credor selecionado para excluir.");
      return;
    }
    if (!confirm("Tem certeza que deseja desativar este credor? Ele será ocultado do sistema, mas mantido no banco para integridade histórica.")) return;
    try {
      const res = await fetch(`/api/credores/${formData.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Erro ao excluir.");
        return;
      }
      toast.success("Credor excluído com sucesso!");
      setFormData({});
      await fetchCredores();
    } catch {
      toast.error("Erro de conexão com o servidor.");
    }
  };

  const handleLoadCredor = (credor: Credor) => {
    setFormData(credor);
    setIsSearching(false);
  };

  const filteredCredores = credores.filter(
    (c) =>
      c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cpfCnpj.includes(searchTerm)
  );

  return (
    <div className="flex flex-col h-full bg-[#f4f4f5] relative">
      <ActionToolbar>
        <ActionButton icon={Plus} label="Incluir" onClick={handleIncluir} />
        <ActionButton icon={Save} label="Salvar" onClick={handleSalvar} />
        <ActionButton
          icon={Search}
          label="Localizar"
          onClick={() => setIsSearching(true)}
        />
        <ActionButton
          icon={Trash2}
          label="Excluir"
          warning
          onClick={handleExcluir}
        />
        <ActionButton
          icon={RefreshCw}
          label="Atualizar"
          onClick={() => fetchCredores()}
        />
      </ActionToolbar>

      <div className="p-8 max-w-[1280px] mx-auto w-full flex-1">
        <div className="mb-8">
          <p className="text-xs font-medium text-zinc-500 mb-2 tracking-wider">
            Início &gt; Administração &gt; Cadastro de Credores
          </p>
          <h1 className="text-3xl font-bold text-[#1e293b] mb-1">
            Cadastro de Credores
          </h1>
          <p className="text-zinc-600 text-sm">
            Gerencie as informações detalhadas de pessoas físicas e jurídicas
            para processos de empenho.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Main form */}
          <div className="bg-[#fafafa] rounded-lg border border-[#e4e4e7] shadow-sm p-8 flex-1 w-full relative">
            <div className="flex items-center mb-6">
              <div className="w-2 h-8 bg-[#1e293b] rounded-r-md mr-4 -ml-8"></div>
              <h2 className="text-xl font-bold text-[#1e293b]">
                Dados Cadastrais
              </h2>
              {formData.id && (
                <span className="ml-3 text-xs font-semibold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                  Editando
                </span>
              )}
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  Nome Completo / Razão Social{" "}
                  <span className="text-[#ba1a1a]">*</span>
                </label>
                <input
                  type="text"
                  value={formData.nome || ""}
                  onChange={(e) => handleChange("nome", e.target.value)}
                  placeholder="Digite o nome completo ou razão social"
                  className={`w-full p-2.5 border rounded text-sm focus:outline-none text-slate-800 ${
                    dupName
                      ? "border-amber-500 bg-amber-50/50 focus:border-amber-600"
                      : "border-[#d9dadb] focus:border-[#1e293b]"
                  }`}
                />
                {dupName && (
                  <div className="mt-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded flex items-center gap-1.5 animate-pulse">
                    <span>
                      ⚠️ Já existe um credor com este Nome:{" "}
                      <strong>{dupName.nome}</strong>.
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-1">
                  Endereço Completo <span className="text-[#ba1a1a]">*</span>
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    type="text"
                    value={formData.endereco || ""}
                    onChange={(e) => handleChange("endereco", e.target.value)}
                    placeholder="Rua, Número, Complemento, Bairro"
                    className="w-full pl-9 pr-3 py-2.5 border border-[#d9dadb] rounded text-sm focus:outline-none focus:border-[#1e293b] text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    CPF / CNPJ <span className="text-[#ba1a1a]">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.cpfCnpj || ""}
                    onChange={(e) => handleChange("cpfCnpj", e.target.value)}
                    placeholder="000.000.000-00 ou 00.000.000/0001-00"
                    className={`w-full p-2.5 border rounded text-sm focus:outline-none text-slate-800 ${
                      dupCpfCnpj
                        ? "border-amber-500 bg-amber-50/50 focus:border-amber-600"
                        : "border-[#d9dadb] focus:border-[#1e293b]"
                    }`}
                  />
                  {dupCpfCnpj && (
                    <div className="mt-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded flex items-center gap-1.5 animate-pulse">
                      <span>
                        ⚠️ CPF/CNPJ já cadastrado:{" "}
                        <strong>{dupCpfCnpj.nome}</strong>.
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    PIS
                  </label>
                  <input
                    type="text"
                    value={formData.pis || ""}
                    onChange={(e) => handleChange("pis", e.target.value)}
                    placeholder="000.00000.00-0"
                    className="w-full p-2.5 border border-[#d9dadb] rounded text-sm focus:outline-none focus:border-[#1e293b] text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    RG com Órgão Emissor / IE{" "}
                    <span className="text-[#ba1a1a]">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.rg || ""}
                    onChange={(e) => handleChange("rg", e.target.value)}
                    placeholder="Ex: 1.234.567 SDS-PE ou ISENTO"
                    className="w-full p-2.5 border border-[#d9dadb] rounded text-sm focus:outline-none focus:border-[#1e293b] text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1">
                    Data de Expedição do RG
                  </label>
                  <input
                    type="date"
                    value={formData.dataExpedicao || ""}
                    onChange={(e) =>
                      handleChange("dataExpedicao", e.target.value)
                    }
                    className="w-full p-2 border border-[#d9dadb] bg-[#fafafa] rounded text-sm focus:outline-none focus:border-[#1e293b] text-slate-800 [color-scheme:light]"
                  />
                </div>
              </div>
            </div>

            <div className="mt-10 flex justify-end gap-4">
              <button
                onClick={handleClear}
                className="px-6 py-2.5 border border-[#737780] text-slate-800 rounded text-sm font-semibold hover:bg-[#f3f4f5] transition-colors"
              >
                Limpar
              </button>
              <button
                onClick={handleSalvar}
                disabled={isSaving}
                className="px-6 py-2.5 bg-[#1e293b] text-white rounded text-sm font-semibold hover:bg-[#003366] transition-colors disabled:opacity-60"
              >
                {isSaving ? "Salvando..." : "Salvar Credor"}
              </button>
            </div>
          </div>

          {/* Right sidebar info blocks */}
          <div className="w-full lg:w-[320px] space-y-6">
            <div className="bg-[#1e293b] rounded-lg p-6 text-white relative overflow-hidden">
              <div className="absolute right-0 bottom-0 opacity-10 w-32 h-32 transform translate-x-4 translate-y-4 rounded-full border-[16px] border-[#fafafa]"></div>
              <h3 className="text-xs font-bold text-[#fcd400] uppercase tracking-wider mb-2">
                Dica do Sistema
              </h3>
              <p className="text-sm font-medium leading-relaxed z-10 relative">
                Mantenha os dados bancários sempre atualizados para evitar
                atrasos em ordens de pagamento.
              </p>
            </div>

            <div className="bg-[#fafafa] rounded-lg border border-[#e4e4e7] shadow-sm pb-4">
              <h3 className="p-4 py-3 bg-[#f4f4f5] border-b border-[#e4e4e7] text-zinc-600 font-semibold text-sm flex justify-between items-center">
                {isLoading ? "Carregando..." : `${credores.length} Credores`}
                <Search
                  className="w-4 h-4 cursor-pointer"
                  onClick={() => setIsSearching(true)}
                />
              </h3>
              <ul className="text-sm">
                {credores
                  .slice(0, 4)
                  .map((c) => (
                    <li
                      key={c.id}
                      className="flex justify-between items-center py-2.5 px-4 border-b border-[#f3f4f5]"
                    >
                      <span
                        className="text-slate-800 truncate pr-2 max-w-[200px]"
                        title={c.nome}
                      >
                        {c.nome}
                      </span>
                      <span
                        onClick={() => handleLoadCredor(c)}
                        className="text-[#1e293b] font-semibold cursor-pointer hover:underline text-xs"
                      >
                        Ver
                      </span>
                    </li>
                  ))}
                {credores.length === 0 && !isLoading && (
                  <li className="py-4 px-4 text-center text-zinc-500 text-xs">
                    Nenhum credor cadastrado
                  </li>
                )}
              </ul>
              <div className="px-4 mt-2">
                <button
                  onClick={() => setIsSearching(true)}
                  className="w-full text-center text-xs font-bold text-zinc-600 hover:text-[#1e293b] uppercase tracking-wider border border-[#d9dadb] rounded py-2"
                >
                  Ver todos os credores
                </button>
              </div>
            </div>

            <div className="bg-[#1e293b] rounded-lg p-6 text-white">
              <h3 className="text-sm font-semibold flex items-center mb-2">
                <span className="w-5 h-5 rounded-full border border-[#fafafa] flex items-center justify-center text-xs mr-2">
                  i
                </span>{" "}
                Requisito de PIS
              </h3>
              <p className="text-xs text-[#a7c8ff] leading-relaxed">
                O campo PIS é obrigatório apenas para credores do tipo
                &apos;Pessoa Física Autônoma&apos;. Para os demais, o campo pode
                ser deixado em branco.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-[#e4e4e7] flex flex-col md:flex-row justify-between text-xs text-zinc-500">
          <p>Sistema de Empenho - Gestão de Pagamentos © 2024</p>
          <div className="flex gap-4 mt-2 md:mt-0">
            <a href="#" className="hover:text-[#1e293b]">
              Termos de Uso
            </a>
            <a href="#" className="hover:text-[#1e293b]">
              Privacidade
            </a>
            <a href="#" className="hover:text-[#1e293b]">
              Suporte ao Usuário
            </a>
          </div>
        </div>
      </div>

      {/* Modal Localizar */}
      {isSearching && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#fafafa] rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-[#e4e4e7]">
              <h3 className="text-lg font-bold text-[#1e293b]">
                Localizar Credor
              </h3>
              <button
                onClick={() => {
                  setIsSearching(false);
                  setSearchTerm("");
                }}
                className="text-zinc-600 hover:text-black"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-[#e4e4e7]">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Buscar por nome ou CPF/CNPJ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-[#d9dadb] rounded text-sm focus:outline-none focus:border-[#1e293b]"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredCredores.length > 0 ? (
                filteredCredores.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 border border-[#e4e4e7] rounded hover:bg-[#f4f4f5] cursor-pointer"
                    onClick={() => handleLoadCredor(c)}
                  >
                    <div>
                      <p className="font-semibold text-slate-800">{c.nome}</p>
                      <p className="text-xs text-zinc-500">{c.cpfCnpj}</p>
                    </div>
                    <span className="text-sm font-semibold text-[#1e293b]">
                      Carregar
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center text-sm text-zinc-500 py-4">
                  Nenhum credor encontrado.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
