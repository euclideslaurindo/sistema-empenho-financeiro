import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();

  const searchParams = request.nextUrl.searchParams;
  const valorParam = searchParams.get('valor');
  const credorParam = searchParams.get('credor') || '';
  const subelementoParam = searchParams.get('subelemento') || '';

  if (!valorParam) {
    return NextResponse.json({ duplicado: false });
  }

  const valor = parseFloat(valorParam);
  if (isNaN(valor)) {
    return NextResponse.json({ duplicado: false });
  }

  try {
    // Duplicidade = mesmo Valor + mesmo Credor + mesmo Subelemento
    const rows = await query<any[]>(
      `SELECT numero, data_emissao FROM notas_empenho 
       WHERE valor = ? 
         AND (credor_nome = ? OR ? = '')
         AND (subelemento = ? OR ? = '')
       LIMIT 1`,
      [valor, credorParam, credorParam, subelementoParam, subelementoParam]
    );

    if (rows && rows.length > 0) {
      return NextResponse.json({ 
        duplicado: true, 
        nota: rows[0] 
      });
    }

    return NextResponse.json({ duplicado: false });
  } catch (error) {
    console.error('Erro ao verificar duplicidade:', error);
    return NextResponse.json({ error: 'Erro ao verificar duplicidade' }, { status: 500 });
  }
}
