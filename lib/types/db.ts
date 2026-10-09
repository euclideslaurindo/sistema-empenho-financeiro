export interface UsuarioDB {
  id: string;
  nome: string;
  email: string;
  senha_hash: string;
  perfil: 'ADMIN' | 'USER' | string;
  ativo: number;
  created_at: Date;
  ultimo_acesso: Date | string | null;
}

export interface CredorDB {
  id: string;
  nome: string;
  endereco: string | null;
  cpf_cnpj: string;
  pis: string | null;
  rg: string | null;
  orgao_emissor: string | null;
  data_expedicao: Date | string | null;
  cidade: string | null;
  uf: string | null;
  telefone: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  banco: string | null;
  agencia: string | null;
  conta_corrente: string | null;
  pix: string | null;
  is_mei: number;
  usuario_id: string | null;
  ativo: number;
  created_at: Date;
  updated_at: Date;
}

export interface NotaEmpenhoDB {
  id: string;
  exercicio: string | null;
  codigo: string | null;
  numero: string;
  valor: number | string;
  data_pagamento: Date | string | null;
  data_provisao_concedida: Date | string | null;
  data_emissao: Date | string | null;
  unidade_orcamentaria: string | null;
  elemento: string | null;
  subelemento: string | null;
  gestao: string | null;
  status: string | null;
  historico: string | null;
  credor_nome: string | null;
  cpf_cnpj: string | null;
  usuario_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface OrdemPagamentoItemDB {
  especificacao: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
}

export interface OrdemPagamentoDB {
  id: string;
  liquidacao_id: string | null;
  numero_ne: string;
  numero_empenho: string | null;
  sub: string | null;
  credor_nome: string | null;
  credor_cpf_cnpj: string | null;
  credor_rg: string | null;
  credor_endereco: string | null;
  unidade_orcamentaria: string | null;
  elemento: string | null;
  subelemento: string | null;
  gestao: string | null;
  historico: string | null;
  // Coluna JSON nativa do MySQL — o driver (mysql2) já entrega um array
  // JS pronto na leitura, nunca uma string (diferente de outros bancos
  // onde JSON é armazenado como TEXT/VARCHAR e precisa de JSON.parse()).
  itens_json: OrdemPagamentoItemDB[] | null;
  item_unidade: string | null;
  item_quantidade: number | string | null;
  item_valor_unitario: number | string | null;
  item_unidade2: string | null;
  item_quantidade2: number | string | null;
  item_valor_unitario2: number | string | null;
  saldo_anterior: number | string | null;
  valor_empenho: number | string | null;
  valor_pagamento: number | string | null;
  irrf: number | string | null;
  iss: number | string | null;
  inss: number | string | null;
  sest_senat: number | string | null;
  patronal: number | string | null;
  outros_descontos: number | string | null;
  taxa_bancaria: number | string;
  taxa_pix: number | string;
  total_descontos: number | string | null;
  valor_liquido: number | string | null;
  // JSON nativo do MySQL: mysql2 já entrega objeto, nunca string (mesma
  // observação já registrada para itens_json).
  retencoes_snapshot: Record<string, any> | null;
  numero_cheque: string | null;
  data_emissao: Date | string | null;
  data_pagamento: Date | string | null;
  usuario_id: string | null;
  created_at: Date;
}

export interface LiquidacaoDB {
  id: string;
  numero_liquidacao: string;
  notas_empenho_id: string;
  valor_liquidado: number | string;
  data_liquidacao: Date | string;
  responsavel_atesto: string | null;
  documento_fiscal: string | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  deleted_at: Date | null;
}

export interface ElementoDespesaDB {
  codigo: string;
  descricao: string;
  legado: number;
  ativo: number;
  ordem: number;
  created_at: Date;
  updated_at: Date;
}

export interface SubelementoDespesaDB {
  codigo: string;
  elemento_codigo: string;
  descricao: string;
  ativo: number;
  ordem: number;
  created_at: Date;
  updated_at: Date;
}

export interface NeCredorDB {
  id: string;
  numero_ne: string;
  credor_cpf_cnpj: string;
  credor_nome: string;
  valor_bruto: number | string;
  ordem: number;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

/** Credor de uma NE como devolvido pela API (valores em reais). */
export interface NeCredorResposta {
  cpfCnpj: string;
  nome: string;
  valorBruto: number;
  valorPago: number;
  saldo: number;
  legado?: true; // sintetizado das colunas legadas (NE sem linhas em ne_credores)
}

export interface DarfAcompanhamentoDB {
  id: string;
  ordem_pagamento_id: string;
  numero_ne: string;
  numero_op: string | null; // = ordens_pagamento.numero_empenho
  sub: string | null;
  credor_cpf_cnpj: string;
  credor_nome: string | null;
  competencia: string; // 'YYYY-MM'
  valor_darf: number | string;
  detalhe_json: Record<string, number> | null;
  status: 'PENDENTE' | 'PAGA' | string;
  data_pagamento: Date | string | null;
  observacao: string | null;
  atualizado_por: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ElementoRetencaoDB {
  elemento_codigo: string;
  campo: string;
}

export interface ConfigRetencaoDB {
  campo: string;
  rotulo: string;
  tipo: string;
  aliquota: number | string | null;
  calculo_automatico: number;
  editavel_operador: number;
  entra_darf: number;
  ativo: number;
  ordem: number;
  updated_by: string | null;
  updated_at: Date;
}

export interface AuditoriaFinanceiraDB {
  id: string;
  entidade: string;
  entidade_id: string;
  acao: 'CREATE' | 'UPDATE' | 'DELETE' | string;
  dados_anteriores: string | null;
  dados_novos: string | null;
  usuario_id: string | null;
  created_at: Date;
}
