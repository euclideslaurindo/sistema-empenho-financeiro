import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { query } from '@/lib/db';
import { obterSaldoNe, saldoParaResposta } from '@/lib/services/saldo-ne';

// GET /api/notas-empenho/saldo?numero=… — valor, gasto, restante, % gasto e
// quantidade de OPs da NE (T31). Leitura; qualquer usuário logado.
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();

    const numero = request.nextUrl.searchParams.get('numero')?.trim();
    if (!numero) return NextResponse.json({ error: 'Informe o número da NE.' }, { status: 400 });

    const saldo = await obterSaldoNe((sql, params) => query<any[]>(sql, params), numero);
    if (!saldo) return NextResponse.json({ error: 'NE não encontrada.' }, { status: 404 });

    return NextResponse.json({ numero, saldo: saldoParaResposta(saldo) }, { headers: { 'Cache-Control': 'no-store' } });
  });
}
