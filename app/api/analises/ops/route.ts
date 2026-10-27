import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { listarOpsDoRecorte } from '@/lib/services/analises.service';

// GET /api/analises/ops?inicio=&fim=&base=&ano=&elemento=&cpf= — as OPs de um recorte (clicar para detalhar)
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();

    const sp = new URL(request.url).searchParams;
    const entrada = Object.fromEntries(
      ['inicio', 'fim', 'base', 'ano', 'elemento', 'cpf'].flatMap((k) => {
        const v = sp.get(k);
        return v === null || v.trim() === '' ? [] : [[k, v]];
      })
    );
    const dados = await listarOpsDoRecorte(entrada);
    return NextResponse.json(dados, { headers: { 'Cache-Control': 'no-store' } });
  });
}
