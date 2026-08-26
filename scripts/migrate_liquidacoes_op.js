const mysql = require('mysql2/promise');

async function migrate() {
  const connection = await mysql.createConnection({
    host: 'DAGMCGPA100',
    port: 3306,
    user: 'admin',
    password: 'qwe124578',
    database: 'empenho'
  });

  try {
    console.log('Iniciando migração de banco de dados...');

    // 1. Atualizar notas_empenho com exercicio
    console.log('Atualizando exercicio nas notas de empenho...');
    const [notas] = await connection.execute('SELECT id, data_pagamento, created_at FROM notas_empenho WHERE exercicio IS NULL OR exercicio = ""');
    
    let notasCount = 0;
    for (const nota of notas) {
      const dateString = nota.data_pagamento || nota.created_at;
      if (dateString) {
        const year = new Date(dateString).getFullYear().toString();
        await connection.execute('UPDATE notas_empenho SET exercicio = ? WHERE id = ?', [year, nota.id]);
        notasCount++;
      }
    }
    console.log(`[OK] ${notasCount} notas de empenho atualizadas com ano de exercicio.`);

    // 2. Atualizar ordens_pagamento com liquidacao_id
    console.log('Atualizando liquidacao_id nas ordens de pagamento...');
    const [ops] = await connection.execute('SELECT id, numero_ne FROM ordens_pagamento WHERE liquidacao_id IS NULL OR liquidacao_id = ""');
    
    let opsCount = 0;
    for (const op of ops) {
      // Tenta achar a liquidação correspondente a essa NE
      // Em casos antigos onde não há vínculo direto 1:1, pegamos a última liquidação
      const [liqs] = await connection.execute(`
        SELECT l.id 
        FROM liquidacoes l
        INNER JOIN notas_empenho ne ON l.notas_empenho_id = ne.id
        WHERE ne.numero = ?
        ORDER BY l.created_at DESC LIMIT 1
      `, [op.numero_ne]);

      if (liqs && liqs.length > 0) {
        await connection.execute('UPDATE ordens_pagamento SET liquidacao_id = ? WHERE id = ?', [liqs[0].id, op.id]);
        opsCount++;
      }
    }
    console.log(`[OK] ${opsCount} ordens de pagamento vinculadas às suas liquidações.`);

    console.log('Migração concluída com sucesso!');
  } catch (err) {
    console.error('Erro na migração:', err);
  } finally {
    await connection.end();
  }
}

migrate();
