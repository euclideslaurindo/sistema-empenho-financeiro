"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Save,
  Search,
  Trash2,
  Building2,
  AlertTriangle,
  Pencil,
  Eye,
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
  // Novos campos visuais baseados no design
  cidade?: string;
  uf?: string;
  telefone?: string;
  banco?: string;
  agencia?: string;
  contaCorrente?: string;
}

export default function Credores() {
  const [credores, setCredores] = useState<Credor[]>([]);
  const [formData, setFormData] = useState<Partial<Credor>>({});
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
      toast.error("Erro de conexão com o servidor. Carregando dados Mock.");
      setCredores([
        {
          id: "mock-1",
          nome: "Tech Solutions Informática LTDA",
          cpfCnpj: "12.345.678/0001-90",
          endereco: "Rua das Flores, 123",
          cidade: "São Paulo",
          uf: "SP",
          telefone: "(11) 98765-4321",
          banco: "001 - Banco do Brasil",
          agencia: "1234",
          contaCorrente: "5678-9",
          pis: "",
          rg: "",
          dataExpedicao: ""
        },
        {
          id: "mock-2",
          nome: "Construtora Edificar S.A.",
          cpfCnpj: "98.765.432/0001-10",
          endereco: "Av. Principal, 456",
          cidade: "Rio de Janeiro",
          uf: "RJ",
          telefone: "(21) 99887-6655",
          banco: "104 - Caixa",
          agencia: "0987",
          contaCorrente: "6543-2",
          pis: "",
          rg: "",
          dataExpedicao: ""
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await fetchCredores();
    };
    init();
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

  const dupCpfCnpj = formData.cpfCnpj
    ? checkDuplicateCpfCnpj(formData.cpfCnpj, formData.id)
    : null;

  const formatCpfCnpj = (value: string) => {
    const v = value.replace(/\D/g, "");
    if (v.length <= 11) {
      return v.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
      return v.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2").substr(0, 18);
    }
  };

  const handleCnpjBlur = async () => {
    if (!formData.cpfCnpj) return;
    const val = formData.cpfCnpj.replace(/\D/g, "");
    if (val.length === 14) {
      toast.info("Buscando CNPJ...");
      try {
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${val}`);
        if (res.ok) {
          const data = await res.json();
          setFormData(prev => ({
            ...prev,
            nome: data.razao_social,
            endereco: `${data.descricao_tipo_de_logradouro || ''} ${data.logradouro}, ${data.numero}${data.complemento ? ' - ' + data.complemento : ''}, ${data.bairro}`.trim(),
            cidade: data.municipio,
            uf: data.uf,
            telefone: data.ddd_telefone_1 || prev.telefone
          }));
          toast.success("Dados preenchidos via CNPJ!");
        }
      } catch {
        toast.error("Erro ao buscar CNPJ.");
      }
    }
  };

  const handleCepBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "");
    if (val.length === 8) {
      toast.info("Buscando CEP...");
      try {
        const res = await fetch(`https://viacep.com.br/ws/${val}/json/`);
        if (res.ok) {
          const data = await res.json();
          if (!data.erro) {
            setFormData(prev => ({
              ...prev,
              endereco: `${data.logradouro}, , ${data.bairro}`,
              cidade: data.localidade,
              uf: data.uf
            }));
            toast.success("Endereço preenchido!");
          }
        }
      } catch {
        toast.error("Erro ao buscar CEP.");
      }
    }
  };

  const handleChange = (field: keyof Credor | 'cepBusca', value: string) => {
    let val = value;
    if (field === 'cpfCnpj') val = formatCpfCnpj(val);
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  const handleIncluir = () => {
    setFormData({});
  };

  const handleSalvar = async () => {
    if (!formData.nome || !formData.cpfCnpj) {
      toast.error("Preencha ao menos Nome e CPF/CNPJ.");
      return;
    }
    if (dupCpfCnpj) {
      toast.error(`CPF/CNPJ já pertence ao credor "${dupCpfCnpj.nome}".`);
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

      toast.success(formData.id ? "Credor atualizado!" : "Credor salvo com sucesso!");
      await fetchCredores();
    } catch {
      toast.error("Erro de conexão com o servidor.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExcluir = async () => {
    if (!formData.id) {
      toast.error("Nenhum credor selecionado para excluir. Clique em Editar na tabela primeiro.");
      return;
    }
    if (!confirm("Tem certeza que deseja desativar este credor?")) return;
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredCredores = credores.filter(
    (c) =>
      c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cpfCnpj.includes(searchTerm)
  );

  return (
    <div className="flex flex-col h-full bg-transparent">
      <div className="p-8 max-w-[1400px] mx-auto w-full flex-1 space-y-8 animate-fade-in">
        
        {/* HEADER & ACTION BUTTONS */}
        <div className="flex flex-col md:flex-row md:items-end justify-between">
          <div>
            <div className="flex items-center text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">
              Início &gt; Gestão Financeira &gt; <span className="text-blue-900 ml-1">Credores</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight">
              Cadastro de Credores
            </h1>
          </div>
          <div className="mt-6 md:mt-0 flex items-center gap-3">
            <button 
              onClick={handleIncluir}
              className="bg-blue-900 hover:bg-blue-800 text-white text-sm font-bold py-2.5 px-5 rounded-xl shadow-sm transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Incluir
            </button>
            <button 
              onClick={handleSalvar}
              disabled={isSaving}
              className="bg-blue-900 hover:bg-blue-800 text-white text-sm font-bold py-2.5 px-5 rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {isSaving ? "Salvando..." : "Salvar"}
            </button>
            <button 
              onClick={() => { document.getElementById('search-table')?.focus(); }}
              className="bg-white hover:bg-slate-50 text-blue-900 text-sm font-bold py-2.5 px-5 rounded-xl shadow-sm border border-slate-200 transition-all flex items-center gap-2"
            >
              <Search className="w-4 h-4" /> Localizar
            </button>
            <button 
              onClick={handleExcluir}
              className="bg-white hover:bg-red-50 text-red-500 text-sm font-bold py-2.5 px-5 rounded-xl shadow-sm border border-slate-200 hover:border-red-200 transition-all flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Excluir
            </button>
          </div>
        </div>

        {/* FORM SECTION (Glass Panel) */}
        <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
          <div className="flex items-center mb-8 pb-4 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-900 mr-3">
              <Building2 className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">
              {formData.id ? "Editando Credor" : "Dados do Credor"}
            </h2>
            {formData.id && (
              <span className="ml-4 text-xs font-black uppercase tracking-widest bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-full">
                Modo Edição
              </span>
            )}
          </div>

          <form className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Row 1 */}
            <div className="col-span-12 md:col-span-3">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                CNPJ/CPF
              </label>
              <input
                type="text"
                placeholder="00.000.000/0000-00"
                value={formData.cpfCnpj || ""}
                onChange={(e) => handleChange("cpfCnpj", e.target.value)}
                onBlur={handleCnpjBlur}
                className={`w-full px-4 py-3 rounded-xl border text-sm font-bold focus:outline-none focus:ring-4 transition-all duration-300 ${dupCpfCnpj ? 'border-amber-300 bg-amber-50/50 focus:border-amber-500 focus:ring-amber-500/20 text-amber-900' : 'bg-slate-50 border-slate-200/50 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10 text-slate-700'}`}
              />
              {dupCpfCnpj && <p className="text-amber-600 text-xs mt-1.5 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> CPF/CNPJ já cadastrado.</p>}
            </div>

            <div className="col-span-12 md:col-span-9">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                Nome/Razão Social
              </label>
              <input
                type="text"
                placeholder="Razão Social do Credor"
                value={formData.nome || ""}
                onChange={(e) => handleChange("nome", e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-bold focus:outline-none focus:ring-4 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10 text-slate-700 transition-all duration-300"
              />
            </div>

            {/* Row 2 */}
            <div className="col-span-12 md:col-span-2">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                CEP
              </label>
              <input
                type="text"
                placeholder="00000-000"
                maxLength={9}
                onBlur={handleCepBlur}
                className="w-full px-4 py-3 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-bold focus:outline-none focus:ring-4 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10 text-slate-700 transition-all duration-300"
              />
            </div>

            <div className="col-span-12 md:col-span-4">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                Endereço
              </label>
              <input
                type="text"
                placeholder="Rua, Número, Bairro"
                value={formData.endereco || ""}
                onChange={(e) => handleChange("endereco", e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-bold focus:outline-none focus:ring-4 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10 text-slate-700 transition-all duration-300"
              />
            </div>

            <div className="col-span-12 md:col-span-4">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                Cidade
              </label>
              <input
                type="text"
                placeholder="Cidade"
                value={formData.cidade || ""}
                onChange={(e) => handleChange("cidade", e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-bold focus:outline-none focus:ring-4 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10 text-slate-700 transition-all duration-300"
              />
            </div>

            <div className="col-span-12 md:col-span-2">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                UF
              </label>
              <select
                value={formData.uf || ""}
                onChange={(e) => handleChange("uf", e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-bold text-slate-600 focus:outline-none focus:bg-white focus:ring-4 focus:ring-blue-900/10 focus:border-blue-800 transition-all duration-300"
              >
                <option value="">UF</option>
                <option value="SP">SP</option>
                <option value="RJ">RJ</option>
                <option value="MG">MG</option>
              </select>
            </div>

            {/* Row 3 */}
            <div className="col-span-12 md:col-span-3">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                Telefone
              </label>
              <input
                type="text"
                placeholder="(00) 00000-0000"
                value={formData.telefone || ""}
                onChange={(e) => handleChange("telefone", e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-bold focus:outline-none focus:ring-4 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10 text-slate-700 transition-all duration-300"
              />
            </div>

            <div className="col-span-12 md:col-span-4">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                Banco
              </label>
              <input
                type="text"
                placeholder="001 - Banco do Brasil"
                value={formData.banco || ""}
                onChange={(e) => handleChange("banco", e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-bold focus:outline-none focus:ring-4 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10 text-slate-700 transition-all duration-300"
              />
            </div>

            <div className="col-span-12 md:col-span-2">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                Agência
              </label>
              <input
                type="text"
                placeholder="0000-0"
                value={formData.agencia || ""}
                onChange={(e) => handleChange("agencia", e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-bold focus:outline-none focus:ring-4 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10 text-slate-700 transition-all duration-300"
              />
            </div>

            <div className="col-span-12 md:col-span-3">
              <label className="block text-sm font-black text-slate-500 uppercase tracking-widest mb-2">
                Conta Corrente
              </label>
              <input
                type="text"
                placeholder="00000-0"
                value={formData.contaCorrente || ""}
                onChange={(e) => handleChange("contaCorrente", e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200/50 bg-slate-50 text-sm font-bold focus:outline-none focus:ring-4 focus:border-blue-800 focus:bg-white focus:ring-blue-900/10 text-slate-700 transition-all duration-300"
              />
            </div>

          </form>
        </div>

        {/* DATA TABLE (Borderless) */}
        <div className="pb-12">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800 text-xl tracking-tight">
              Credores Registrados
            </h3>
            <div className="relative w-64 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                id="search-table"
                type="text"
                placeholder="Buscar credor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-full text-sm font-medium focus:outline-none focus:ring-4 focus:ring-blue-900/10 focus:border-blue-800 transition-all duration-300"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
             <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-4 pl-2 text-sm font-black text-slate-500 uppercase tracking-widest">CNPJ/CPF</th>
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">Nome/Razão Social</th>
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">Banco</th>
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest">Conta</th>
                  <th className="pb-4 text-sm font-black text-slate-500 uppercase tracking-widest text-center">Status</th>
                  <th className="pb-4 pr-2 text-sm font-black text-slate-500 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                       Carregando...
                    </td>
                  </tr>
                ) : filteredCredores.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                      Nenhum credor encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredCredores.map((c, index) => (
                    <tr
                      key={c.id}
                      onClick={() => handleLoadCredor(c)}
                      className={`group hover:bg-blue-50/50 transition-colors cursor-pointer ${formData.id === c.id ? 'bg-blue-50/50' : ''}`}
                    >
                      <td className="py-5 font-bold text-slate-500 rounded-l-lg pl-2">
                        {c.cpfCnpj}
                      </td>
                      <td className="py-5 font-semibold text-slate-700">
                        {c.nome}
                      </td>
                      <td className="py-5 font-semibold text-slate-600">
                        {c.banco || "Não informado"}
                      </td>
                      <td className="py-5 font-medium text-slate-500">
                        {c.agencia && c.contaCorrente ? `Ag: ${c.agencia} | CC: ${c.contaCorrente}` : "Não informada"}
                      </td>
                      <td className="py-5 text-center">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase bg-emerald-50 text-emerald-600">ATIVO</span>
                      </td>
                      <td className="py-5 text-right rounded-r-lg pr-2">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            title="Visualizar Detalhes"
                            onClick={(e) => {
                              e.stopPropagation();
                              toast.info(`Detalhes do credor: ${c.nome}`);
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-900 hover:bg-white rounded-md transition-all"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            title="Editar"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLoadCredor(c);
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-900 hover:bg-white rounded-md transition-all"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 pt-4 flex justify-between items-center text-sm font-bold text-slate-500 uppercase tracking-widest pb-8">
          <p>© 2026 Gestão de Empenho. Todos os direitos reservados.</p>
          <div className="flex gap-4">
            <span className="hover:text-slate-600 cursor-pointer">Termos de Uso</span>
            <span className="hover:text-slate-600 cursor-pointer">Política de Privacidade</span>
            <span className="hover:text-slate-600 cursor-pointer">Suporte</span>
          </div>
        </div>
      </div>
    </div>
  );
}
