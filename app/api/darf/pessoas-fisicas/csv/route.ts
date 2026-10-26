import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { lerAno, montarCsvIr, nomeArquivoCsvIr } from '@/lib/ir-pessoas-fisicas';
import { listarPessoasFisicas } from '@/lib/services/ir-pessoas-fisicas.service';

// GET /api/darf/pessoas-fisicas/csv?ano=2026 — planilha do ano para o Excel
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();

    const ano = lerAno(new URL(request.url).searchParams.get('ano'));
    if (ano === null) {
      return NextResponse.json({ error: 'Ano inválido (use AAAA, entre 2000 e 2100).' }, { status: 400 });
    }

    const { pessoas } = await listarPessoasFisicas(ano);
    // Response padrão da Web: o corpo é texto, não JSON.
    return new Response(montarCsvIr(ano, pessoas), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${nomeArquivoCsvIr(ano)}"`,
        'Cache-Control': 'no-store',
      },
    });
  });
}
