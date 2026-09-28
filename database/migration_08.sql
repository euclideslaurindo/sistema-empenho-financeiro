-- ============================================================
-- migration_08.sql
-- Três correções de integridade em ordens_pagamento, todas
-- confirmadas seguras via checagem de dados reais em 2026-09-28
-- (0 duplicatas de numero_empenho, 0 credor_cpf_cnpj vazio/órfão,
-- 0 numero_ne órfão — banco tinha só 5 OPs no momento da checagem).
--
-- IMPORTANTE: o usuário de app (`admin`) NÃO tem privilégio ALTER
-- na tabela ordens_pagamento (erro "ALTER command denied to user
-- 'admin'@'...' for table 'ordens_pagamento'" ao tentar até a
-- UNIQUE KEY, que nem precisa de REFERENCES). Rodar este script
-- inteiro por uma conta com privilégio ALTER + REFERENCES nessa
-- tabela (ex.: a conta pessoal usada no MySQL Workbench).
--
-- Execução Não Destrutiva (nenhuma coluna ou dado é alterado,
-- só constraints novas em cima de dados já validados).
-- ============================================================

USE empenho;

-- 1. UNIQUE KEY em numero_empenho (plano de implementação, item 2.1).
--    A geração do número (SELECT MAX() FOR UPDATE) não trava nada quando
--    é a primeira OP do ano — essa constraint é a rede de segurança real
--    contra duas requisições concorrentes gerando o mesmo número. O código
--    em lib/services/ordem-pagamento.service.ts já tem retry automático
--    em cima de ER_DUP_ENTRY dessa chave.
ALTER TABLE ordens_pagamento
  ADD UNIQUE KEY uq_numero_empenho (numero_empenho);

-- 2. FK ordens_pagamento -> notas_empenho (restaura a suposição que já
--    existia em comentário no código: notas-empenho.service.ts assumia
--    que essa FK com ON UPDATE CASCADE já existia e por isso não fazia
--    o UPDATE manual de ordens_pagamento.numero_ne ao renomear uma NE.
--    Essa suposição estava ERRADA até agora — a FK nunca tinha sido
--    aplicada de fato. Isso era o bug crítico #5 da varredura original,
--    "mitigado" apenas no papel. Depois desta migration, o comentário
--    passa a ser verdade.)
ALTER TABLE ordens_pagamento
  ADD CONSTRAINT fk_op_ne
  FOREIGN KEY (numero_ne)
  REFERENCES notas_empenho(numero)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- 3. FK ordens_pagamento -> credores (plano de implementação, item 2.5).
--    credorCpfCnpj já é obrigatório no schema Zod de ordemPagamentoSchema
--    (lib/services/ordem-pagamento.service.ts) desde 2026-09-28, então
--    todo INSERT/UPDATE novo já garante um valor não-vazio antes de
--    chegar ao banco.
ALTER TABLE ordens_pagamento
  ADD CONSTRAINT fk_op_credor
  FOREIGN KEY (credor_cpf_cnpj)
  REFERENCES credores(cpf_cnpj)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

INSERT IGNORE INTO schema_migrations (version) VALUES ('08');

-- ============================================================
-- ROLLBACK (se necessário reverter esta migration):
--
--   ALTER TABLE ordens_pagamento DROP FOREIGN KEY fk_op_credor;
--   ALTER TABLE ordens_pagamento DROP FOREIGN KEY fk_op_ne;
--   ALTER TABLE ordens_pagamento DROP INDEX uq_numero_empenho;
--   DELETE FROM schema_migrations WHERE version = '08';
-- ============================================================
