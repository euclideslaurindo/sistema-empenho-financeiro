import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { LiquidacaoService } from '@/lib/services/liquidacao.service';

export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();

    const body = await request.json();
    const result = await LiquidacaoService.criar(body, user.id, user.perfil);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, id: result.data.id }, { status: result.status });
  });
}
