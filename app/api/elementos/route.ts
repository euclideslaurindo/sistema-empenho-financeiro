import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { ElementoService } from '@/lib/services/elemento.service';

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const incluirInativos = searchParams.get('incluirInativos') === '1' && user.perfil === 'ADMIN';

    const result = await ElementoService.listar({ incluirInativos });

    return NextResponse.json(result.data, { headers: { 'Cache-Control': 'no-store' } });
  });
}

export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();
    if (user.perfil !== 'ADMIN') return forbiddenResponse();

    const body = await request.json();
    const result = await ElementoService.criar(body, user.id);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, codigo: result.data.codigo }, { status: result.status });
  });
}
