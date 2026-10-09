import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { alterarStatusDarf } from '@/lib/services/darf.service';

export async function POST(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();
    if (user.perfil !== 'ADMIN' && user.perfil !== 'GESTOR') return forbiddenResponse();

    const body = await request.json();
    const result = await alterarStatusDarf(body, user.id, user.perfil);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, ...result.data });
  });
}
