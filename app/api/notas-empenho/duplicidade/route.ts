import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { NotasEmpenhoService } from '@/lib/services/notas-empenho.service';

// GET /api/notas-empenho/duplicidade?valor=&elemento=&subelemento=
// (T30) A regra é valor + elemento + subelemento. `credor`/`cpfCnpj` de
// clientes antigos são aceitos e ignorados.
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();

    const searchParams = request.nextUrl.searchParams;
    const result = await NotasEmpenhoService.verificarDuplicidade({
      valor: searchParams.get('valor'),
      elemento: searchParams.get('elemento') || '',
      subelemento: searchParams.get('subelemento') || '',
    });
    return NextResponse.json(result);
  });
}
