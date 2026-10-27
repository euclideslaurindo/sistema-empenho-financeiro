import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { ErroPeriodo, obterAnalises } from '@/lib/services/analises.service';

// GET /api/analises?periodo=s1|s2|ano|intervalo&ano=&inicio=&fim=&base=civil|exercicio&elemento=
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();

    const sp = new URL(request.url).searchParams;
    const entrada = Object.fromEntries(
      ['periodo', 'ano', 'inicio', 'fim', 'base', 'elemento'].flatMap((k) => {
        const v = sp.get(k);
        return v === null || v.trim() === '' ? [] : [[k, v]];
      })
    );
    try {
      const dados = await obterAnalises(entrada);
      return NextResponse.json(dados, { headers: { 'Cache-Control': 'no-store' } });
    } catch (e) {
      if (e instanceof ErroPeriodo) return NextResponse.json({ error: e.message }, { status: 400 });
      throw e;
    }
  });
}
