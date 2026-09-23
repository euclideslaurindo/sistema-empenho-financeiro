import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { NotasEmpenhoService } from '@/lib/services/notas-empenho.service';

// lista as NEs, se passar ?numero= busca uma especifica (usado na OP)
export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();
    const { searchParams } = new URL(request.url);
    const busca = searchParams.get('busca') || '';
    const numero = searchParams.get('numero') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));

    if (numero) {
      const result = await NotasEmpenhoService.buscarPorNumero(numero);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({ ne: result.data });
    }

    const result = await NotasEmpenhoService.listar({ busca, page, limit });
    return NextResponse.json(result.data);
  });
}

// cria uma NE nova no banco
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();
    const body = await request.json();

    const result = await NotasEmpenhoService.criar(body, user.id);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, id: result.data.id }, { status: result.status });
  });
}
