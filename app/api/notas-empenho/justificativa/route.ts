import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { obterJustificativa, salvarJustificativa } from '@/lib/services/justificativa-saldo.service';

// B13: justificativa de sobra de recurso da NE (?ne=<número>).
// GET: qualquer usuário logado. PUT: GESTOR e ADMIN.
const numeroDa = (request: NextRequest) => request.nextUrl.searchParams.get('ne')?.trim() || '';

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();
    const numero = numeroDa(request);
    if (!numero) return NextResponse.json({ error: 'Informe o número da NE.' }, { status: 400 });
    const r = await obterJustificativa(numero);
    if (!r.success) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json(r.data, { headers: { 'Cache-Control': 'no-store' } });
  });
}

export async function PUT(request: NextRequest) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();
    if (user.perfil !== 'ADMIN' && user.perfil !== 'GESTOR') return forbiddenResponse();
    const numero = numeroDa(request);
    if (!numero) return NextResponse.json({ error: 'Informe o número da NE.' }, { status: 400 });
    const r = await salvarJustificativa(numero, await request.json(), user.id, user.perfil);
    if (!r.success) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ success: true, ...r.data });
  });
}
