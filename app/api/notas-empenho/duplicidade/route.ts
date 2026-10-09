import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { NotasEmpenhoService } from '@/lib/services/notas-empenho.service';

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();

    const searchParams = request.nextUrl.searchParams;
    const valorParam = searchParams.get('valor');
    const credorParam = searchParams.get('credor') || '';
    const subelementoParam = searchParams.get('subelemento') || '';
    const cpfCnpjParam = searchParams.get('cpfCnpj') || '';

    const result = await NotasEmpenhoService.verificarDuplicidade(valorParam, credorParam, subelementoParam, cpfCnpjParam);
    return NextResponse.json(result);
  });
}
