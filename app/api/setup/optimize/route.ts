import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_SETUP !== 'true') {
    return NextResponse.json(
      { error: 'Rota desabilitada em producao. Use ENABLE_SETUP=true.' },
      { status: 403 }
    );
  }

  const logs: string[] = [];

  const runSafe = async (sql: string, successMsg: string, isIndex = false) => {
    try {
      await query(sql);
      logs.push(`[OK] ${successMsg}`);
    } catch (e: any) {
      if (isIndex && (e.code === 'ER_DUP_KEYNAME' || e.code === 'ER_CANT_CREATE_TABLE')) {
        logs.push(`[SKIP] ${successMsg} (Já existe)`);
      } else {
        logs.push(`[ERRO] ${successMsg}: ${e.message}`);
      }
    }
  };

  try {
    // 1. Criação de Índices B-Tree
    await runSafe('CREATE INDEX idx_op_numero_ne ON ordens_pagamento(numero_ne)', 'Índice idx_op_numero_ne', true);
    await runSafe('CREATE INDEX idx_op_empenho ON ordens_pagamento(numero_empenho)', 'Índice idx_op_empenho', true);
    await runSafe('CREATE INDEX idx_ne_numero ON notas_empenho(numero)', 'Índice idx_ne_numero', true);
    await runSafe('CREATE INDEX idx_credor_cpf ON credores(cpf_cnpj)', 'Índice idx_credor_cpf', true);

    // 2. Precisão Financeira DECIMAL(15,2)
    // Tabela notas_empenho
    await runSafe(
      'ALTER TABLE notas_empenho MODIFY COLUMN valor DECIMAL(15,2)',
      'Precisão DECIMAL em notas_empenho'
    );

    // Tabela ordens_pagamento
    await runSafe(
      `ALTER TABLE ordens_pagamento 
       MODIFY COLUMN valor_pagamento DECIMAL(15,2),
       MODIFY COLUMN valor_empenho DECIMAL(15,2),
       MODIFY COLUMN saldo_anterior DECIMAL(15,2),
       MODIFY COLUMN item_quantidade DECIMAL(15,2),
       MODIFY COLUMN item_valor_unitario DECIMAL(15,2),
       MODIFY COLUMN item_quantidade2 DECIMAL(15,2),
       MODIFY COLUMN item_valor_unitario2 DECIMAL(15,2),
       MODIFY COLUMN irrf DECIMAL(15,2),
       MODIFY COLUMN iss DECIMAL(15,2),
       MODIFY COLUMN inss DECIMAL(15,2),
       MODIFY COLUMN sest_senat DECIMAL(15,2),
       MODIFY COLUMN patronal DECIMAL(15,2),
       MODIFY COLUMN outros_descontos DECIMAL(15,2),
       MODIFY COLUMN total_descontos DECIMAL(15,2),
       MODIFY COLUMN valor_liquido DECIMAL(15,2)`,
      'Precisão DECIMAL em ordens_pagamento'
    );

    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message, logs }, { status: 500 });
  }
}
