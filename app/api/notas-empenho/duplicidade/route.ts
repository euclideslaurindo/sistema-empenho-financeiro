import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();

  const searchParams = request.nextUrl.searchParams;
  const valorParam = searchParams.get('valor');

  if (!valorParam) {
    return NextResponse.json({ duplicado: false });
  }

  const valor = parseFloat(valorParam);
  if (isNaN(valor)) {
    return NextResponse.json({ duplicado: false });
  }

  try {
    const rows = await query<any[]>(
      'SELECT numero, data_emissao FROM notas_empenho WHERE valor = ? LIMIT 1',
      [valor]
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
