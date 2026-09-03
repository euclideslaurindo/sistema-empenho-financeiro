import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();

  try {
    // busca os dados do usuario logado pelo email que veio do token
    const rows = await query<any[]>(
      'SELECT id, nome, email, perfil, ativo, created_at FROM usuarios WHERE email = ? LIMIT 1',
      [user.email]
    );
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    }
    return NextResponse.json({ usuario: rows[0] });
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const data = await request.json();
    const { nome, email } = data;

    if (!nome || !email) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // cada usuario so pode editar o proprio perfil
    await query(
      'UPDATE usuarios SET nome = ?, email = ? WHERE id = ?',
      [nome.trim(), email.trim(), user.id]
    );

    return NextResponse.json({ message: 'Perfil atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
