-- ============================================================
-- migration_06.sql
-- Cria as tabelas `auditoria_financeira` e `liquidacoes`, que o
-- código já usa (lib/services/ordem-pagamento.service.ts e
-- app/api/liquidacoes/route.ts) mas nunca existiram no banco —
-- causava ER_NO_SUCH_TABLE ao editar/excluir Ordem de Pagamento
-- e ao criar Liquidação.
--
-- Também cria `schema_migrations` para passar a rastrear, a
-- partir de agora, quais migrations já rodaram neste banco.
-- Migrations anteriores (01-05) NÃO são registradas aqui porque
-- o schema real já diverge dos arquivos originais (colunas e
-- índices foram criados manualmente fora desses scripts em algum
-- momento) — não há como reconstruir esse histórico com segurança.
--
-- SEM FOREIGN KEY: o usuário de app (`admin`) não tem privilégio
-- REFERENCES neste banco (erro "REFERENCES command denied to user
-- 'admin'@'...' for table 'empenho.usuarios'" ao tentar). Por isso
-- as colunas de referência (usuario_id, notas_empenho_id, created_by)
-- ficam sem constraint de FK, só com índice — igual ao que o resto
-- do schema já faz na prática (ex.: ordens_pagamento.liquidacao_id
-- nunca teve FK). Integridade referencial fica por conta da aplicação.
--
-- Execução Não Destrutiva (segura para re-executar)
-- ============================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(20) PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auditoria_financeira (
  id CHAR(36) PRIMARY KEY,
  entidade VARCHAR(60) NOT NULL,
  entidade_id CHAR(36) NOT NULL,
  acao VARCHAR(20) NOT NULL COMMENT 'CREATE, UPDATE, DELETE',
  dados_anteriores JSON NULL,
  dados_novos JSON NULL,
  usuario_id CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_auditoria_entidade (entidade, entidade_id),
  INDEX idx_auditoria_usuario (usuario_id)
);

CREATE TABLE IF NOT EXISTS liquidacoes (
  id VARCHAR(36) PRIMARY KEY,
  numero_liquidacao VARCHAR(60) NOT NULL UNIQUE,
  notas_empenho_id VARCHAR(36) NOT NULL,
  valor_liquidado DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  data_liquidacao DATE NOT NULL,
  responsavel_atesto VARCHAR(200),
  documento_fiscal VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_liq_notas_empenho (notas_empenho_id),
  INDEX idx_liq_created_by (created_by)
);

INSERT IGNORE INTO schema_migrations (version) VALUES ('06');

-- ============================================================
-- ROLLBACK (se necessário reverter esta migration):
--
--   DROP TABLE IF EXISTS liquidacoes;
--   DROP TABLE IF EXISTS auditoria_financeira;
--   DELETE FROM schema_migrations WHERE version = '06';
--   -- (schema_migrations em si pode ficar, é inofensiva)
-- ============================================================
