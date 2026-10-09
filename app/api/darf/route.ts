import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { listarDarf } from '@/lib/services/darf.service';

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();

    const sp = new URL(request.url).searchParams;
    const competencia = sp.get('competencia') || null;
    const status = sp.get('status') || null;
    const agrupar = sp.get('agrupar') || 'op';

    if (competencia && !/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia)) {
      return NextResponse.json({ error: 'Competência inválida (use AAAA-MM).' }, { status: 400 });
    }
    if (status && status !== 'PENDENTE' && status !== 'PAGA') {
      return NextResponse.json({ error: 'Status inválido (PENDENTE ou PAGA).' }, { status: 400 });
    }
    if (agrupar !== 'op' && agrupar !== 'credor') {
      return NextResponse.json({ error: 'Agrupamento inválido (op ou credor).' }, { status: 400 });
    }

    const rawPage = parseInt(sp.get('page') || '1', 10);
    const rawLimit = parseInt(sp.get('limit') || '50', 10);
    const page = Math.max(1, Number.isNaN(rawPage) ? 1 : rawPage);
    const limit = Math.min(100, Math.max(1, Number.isNaN(rawLimit) ? 50 : rawLimit));

    const result = await listarDarf({
      competencia,
      status: status as 'PENDENTE' | 'PAGA' | null,
      busca: sp.get('busca'),
      page,
      limit,
      agrupar,
    });
    return NextResponse.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
  });
}
