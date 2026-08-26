-- ============================================================
-- migration_01.sql
-- Adição de Tabelas Core (Dotação e Liquidação) e colunas de Auditoria
-- Execução Não Destrutiva (In-Place)
-- ============================================================

-- 1. Criação da Tabela Raiz: dotacao_orcamentaria
CREATE TABLE IF NOT EXISTS dotacao_orcamentaria (
    id VARCHAR(36) PRIMARY KEY,
    unidade_orcamentaria VARCHAR(200) NOT NULL,
    natureza_despesa VARCHAR(50) NOT NULL COMMENT 'Elemento/Subelemento',
    saldo_inicial DECIMAL(15,2) DEFAULT 0.00,
    saldo_disponivel DECIMAL(15,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT fk_dotacao_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 2. Criação da Tabela de Transição: liquidacoes
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
    created_by INT,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT fk_liq_notas_empenho FOREIGN KEY (notas_empenho_id) REFERENCES notas_empenho(id) ON DELETE RESTRICT,
    CONSTRAINT fk_liq_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- 3. Alteração In-Place: Adição da Modalidade na tabela notas_empenho
ALTER TABLE notas_empenho
    ADD COLUMN modalidade VARCHAR(30) DEFAULT 'Ordinário' COMMENT 'Ordinário, Global, Estimativa' AFTER data_pagamento;

-- 4. Alteração In-Place: Adição de Auditoria e Soft Delete nas notas_empenho
ALTER TABLE notas_empenho
    ADD COLUMN created_by INT AFTER historico,
    ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER created_at,
    ADD CONSTRAINT fk_ne_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL;

-- 5. Alteração In-Place: Adição de Auditoria e Soft Delete nas ordens_pagamento
ALTER TABLE ordens_pagamento
    ADD COLUMN created_by INT AFTER data_pagamento,
    ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER created_at,
    ADD CONSTRAINT fk_op_created_by FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL;
