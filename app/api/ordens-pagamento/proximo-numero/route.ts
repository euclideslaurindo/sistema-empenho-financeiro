import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { MAX_OPS_POR_EMISSAO, preverProximoNumeroOp, quantidadeValida } from '@/lib/services/numeracao-op';

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();
    if (user.perfil !== 'ADMIN' && user.perfil !== 'GESTOR') return forbiddenResponse();

    const params = new URL(request.url).searchParams;
    const numeroNe = params.get('numeroNe')?.trim();
    if (!numeroNe) {
      return NextResponse.json({ error: 'Informe o número da NE.' }, { status: 400 });
    }

    // T34-B: `quantidade` opcional — um número previsto por linha da emissão.
    const quantidadeParam = params.get('quantidade');
    let quantidade: number | undefined;
    if (quantidadeParam !== null) {
      quantidade = /^\d+$/.test(quantidadeParam.trim()) ? Number(quantidadeParam) : NaN;
      if (!quantidadeValida(quantidade)) {
        return NextResponse.json(
          { error: `A quantidade deve ser um número inteiro de 1 a ${MAX_OPS_POR_EMISSAO}.` },
          { status: 400 }
        );
      }
    }

    const result = await preverProximoNumeroOp(numeroNe, quantidade);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
  });
}
