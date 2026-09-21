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
  data_expedicao: Date | string | null;
  cidade: string | null;
  uf: string | null;
  telefone: string | null;
  banco: string | null;
  agencia: string | null;
  conta_corrente: string | null;
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
  elemento_subelemento: string | null;
  gestao: string | null;
  status: string | null;
  historico: string | null;
  usuario_id: string | null;
  created_at: Date;
  updated_at: Date;
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
  elemento_subelemento: string | null;
  gestao: string | null;
  historico: string | null;
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
  total_descontos: number | string | null;
  valor_liquido: number | string | null;
  numero_cheque: string | null;
  data_emissao: Date | string | null;
  data_pagamento: Date | string | null;
  usuario_id: string | null;
  created_at: Date;
}
