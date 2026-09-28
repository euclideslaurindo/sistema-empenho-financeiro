-- ============================================================
-- migration_09.sql
-- Corrige "Data too long for column 'elemento'" ao criar/editar
-- Nota de Empenho E Ordem de Pagamento (mesmo bug, duas tabelas).
--
-- CAUSA: as colunas notas_empenho.elemento E ordens_pagamento.elemento
-- são VARCHAR(50), mas a lista de opções do dropdown (lib/constants.ts
-- ::ELEMENTOS, compartilhada pelas duas telas) tem valores de até 58
-- caracteres (ex: "3.3.90.39 - Outros Serviços de Terceiros - Pessoa
-- Jurídica"). 3 das 10 opções excedem o limite — é um descompasso
-- pré-existente entre schema e dado, não algo introduzido nesta sessão.
--
-- Se você já rodou uma versão anterior desta migration que só alterava
-- notas_empenho, pode rodar este arquivo inteiro de novo sem problema
-- — MODIFY COLUMN para o mesmo tipo/tamanho não tem efeito destrutivo.
--
-- IMPORTANTE: o usuário de app (`admin`) não tem privilégio ALTER em
-- nenhuma das duas tabelas (erro "ALTER command denied to user
-- 'admin'@'...' for table '...'" ao tentar). Rodar via conta
-- privilegiada (Workbench).
--
-- Execução Não Destrutiva (aumentar tamanho de VARCHAR é seguro —
-- não trunca nem altera dado existente).
-- ============================================================

USE empenho;

ALTER TABLE notas_empenho
  MODIFY COLUMN elemento VARCHAR(100);

ALTER TABLE ordens_pagamento
  MODIFY COLUMN elemento VARCHAR(100);

INSERT IGNORE INTO schema_migrations (version) VALUES ('09');

-- ============================================================
-- ROLLBACK (se necessário reverter esta migration):
--
--   ALTER TABLE notas_empenho MODIFY COLUMN elemento VARCHAR(50);
--   ALTER TABLE ordens_pagamento MODIFY COLUMN elemento VARCHAR(50);
--   -- ATENÇÃO: só reverta isso se tiver certeza de que nenhuma NE/OP
--   -- foi salva com elemento > 50 caracteres depois desta migration,
--   -- senão o ALTER de volta vai falhar com o mesmo erro ER_DATA_TOO_LONG.
--   DELETE FROM schema_migrations WHERE version = '09';
-- ============================================================
