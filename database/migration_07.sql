-- ============================================================
-- migration_07.sql
-- Adiciona FOREIGN KEY nas tabelas criadas pela migration_06.sql
-- (auditoria_financeira, liquidacoes).
--
-- IMPORTANTE: o usuário de app (`admin`, usado em MYSQL_USER no
-- .env.local e pelo endpoint /api/setup/migrate) NÃO tem privilégio
-- REFERENCES neste banco — rodar isto com ele falha com:
--   "REFERENCES command denied to user 'admin'@'...' for table 'empenho.usuarios'"
-- Este script precisa ser executado por um usuário com privilégio
-- REFERENCES (ex.: a conta pessoal usada no MySQL Workbench).
--
-- Execução Não Destrutiva (as tabelas já existem vazias/quase vazias,
-- sem risco de dado órfão bloquear a criação da constraint).
-- ============================================================

USE empenho;

ALTER TABLE auditoria_financeira
  ADD CONSTRAINT fk_auditoria_usuario
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE liquidacoes
  ADD CONSTRAINT fk_liq_notas_empenho
  FOREIGN KEY (notas_empenho_id) REFERENCES notas_empenho(id) ON DELETE RESTRICT;

ALTER TABLE liquidacoes
  ADD CONSTRAINT fk_liq_created_by
  FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL;

INSERT IGNORE INTO schema_migrations (version) VALUES ('07');

-- ============================================================
-- ROLLBACK (se necessário reverter esta migration):
--
--   ALTER TABLE auditoria_financeira DROP FOREIGN KEY fk_auditoria_usuario;
--   ALTER TABLE liquidacoes DROP FOREIGN KEY fk_liq_notas_empenho;
--   ALTER TABLE liquidacoes DROP FOREIGN KEY fk_liq_created_by;
--   DELETE FROM schema_migrations WHERE version = '07';
-- ============================================================
