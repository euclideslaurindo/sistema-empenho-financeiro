import mysql from 'mysql2/promise';

// Quando quiser usar o banco real, mude para false.
const USE_MOCK_DB = false;

// Configuração do banco real (fica guardada para quando você quiser usar)
export const realPool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'empenho',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '-03:00',
});

// Banco de dados em memória para os testes locais
let mockOrdens: any[] = [];
let mockEmpenhos = [
  { id: 'ne-1', codigo: 'NE-2026-001', numero: '2026NE00001', valor: '5000.00', status: 'EMITIDO', unidade_orcamentaria: 'Sec Fazenda', gestao: '140101', historico: 'Servicos graficos' }
];

export async function query<T = any>(sql: string, values?: any[]): Promise<T> {
  if (!USE_MOCK_DB) {
    const [results] = await realPool.execute(sql, values);
    return results as T;
  }

  // INTERCEPTADOR DE MOCKS (Teste sem MySQL)
  const queryStr = sql.toLowerCase();

  // Mock Login
  if (queryStr.includes('from usuarios where email = ?')) {
    if (values?.[0] === 'admin@admin.com') {
      return [{ id: 1, nome: 'Administrador', email: 'admin@admin.com', senha_hash: 'admin123', nivel_acesso: 1, ativo: 1 }] as T;
    }
    return [] as T;
  }

  // Mock Credores
  if (queryStr.includes('from credores')) {
    if (queryStr.includes('cpf_cnpj = ?') || queryStr.includes('nome = ?')) {
      return [] as T;
    }
    return [{ id: 'cred-1', nome: 'MOCK EMPRESA FAKE LTDA', endereco: 'Rua Mock, 123', cpf_cnpj: '12.345.678/0001-99', cpfCnpj: '12.345.678/0001-99', rg: 'ISENTO', ativo: 1, dataExpedicao: '2024-01-01' }] as T;
  }

  // Mock Notas de Empenho
  if (queryStr.includes('from notas_empenho')) {
    return mockEmpenhos as T;
  }

  // Mock Inserção de OPs
  if (queryStr.includes('insert into ordens_pagamento')) {
    mockOrdens.push(values);
    return [{ insertId: mockOrdens.length, affectedRows: 1 }] as T;
  }

  // UPDATE Notas de empenho
  if (queryStr.includes('update notas_empenho')) {
    return [{ affectedRows: 1 }] as T;
  }

  // Configurações
  if (queryStr.includes('from configuracoes_sistema')) {
    return [{ id: 1, nome_completo: 'Prefeitura Teste', auto_preencher_credor: 1, exigir_2fa_op: 0 }] as T;
  }

  return [] as T;
}

// Mock do Pool para transações
export const pool = USE_MOCK_DB ? {
  getConnection: async () => ({
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    execute: async (sql: string, values?: any[]) => {
      const res = await query(sql, values);
      return [res];
    }
  }),
  execute: async (sql: string, values?: any[]) => {
    const res = await query(sql, values);
    return [res];
  }
} as any : realPool;

export async function withTransaction<T>(
  fn: (conn: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const conn = await pool.getConnection();
  if (conn.beginTransaction) await conn.beginTransaction();
  try {
    const result = await fn(conn as mysql.PoolConnection);
    if (conn.commit) await conn.commit();
    return result;
  } catch (err) {
    if (conn.rollback) await conn.rollback();
    throw err;
  } finally {
    if (conn.release) conn.release();
  }
}
