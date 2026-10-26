import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { withErrorHandler } from '@/lib/api-handler';
import { cpfDoTexto, lerAno } from '@/lib/ir-pessoas-fisicas';
import { detalharPessoaFisica } from '@/lib/services/ir-pessoas-fisicas.service';

/** "%2E" → "." (senão o "2" do código entraria nos dígitos); % malformado → null (400). */
const decodificar = (v: string) => {
  try {
    return decodeURIComponent(v);
  } catch {
    return null;
  }
};

// GET /api/darf/pessoas-fisicas/[cpf]?ano=2026 — OPs de uma pessoa no ano
export async function GET(request: NextRequest, { params }: { params: Promise<{ cpf: string }> }) {
  return withErrorHandler(async () => {
    const user = await getAuthUser(request);
    if (!user) return unauthorizedResponse();

    const cpf = cpfDoTexto(decodificar((await params).cpf));
    if (!cpf) return NextResponse.json({ error: 'CPF inválido (11 dígitos).' }, { status: 400 });

    const ano = lerAno(new URL(request.url).searchParams.get('ano'));
    if (ano === null) {
      return NextResponse.json({ error: 'Ano inválido (use AAAA, entre 2000 e 2100).' }, { status: 400 });
    }

    const ops = await detalharPessoaFisica(ano, cpf);
    return NextResponse.json({ ano, cpf, ops }, { headers: { 'Cache-Control': 'no-store' } });
  });
}
