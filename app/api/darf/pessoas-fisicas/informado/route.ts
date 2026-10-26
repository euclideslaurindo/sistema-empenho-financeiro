import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { marcarInformado } from '@/lib/services/ir-pessoas-fisicas.service';

// POST /api/darf/pessoas-fisicas/informado — marca/desmarca "já informado no IR"
export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();
    if (user.perfil !== 'ADMIN' && user.perfil !== 'GESTOR') return forbiddenResponse();

    const body = await request.json();
    const result = await marcarInformado(body, user.id, user.perfil);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, ...result.data });
  });
}
