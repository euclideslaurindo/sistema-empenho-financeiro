-- ============================================================
-- Sistema de Empenho - Gestão Financeira
-- Script de criação do banco de dados
-- Execute este script no MySQL antes de iniciar o sistema
-- ============================================================

CREATE DATABASE IF NOT EXISTS empenho CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE empenho;

-- ============================================================
-- TABELA: usuarios
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  matricula VARCHAR(30) UNIQUE NOT NULL,
  email VARCHAR(100),
  senha VARCHAR(255) NOT NULL,
  nivel_acesso INT DEFAULT 1 COMMENT '1=Admin, 2=Gestor, 3=Consulta',
  ativo TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- TABELA: credores
-- ============================================================
CREATE TABLE IF NOT EXISTS credores (
  id VARCHAR(36) PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  endereco VARCHAR(300),
  cpf_cnpj VARCHAR(20) NOT NULL,
  pis VARCHAR(20),
  rg VARCHAR(80),
  data_expedicao DATE,
  usuario_id INT,
  ativo TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cpf_cnpj (cpf_cnpj),
  CONSTRAINT fk_credor_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- ============================================================
-- TABELA: notas_empenho
-- ============================================================
CREATE TABLE IF NOT EXISTS notas_empenho (
  id VARCHAR(36) PRIMARY KEY,
  exercicio VARCHAR(4),
  codigo VARCHAR(50),
  numero VARCHAR(60) NOT NULL,
  valor DECIMAL(15,2) DEFAULT 0,
  data_pagamento DATE,
  unidade_orcamentaria VARCHAR(200),
  elemento_subelemento VARCHAR(50),
  gestao VARCHAR(20),
  status VARCHAR(30) DEFAULT 'EMITIDO' COMMENT 'EMITIDO, LIQUIDADO, CANCELADO',
  historico TEXT,
  usuario_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_numero (numero),
  CONSTRAINT fk_ne_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- ============================================================
-- TABELA: ordens_pagamento
-- ============================================================
CREATE TABLE IF NOT EXISTS ordens_pagamento (
  id VARCHAR(36) PRIMARY KEY,
  liquidacao_id VARCHAR(36),
  numero_ne VARCHAR(60) NOT NULL,
  numero_empenho VARCHAR(60),
  sub VARCHAR(5) DEFAULT '01',
  credor_nome VARCHAR(200),
  credor_cpf_cnpj VARCHAR(20),
  credor_rg VARCHAR(80),
  credor_endereco VARCHAR(300),
  unidade_orcamentaria VARCHAR(200),
  elemento_subelemento VARCHAR(50),
  gestao VARCHAR(20),
  historico TEXT,
  item_unidade VARCHAR(20) DEFAULT 'UN',
  item_quantidade DECIMAL(10,3) DEFAULT 1,
  item_valor_unitario DECIMAL(15,2) DEFAULT 0,
  item_unidade2 VARCHAR(20),
  item_quantidade2 DECIMAL(10,3),
  item_valor_unitario2 DECIMAL(15,2),
  saldo_anterior DECIMAL(15,2) DEFAULT 0,
  valor_empenho DECIMAL(15,2) DEFAULT 0,
  valor_pagamento DECIMAL(15,2) DEFAULT 0,
  irrf DECIMAL(10,2) DEFAULT 0,
  iss DECIMAL(10,2) DEFAULT 0,
  inss DECIMAL(10,2) DEFAULT 0,
  sest_senat DECIMAL(10,2) DEFAULT 0,
  patronal DECIMAL(10,2) DEFAULT 0,
  outros_descontos DECIMAL(10,2) DEFAULT 0,
  total_descontos DECIMAL(10,2) DEFAULT 0,
  valor_liquido DECIMAL(15,2) DEFAULT 0,
  numero_cheque VARCHAR(30),
  data_emissao DATE,
  data_pagamento DATE,
  usuario_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cheque (numero_cheque),
  CONSTRAINT fk_op_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

-- ============================================================
-- DADOS INICIAIS
-- ============================================================

-- Usuário administrador padrão (senha: admin123)
INSERT IGNORE INTO usuarios (nome, matricula, email, senha, nivel_acesso) VALUES
('Gestor Financeiro', 'admin', 'admin@sistema.gov.br', 'admin123', 1),
('Maria Silva', '102938-4', 'maria.silva@sistema.gov.br', 'senha123', 2);

-- Credores de exemplo
INSERT IGNORE INTO credores (id, nome, endereco, cpf_cnpj, pis, rg, data_expedicao) VALUES
('1', 'Jose Silva Oliveira', 'Rua A, 123, Recife - PE', '111.111.111-11', '', '123456 SDS-PE', '2020-01-01'),
('2', 'Maria Cavalcanti S/A', 'Av B, 456, Recife - PE', '22.222.222/0001-22', '', '654321 SDS-PE', '2019-05-10'),
('3', 'Tech Solution LTDA', 'Praça C, 789, Recife - PE', '33.333.333/0001-33', '', '987654 SDS-PE', '2021-10-20'),
('4', 'Papelaria e Distribuidora Nordeste LTDA', 'Av. Agamenon Magalhães, 1200 - Santo Amaro, Recife - PE', '12.345.678/0001-90', '', '987.654.321', '2018-03-15'),
('5', 'Farma Vida Distribuidora S/A', 'Rua do Sol, 500 - Centro, Recife - PE', '99.888.777/0002-11', '', '123.456.789', '2017-07-20');

-- Notas de empenho de exemplo
INSERT IGNORE INTO notas_empenho (id, codigo, numero, valor, data_pagamento, unidade_orcamentaria, elemento_subelemento, gestao, status, historico) VALUES
(UUID(), 'NE-2024-045', '2024NE000982', 15420.00, '2024-05-22', 'Secretaria de Educação', '3.3.90.36', '140101', 'EMITIDO', 'Pagamento de RPA'),
(UUID(), 'NE-2024-044', '2024NE000981', 2850.50, '2024-05-21', 'Secretaria de Saúde', '3.3.90.30', '140102', 'LIQUIDADO', 'Pagamento ref aquisição de insumos'),
(UUID(), 'NE-2024-043', '2024NE000979', 48000.00, '2024-05-21', 'Secretaria de Educação', '4.4.90.52', '140101', 'LIQUIDADO', 'Aquisição de computadores'),
(UUID(), 'NE-2024-042', '2024NE00142', 12450.00, '2024-03-10', 'Secretaria de Educação', '3.3.90.30', '140101', 'EMITIDO', 'Referente à aquisição de materiais de escritório para suprimento das Unidades Escolares da Rede Estadual, conforme Processo Licitatório nº 042/2024 e Ata de Registro de Preços vigente.'),
(UUID(), 'NE-2024-041', '2024NE00143', 25000.00, '2024-05-20', 'Secretaria de Saúde', '3.3.90.32', '140102', 'LIQUIDADO', 'Aquisição de medicamentos para a rede hospitalar estadual.');

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================
SELECT 'Banco criado com sucesso!' AS status;
SELECT 'usuarios' AS tabela, COUNT(*) AS registros FROM usuarios
UNION SELECT 'credores', COUNT(*) FROM credores
UNION SELECT 'notas_empenho', COUNT(*) FROM notas_empenho
UNION SELECT 'ordens_pagamento', COUNT(*) FROM ordens_pagamento;

-- ============================================================
-- ÍNDICES E CHAVES ESTRANGEIRAS
-- ============================================================

-- Índices adicionais para otimização de busca
ALTER TABLE notas_empenho ADD INDEX idx_ne_data (data_pagamento);
ALTER TABLE notas_empenho ADD INDEX idx_ne_status (status);

ALTER TABLE ordens_pagamento ADD INDEX idx_op_data (data_pagamento);
ALTER TABLE ordens_pagamento ADD INDEX idx_op_emissao (data_emissao);
ALTER TABLE ordens_pagamento ADD INDEX idx_op_credor_cpf_cnpj (credor_cpf_cnpj);

ALTER TABLE credores ADD INDEX idx_credor_nome (nome);

-- Chaves Estrangeiras (Foreign Keys)
-- Nota: Como o sistema foi criado sem FKs estritas inicialmente, adicionamos com ON DELETE RESTRICT
-- para evitar deleção de dados relacionados (proteção de integridade referencial)

-- 1. Ordens de Pagamento -> Notas de Empenho
-- A OP é referenciada à NE através do numero_ne e numero
ALTER TABLE ordens_pagamento 
  ADD CONSTRAINT fk_op_ne 
  FOREIGN KEY (numero_ne) 
  REFERENCES notas_empenho(numero) 
  ON DELETE RESTRICT 
  ON UPDATE CASCADE;

-- 2. Ordens de Pagamento -> Credores
-- A OP tem um credor referenciado pelo CPF/CNPJ
ALTER TABLE ordens_pagamento 
  ADD CONSTRAINT fk_op_credor 
  FOREIGN KEY (credor_cpf_cnpj) 
  REFERENCES credores(cpf_cnpj) 
  ON DELETE RESTRICT 
  ON UPDATE CASCADE;
