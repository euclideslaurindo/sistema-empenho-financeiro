import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { ErroPeriodo, obterAnalises } from '@/lib/services/analises.service';
import { montarCsvAnalises, nomeArquivoCsvAnalises } from '@/lib/analises-csv';

// GET /api/analises/csv — os mesmos filtros de /api/analises, em planilha.
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();

    const sp = new URL(request.url).searchParams;
    const entrada = Object.fromEntries(
      ['periodo', 'ano', 'inicio', 'fim', 'base', 'elemento'].flatMap((k) => {
        const valor = sp.get(k);
        return valor === null || valor.trim() === '' ? [] : [[k, valor]];
      })
    );
    try {
      const dados = await obterAnalises(entrada);
      return new Response(montarCsvAnalises(dados), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${nomeArquivoCsvAnalises(dados)}"`,
          'Cache-Control': 'no-store',
        },
      });
    } catch (e) {
      if (e instanceof ErroPeriodo) return NextResponse.json({ error: e.message }, { status: 400 });
      throw e;
    }
  });
}
