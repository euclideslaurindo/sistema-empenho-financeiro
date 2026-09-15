const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());
const mysql = require('mysql2/promise');

async function main() {
  console.log("Conectando ao banco...");
  try {
    const connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      port: Number(process.env.MYSQL_PORT) || 3306,
      database: process.env.MYSQL_DATABASE || 'empenho'
    });

    console.log("Conectado! Aplicando alterações...");
    await connection.query("USE empenho;");
    
    // Tabela credores
    try {
      await connection.query("ALTER TABLE credores ADD COLUMN pix VARCHAR(100);");
      console.log("Coluna pix adicionada em credores.");
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log("Coluna pix já existe.");
      else console.error("Erro pix:", e.message);
    }

    // Tabela notas_empenho
    try {
      await connection.query("ALTER TABLE notas_empenho ADD COLUMN elemento VARCHAR(50);");
      console.log("Coluna elemento adicionada em notas_empenho.");
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log("Coluna elemento já existe.");
      else console.error("Erro elemento:", e.message);
    }
    
    try {
      await connection.query("ALTER TABLE notas_empenho ADD COLUMN subelemento VARCHAR(200);");
      console.log("Coluna subelemento adicionada.");
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log("Coluna subelemento já existe.");
      else console.error("Erro subelemento:", e.message);
    }

    try {
      await connection.query(`
        UPDATE notas_empenho 
        SET 
          elemento = SUBSTRING_INDEX(elemento_subelemento, '/', 1),
          subelemento = IF(LOCATE('/', elemento_subelemento) > 0, SUBSTRING(elemento_subelemento, LOCATE('/', elemento_subelemento) + 1), '')
        WHERE elemento_subelemento IS NOT NULL;
      `);
      console.log("Dados migrados.");
      
      await connection.query("ALTER TABLE notas_empenho DROP COLUMN elemento_subelemento;");
      console.log("Coluna elemento_subelemento removida.");
    } catch (e) {
      if (e.code === 'ER_CANT_DROP_FIELD_OR_KEY' || e.code === 'ER_BAD_FIELD_ERROR') {
        console.log("Coluna elemento_subelemento já foi removida/não existe.");
      } else {
        console.log("Aviso: erro ao migrar elemento_subelemento:", e.message);
      }
    }

    console.log("Concluído com sucesso!");
    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error("Erro geral:", error);
    process.exit(1);
  }
}

main();
