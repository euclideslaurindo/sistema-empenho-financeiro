import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { lerAno } from '@/lib/ir-pessoas-fisicas';
import { listarPessoasFisicas } from '@/lib/services/ir-pessoas-fisicas.service';

// GET /api/darf/pessoas-fisicas?ano=2026 — relatório anual por CPF para o IR
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();

    const bruto = new URL(request.url).searchParams.get('ano');
    const ano = bruto === null || bruto === '' ? null : lerAno(bruto);
    if (bruto && ano === null) {
      return NextResponse.json({ error: 'Ano inválido (use AAAA, entre 2000 e 2100).' }, { status: 400 });
    }

    const relatorio = await listarPessoasFisicas(ano);
    return NextResponse.json(relatorio, { headers: { 'Cache-Control': 'no-store' } });
  });
}
