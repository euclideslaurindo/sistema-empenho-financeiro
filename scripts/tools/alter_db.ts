import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import mysql from 'mysql2/promise';

async function main() {
  console.log("Variáveis de ambiente:");
  console.log("MYSQL_HOST:", process.env.MYSQL_HOST);
  console.log("MYSQL_USER:", process.env.MYSQL_USER);
  console.log("MYSQL_DATABASE:", process.env.MYSQL_DATABASE);

  try {
    const connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      port: Number(process.env.MYSQL_PORT) || 3306,
    });

    console.log("Conectado! Selecionando banco empenho...");
    
    // REGRA DO BANCO DE DADOS: Sempre USE empenho
    await connection.query("USE empenho;");
    
    // Tabela credores
    try {
      await connection.query("ALTER TABLE credores ADD COLUMN pix VARCHAR(100);");
      console.log("Coluna pix adicionada em credores.");
    } catch (e: any) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log("Coluna pix já existe em credores.");
      } else {
        console.error("Erro ao adicionar pix:", e.message);
      }
    }

    // Tabela notas_empenho
    try {
      await connection.query("ALTER TABLE notas_empenho ADD COLUMN elemento VARCHAR(50);");
      console.log("Coluna elemento adicionada em notas_empenho.");
    } catch (e: any) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log("Coluna elemento já existe.");
      } else {
        console.error("Erro ao adicionar elemento:", e.message);
      }
    }
    
    try {
      await connection.query("ALTER TABLE notas_empenho ADD COLUMN subelemento VARCHAR(200);");
      console.log("Coluna subelemento adicionada em notas_empenho.");
    } catch (e: any) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log("Coluna subelemento já existe.");
      } else {
        console.error("Erro ao adicionar subelemento:", e.message);
      }
    }

    try {
      // Migrar dados existentes, se houver
      await connection.query(`
        UPDATE notas_empenho 
        SET 
          elemento = SUBSTRING_INDEX(elemento_subelemento, '/', 1),
          subelemento = IF(LOCATE('/', elemento_subelemento) > 0, SUBSTRING(elemento_subelemento, LOCATE('/', elemento_subelemento) + 1), '')
        WHERE elemento_subelemento IS NOT NULL;
      `);
      console.log("Dados migrados para as novas colunas elemento/subelemento.");
      
      await connection.query("ALTER TABLE notas_empenho DROP COLUMN elemento_subelemento;");
      console.log("Coluna elemento_subelemento removida.");
    } catch (e: any) {
      if (e.code === 'ER_CANT_DROP_FIELD_OR_KEY' || e.code === 'ER_BAD_FIELD_ERROR') {
        console.log("Coluna elemento_subelemento já foi removida ou não existe.");
      } else {
        console.log("Aviso: erro ao migrar/dropar elemento_subelemento:", e.message);
      }
    }

    console.log("Concluído.");
    await connection.end();
  } catch (error) {
    console.error("Erro geral:", error);
  }
}

main();
