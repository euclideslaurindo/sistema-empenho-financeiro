import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { DashboardService } from '@/lib/services/dashboard.service';

// GET /api/dashboard/stats — estatísticas para o dashboard
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const stats = await DashboardService.obterEstatisticas();
    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('[API GET /dashboard/stats] Erro:', error);
    return NextResponse.json({ error: 'Erro ao buscar estatísticas.' }, { status: 500 });
  }
}
