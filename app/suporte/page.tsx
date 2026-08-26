'use client';
import { ActionToolbar, ActionButton } from '@/components/action-toolbar';
import { Send, Book, FileQuestion, MessageSquare, AlertTriangle, FileText, Scale, FileSpreadsheet, Building2, Gavel, FolderOpen, ScrollText, ShieldCheck, RefreshCw, CheckCircle, Search, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

export default function Suporte() {
  const [activeTab, setActiveTab] = useState('chamado');

  const handleAction = (action: string) => {
    toast.success(`Mensagem enviada com sucesso! Protocolo gerado.`);
  };

  const menuItems = [
    { id: 'chamado', label: 'Abrir Chamado', icon: MessageSquare },
    { id: 'manuais', label: 'Manuais', icon: Book },
    { id: 'reforma', label: 'Procedimentos Reforma Tributária', icon: Scale },
    { id: 'microempresas', label: 'Lei das Microempresas', icon: Building2 },
    { id: 'rpa', label: 'RPA', icon: FileSpreadsheet },
    { id: 'isencoes', label: 'Isenções', icon: AlertTriangle },
    { id: 'leis', label: 'Leis', icon: Gavel },
    { id: 'contas', label: 'Prestações de Contas', icon: FolderOpen },
    { id: 'portarias', label: 'Portarias CGE de PE', icon: ScrollText },
  ];

  return (
    <div className="flex flex-col h-full bg-[#f4f4f5]">
      <ActionToolbar>
          <div className="flex-1"></div>
          {activeTab === 'chamado' && <ActionButton icon={Send} label="Enviar Solicitação" primary onClick={() => handleAction('Enviar')} />}
      </ActionToolbar>
      
      <div className="p-8 max-w-[1280px] mx-auto w-full flex-1">
         <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#1e293b]">Suporte e Base de Conhecimento</h1>
            <p className="text-zinc-600 text-sm mt-1">Abra chamados ou pesquise na legislação e manuais atualizados.</p>
         </div>

         <div className="flex flex-col md:flex-row gap-8">
            {/* Sidebar Menu */}
            <div className="w-full md:w-64 flex-shrink-0">
               <nav className="space-y-1">
                  {menuItems.map((item) => (
                     <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                           activeTab === item.id 
                           ? 'bg-[#1e293b] text-white shadow' 
                           : 'text-zinc-600 hover:bg-[#e1e3e4] hover:text-[#1e293b]'
                        }`}
                     >
                        <item.icon className={`w-5 h-5 mr-3 ${activeTab === item.id ? 'text-[#fcd400]' : 'text-zinc-500'}`} />
                        {item.label}
                     </button>
                  ))}
               </nav>
            </div>

            {/* Content Area */}
            <div className="flex-1">
               {activeTab === 'chamado' && (
                  <div className="bg-[#fafafa] rounded-lg border border-[#e4e4e7] shadow-sm p-8 max-w-3xl">
                     <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
                        <MessageSquare className="w-5 h-5 mr-2 text-[#1e293b]" />
                        Abra um Chamado de Suporte
                     </h3>
                     
                     <div className="space-y-6">
                        <div>
                           <label className="block text-xs font-semibold text-zinc-600 mb-2">Assunto / Tipo de Chamado *</label>
                           <select className="w-full p-2.5 border border-[#d9dadb] rounded text-sm focus:outline-none focus:border-[#1e293b] text-slate-800 bg-[#fafafa]">
                              <option>Dúvida sobre a Nova Portaria de Empenhos</option>
                              <option>Erro de processamento em Ordem de Pagamento</option>
                              <option>Inconsistência na Base de Credores</option>
                              <option>Dificuldade de Acesso / Permissão</option>
                              <option>Outros</option>
                           </select>
                        </div>
                        <div>
                           <label className="block text-xs font-semibold text-zinc-600 mb-2">NE ou Documento Relacionado (Opcional)</label>
                           <input type="text" placeholder="Ex: 2024NE00142" className="w-full p-2.5 border border-[#d9dadb] rounded text-sm focus:outline-none focus:border-[#1e293b] text-slate-800" />
                        </div>
                        <div>
                           <label className="block text-xs font-semibold text-zinc-600 mb-2">Descrição Detalhada *</label>
                           <textarea 
                              rows={6} 
                              placeholder="Descreva seu problema ou dúvida com o maior número de detalhes possível..."
                              className="w-full p-3 border border-[#d9dadb] bg-[#fafafa] rounded text-sm focus:outline-none focus:border-[#1e293b] text-slate-800 resize-none" 
                           ></textarea>
                        </div>
                        <div>
                           <label className="block text-xs font-semibold text-zinc-600 mb-2">Anexos (Opcional)</label>
                           <div className="border-2 border-dashed border-[#d9dadb] rounded-lg p-6 flex flex-col items-center justify-center bg-[#f4f4f5] hover:bg-[#e7e8e9] transition-colors cursor-pointer text-center">
                              <AlertTriangle className="w-8 h-8 text-zinc-500 mb-2" />
                              <p className="text-sm font-medium text-zinc-600">Arraste arquivos aqui ou clique para selecionar</p>
                              <p className="text-xs text-zinc-500 mt-1">Imagens (.jpg, .png) ou Documentos (.pdf)</p>
                           </div>
                        </div>
                     </div>
                  </div>
               )}

               {activeTab === 'manuais' && (
                  <div className="space-y-6">
                     <div className="bg-[#1e293b] text-white rounded-lg p-6 shadow-md max-w-3xl">
                        <Book className="w-8 h-8 text-[#fcd400] mb-4" />
                        <h3 className="text-xl font-bold mb-2">Manuais do Sistema de Empenhos</h3>
                        <p className="text-sm text-[#a7c8ff] mb-4 leading-relaxed">
                           Acesse nossos materiais completos detalhando processos de emissão, liquidação, anulação de empenhos e ordens de pagamento.
                        </p>
                        <button onClick={() => toast.info('Baixando Manual Completo...')} className="bg-[#fafafa] text-[#1e293b] text-sm font-bold py-2.5 px-6 rounded hover:bg-[#f0f4ff] transition-colors">
                           Baixar Manual Completo (PDF)
                        </button>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
                        {[
                           "Manual de Ordem de Pagamento",
                           "Guia de Consulta de Credores",
                           "Como Estornar uma Liquidação",
                           "Guia de Impressão de Formulários"
                        ].map((title, i) => (
                           <button key={i} onClick={() => toast.success(`Abrindo: ${title}`)} className="bg-[#fafafa] border border-[#e4e4e7] p-4 text-left rounded-lg hover:border-[#1e293b] hover:shadow-sm transition-all group">
                              <FileText className="w-5 h-5 text-[#1e293b] mb-2 group-hover:scale-110 transition-transform" />
                              <h4 className="font-bold text-slate-800 text-sm">{title}</h4>
                           </button>
                        ))}
                     </div>
                  </div>
               )}

               {activeTab === 'reforma' && (
                  <div className="bg-[#fafafa] rounded-lg border border-[#e4e4e7] shadow-sm p-8 max-w-3xl">
                     <div className="flex items-center mb-6">
                        <Scale className="w-8 h-8 text-[#1e293b] mr-4" />
                        <div>
                           <h3 className="text-xl font-bold text-slate-800">Procedimentos Reforma Tributária</h3>
                           <p className="text-sm text-zinc-500">Impactos e novos procedimentos na execução orçamentária</p>
                        </div>
                     </div>
                     <div className="space-y-4">
                        <div className="p-4 bg-[#f4f4f5] border border-[#e4e4e7] rounded-lg">
                           <div className="flex justify-between items-start">
                              <div>
                                 <h4 className="font-bold text-[#1e293b] text-sm mb-1">Nota Técnica Conjunta nº 01/2024</h4>
                                 <p className="text-xs text-zinc-600">Orientações sobre a retenção de impostos unificados.</p>
                              </div>
                              <button onClick={() => toast.success('Abrindo Nota Técnica...')} className="text-xs bg-[#1e293b] text-white px-3 py-1.5 rounded font-medium hover:bg-[#003366]">Acessar</button>
                           </div>
                        </div>
                        <div className="p-4 bg-[#f4f4f5] border border-[#e4e4e7] rounded-lg">
                           <div className="flex justify-between items-start">
                              <div>
                                 <h4 className="font-bold text-[#1e293b] text-sm mb-1">Tabela de Alíquotas de Transição</h4>
                                 <p className="text-xs text-zinc-600">Tabela atualizada para cálculo de ISS e ICMS na transição.</p>
                              </div>
                              <button onClick={() => toast.success('Baixando Planilha...')} className="text-xs bg-[#1e293b] text-white px-3 py-1.5 rounded font-medium hover:bg-[#003366]">Baixar XLS</button>
                           </div>
                        </div>
                     </div>
                  </div>
               )}

               {activeTab === 'microempresas' && (
                  <div className="bg-[#fafafa] rounded-lg border border-[#e4e4e7] shadow-sm p-8 max-w-3xl">
                     <div className="flex items-center mb-6">
                        <Building2 className="w-8 h-8 text-[#1e293b] mr-4" />
                        <div>
                           <h3 className="text-xl font-bold text-slate-800">Lei das Microempresas</h3>
                           <p className="text-sm text-zinc-500">Tratamento diferenciado e retenções (LC 123/2006)</p>
                        </div>
                     </div>
                     <p className="text-sm text-zinc-600 mb-6 leading-relaxed">
                        Documentação relativa ao tratamento diferenciado aplicável a ME e EPP nos pagamentos do Estado, incluindo declarações de optante do Simples Nacional para isenção de retenções.
                     </p>
                     <div className="grid grid-cols-1 gap-3">
                        <button onClick={() => toast.success('Visualizando conteúdo...')} className="flex items-center p-3 border border-[#d9dadb] rounded hover:bg-[#f4f4f5] transition-colors text-left">
                           <FileText className="w-5 h-5 text-zinc-500 mr-3" />
                           <span className="text-sm font-semibold text-slate-800">Regras de Retenção de Fonte para Optantes do Simples</span>
                        </button>
                        <button onClick={() => toast.success('Baixando Modelo...')} className="flex items-center p-3 border border-[#d9dadb] rounded hover:bg-[#f4f4f5] transition-colors text-left">
                           <FileText className="w-5 h-5 text-zinc-500 mr-3" />
                           <span className="text-sm font-semibold text-slate-800">Modelo de Declaração do Simples Nacional (Anexo IV)</span>
                        </button>
                     </div>
                  </div>
               )}

               {activeTab === 'rpa' && (
                  <div className="bg-[#fafafa] rounded-2xl border border-[#e4e4e7] shadow-sm p-8 max-w-3xl relative overflow-hidden">
                     {/* Decorative background element */}
                     <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -mr-32 -mt-32"></div>

                     <div className="flex items-start justify-between mb-8 relative z-10">
                        <div className="flex items-center">
                           <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mr-4">
                              <FileSpreadsheet className="w-6 h-6 text-indigo-400" />
                           </div>
                           <div>
                              <h3 className="text-xl font-bold text-slate-800 flex items-center">
                                 RPA - Recibo de Pagamento Autônomo
                                 <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-700">
                                    <ShieldCheck className="w-3 h-3 mr-1" /> Consulta Segura
                                 </span>
                              </h3>
                              <p className="text-sm text-zinc-500 mt-1">Regras de emissão e cálculo para Pessoas Físicas</p>
                           </div>
                        </div>
                        <div className="flex flex-col items-end">
                           <span className="flex items-center text-[10px] uppercase tracking-wider font-bold text-zinc-500 mb-1">
                              Base Legal
                           </span>
                           <span className="flex items-center text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                              <RefreshCw className="w-3 h-3 mr-1" /> Sincronizado (Há 2h)
                           </span>
                        </div>
                     </div>

                     {/* Search bar inside module */}
                     <div className="mb-6 relative z-10">
                        <div className="relative">
                           <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                           <input 
                              type="text" 
                              placeholder="Pesquisar alíquotas INSS, IRRF, bases de cálculo..." 
                              className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#d9dadb] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 placeholder:text-zinc-400"
                           />
                        </div>
                     </div>

                     <div className="space-y-4 relative z-10">
                        {/* Dynamic Active Alert */}
                        <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 flex items-start">
                           <AlertTriangle className="w-5 h-5 text-amber-500 mr-3 shrink-0 mt-0.5" />
                           <div>
                              <h4 className="font-bold text-sm text-amber-900 mb-1 flex items-center">
                                 Atenção: Tabela INSS e IRRF 2024 (Atualizada)
                                 <span className="ml-2 bg-amber-200 text-amber-800 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">Vigente</span>
                              </h4>
                              <p className="text-xs text-amber-800/80 mb-2 leading-relaxed">
                                 A faixa de isenção do IRRF foi atualizada para R$ 2.824,00 a partir de Fev/2024. Sempre utilize a base governamental via simulador para emissões na data atual.
                              </p>
                              <button onClick={() => toast.success('Tabelas de Alíquotas acessadas')} className="text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center">
                                 Ver nova tabela e faixas <ChevronRight className="w-3 h-3 ml-0.5" />
                              </button>
                           </div>
                        </div>

                        {/* Expandable info cards */}
                        {[
                           { title: "Definição de Base de Cálculo Padrão", desc: "Regras sobre transporte, diárias e descontos." },
                           { title: "Limites de Isenção Mensal", desc: "Como tratar pagamentos fragmentados no mesmo mês." },
                        ].map((item, i) => (
                           <div key={i} className="flex justify-between items-center p-4 bg-white border border-[#e4e4e7] rounded-xl hover:border-slate-800 hover:shadow-sm transition-all cursor-pointer group" onClick={() => toast.success('Regra acessada')}>
                              <div className="flex items-center">
                                 <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center mr-3 group-hover:bg-slate-100 transition-colors">
                                    <FileText className="w-4 h-4 text-slate-600" />
                                 </div>
                                 <div className="text-left">
                                    <h5 className="font-semibold text-sm text-slate-800">{item.title}</h5>
                                    <p className="text-xs text-zinc-500">{item.desc}</p>
                                 </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-slate-800 transition-colors" />
                           </div>
                        ))}

                        <div className="mt-8 pt-4 border-t border-[#e4e4e7]">
                           <button onClick={() => toast.success('Pronto! Conectando ao Banco de Alíquotas...') } className="w-full bg-slate-800 hover:bg-slate-900 border border-slate-800 text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-md shadow-slate-900/10 flex justify-center items-center">
                              <CheckCircle className="w-4 h-4 mr-2 text-indigo-400" />
                              Acessar Simulador de Cálculos RPA (Conectado à Receita)
                           </button>
                        </div>
                     </div>
                  </div>
               )}

               {activeTab === 'isencoes' && (
                  <div className="bg-[#fafafa] rounded-2xl border border-[#e4e4e7] shadow-sm p-8 max-w-3xl relative overflow-hidden">
                     {/* Decorative element */}
                     <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16"></div>

                     <div className="flex items-start justify-between mb-8 relative z-10">
                        <div className="flex items-center">
                           <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mr-4">
                              <AlertTriangle className="w-6 h-6 text-blue-400" />
                           </div>
                           <div>
                              <h3 className="text-xl font-bold text-slate-800 flex items-center">
                                 Isenções Fiscais
                                 <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                                    <ShieldCheck className="w-3 h-3 mr-1" /> Base Ativa
                                 </span>
                              </h3>
                              <p className="text-sm text-zinc-500 mt-1">Regras e validação em tempo real das tributações e imunidades</p>
                           </div>
                        </div>
                        <div className="flex flex-col items-end">
                           <span className="flex items-center text-[10px] uppercase tracking-wider font-bold text-zinc-500 mb-1">
                              Atualização
                           </span>
                           <span className="flex items-center text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                              <RefreshCw className="w-3 h-3 mr-1" /> Diária (Sefaz/PE)
                           </span>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                        {[
                           { title: "Tabela Mestra de Imunes", desc: "Instituições filantrópicas e associações validadas.", icon: Book },
                           { title: "Verificação de ISS", desc: "Regras de local de prestação / Municípios.", icon: Building2 },
                           { title: "Anexos Probatórios", desc: "Requisitos para isenção (Certidões).", icon: FileText },
                           { title: "Trilha de Retenção IRRF", desc: "Fluxograma de retenção na fonte / exceções.", icon: ScrollText }
                        ].map((item, i) => (
                           <button key={i} onClick={() => toast.success(`Abrindo base conectada: ${item.title}`)} className="flex flex-col p-5 bg-white border border-[#e4e4e7] rounded-xl text-left hover:border-slate-800 hover:shadow-sm transition-all group">
                              <div className="flex items-center justify-between mb-3">
                                 <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-slate-800 transition-colors">
                                    <item.icon className="w-5 h-5 text-slate-500 group-hover:text-blue-400 transition-colors" />
                                 </div>
                                 <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-slate-800" />
                              </div>
                              <h4 className="font-bold text-sm text-slate-800 mb-1">{item.title}</h4>
                              <p className="text-xs text-zinc-500">{item.desc}</p>
                           </button>
                        ))}
                     </div>
                  </div>
               )}

               {activeTab === 'leis' && (
                  <div className="bg-[#fafafa] rounded-lg border border-[#e4e4e7] shadow-sm p-8 max-w-3xl">
                     <div className="flex items-center mb-6">
                        <Gavel className="w-8 h-8 text-[#1e293b] mr-4" />
                        <h3 className="text-xl font-bold text-slate-800">Leis e Decretos Estaduais</h3>
                     </div>
                     <ul className="space-y-3">
                        {[
                           "Lei nº 4.320/64 - Estatui Normas Gerais de Direito Financeiro",
                           "Lei de Responsabilidade Fiscal (LC 101/2000)",
                           "Decreto Estadual de Execução Orçamentária",
                           "Lei de Licitações (Lei nº 14.133/2021)"
                        ].map((lei, i) => (
                           <li key={i} className="flex justify-between items-center py-2 border-b border-[#f1f2f3] last:border-0">
                              <span className="text-sm text-zinc-600 font-medium">{lei}</span>
                              <button onClick={() => toast.success('Acessando legislação...')} className="text-xs font-bold text-[#1e293b] hover:underline">Ver Tópico</button>
                           </li>
                        ))}
                     </ul>
                  </div>
               )}

               {activeTab === 'contas' && (
                  <div className="bg-[#fafafa] rounded-lg border border-[#e4e4e7] shadow-sm p-8 max-w-3xl">
                     <div className="flex items-center mb-6">
                        <FolderOpen className="w-8 h-8 text-[#1e293b] mr-4" />
                        <div>
                           <h3 className="text-xl font-bold text-slate-800">Manuais de Prestações de Contas</h3>
                           <p className="text-sm text-zinc-500">Normas e procedimentos atualizados</p>
                        </div>
                     </div>
                     <div className="p-6 bg-[#f4f4f5] border border-[#e4e4e7] rounded-lg mb-4 text-center">
                        <Book className="w-12 h-12 text-zinc-500 mx-auto mb-3" />
                        <h4 className="font-bold text-slate-800 mb-2">Manual Completo de Prestação de Contas 2024</h4>
                        <p className="text-sm text-zinc-600 mb-4">Versão Atualizada: 2.1 (Março/2024)</p>
                        <button onClick={() => toast.success('Baixando PDF...')} className="bg-[#1e293b] text-white text-sm font-bold py-2 px-6 rounded hover:bg-[#003366]">Baixar PDF</button>
                     </div>
                     <button onClick={() => toast.success('Abrindo Anexos...')} className="w-full p-3 border border-[#d9dadb] text-center rounded text-sm font-bold text-[#1e293b] hover:bg-[#f4f4f5]">
                        Ver Anexos e Modelos de Formulários
                     </button>
                  </div>
               )}

               {activeTab === 'portarias' && (
                  <div className="bg-[#fafafa] rounded-lg border border-[#e4e4e7] shadow-sm p-8 max-w-3xl">
                     <div className="flex items-center mb-6">
                        <ScrollText className="w-8 h-8 text-[#1e293b] mr-4" />
                        <div>
                           <h3 className="text-xl font-bold text-slate-800">Portarias CGE de PE</h3>
                           <p className="text-sm text-zinc-500">Controladoria Geral do Estado de Pernambuco</p>
                        </div>
                     </div>
                     <div className="space-y-4">
                        {[
                           { title: "Portaria SCGE nº 045/2023", desc: "Define procedimentos sobre suprimentos de fundos." },
                           { title: "Portaria SCGE nº 012/2024", desc: "Atualiza limites de dispensa de licitação e adiantamentos." },
                           { title: "Orientação Normativa CGE/PE", desc: "Regras sobre conformidade contábil e liquidação." }
                        ].map((portaria, i) => (
                           <div key={i} className="flex flex-col bg-[#f4f4f5] border border-[#e4e4e7] p-4 rounded hover:border-[#1e293b] transition-colors cursor-pointer" onClick={() => toast.success('Carregando Portaria...')}>
                              <h4 className="font-bold text-[#1e293b] text-sm">{portaria.title}</h4>
                              <p className="text-xs text-zinc-600 mt-1">{portaria.desc}</p>
                           </div>
                        ))}
                     </div>
                  </div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
}

