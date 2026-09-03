import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const cnpj = searchParams.get('cnpj')?.replace(/\D/g, '') || '';

    if (cnpj.length !== 14) {
      return NextResponse.json({ error: 'CNPJ deve conter 14 dígitos.' }, { status: 400 });
    }

    // 1. Tentar BrasilAPI pelo Backend (sem bloqueio de CORS)
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
        headers: { 'User-Agent': 'Sistema-Financeiro-Educacao/1.0' },
        cache: 'no-store'
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json({
          razao_social: data.razao_social || data.nome_fantasia || '',
          logradouro: `${data.descricao_tipo_de_logradouro || ''} ${data.logradouro || ''}`.trim(),
          numero: data.numero || '',
          bairro: data.bairro || '',
          cep: data.cep ? data.cep.replace(/\D/g, '') : '',
          municipio: data.municipio || '',
          uf: data.uf || '',
          ddd_telefone_1: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.substring(0,2)}) ${data.ddd_telefone_1.substring(2)}` : ''
        });
      }
    } catch (e) {
      console.warn('[CNPJ Proxy] Falha BrasilAPI, tentando fallback...');
    }

    // 2. Fallback: MinhaReceita / OpenCNPJ se a BrasilAPI falhar
    try {
      const resFallback = await fetch(`https://minhareceita.org/${cnpj}`, { cache: 'no-store' });
      if (resFallback.ok) {
        const data = await resFallback.json();
        return NextResponse.json({
          razao_social: data.razao_social || data.nome_fantasia || '',
          logradouro: `${data.descricao_tipo_de_logradouro || ''} ${data.logradouro || ''}`.trim(),
          numero: data.numero || '',
          bairro: data.bairro || '',
          cep: data.cep ? String(data.cep).replace(/\D/g, '') : '',
          municipio: data.municipio || '',
          uf: data.uf || '',
          ddd_telefone_1: data.ddd_telefone_1 || ''
        });
      }
    } catch (e2) {}

    return NextResponse.json({ error: 'CNPJ não localizado na base da Receita Federal.' }, { status: 404 });
  } catch (error: any) {
    console.error('[API /consulta-cnpj] Erro:', error);
    return NextResponse.json({ error: 'Erro ao consultar CNPJ.' }, { status: 500 });
  }
}
