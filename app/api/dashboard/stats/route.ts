import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { DashboardService } from '@/lib/services/dashboard.service';

// GET /api/dashboard/stats — estatísticas para o dashboard
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();

  try {
    // ?atualizar=1 (botão Atualizar): lê do banco agora, sem o cache.
    const fresco = request.nextUrl.searchParams.get('atualizar') === '1';
    const stats = await DashboardService.obterEstatisticas({ fresco });
    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('[API GET /dashboard/stats] Erro:', error);
    return NextResponse.json({ error: 'Erro ao buscar estatísticas.' }, { status: 500 });
  }
}
