import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import * as bcrypt from 'bcryptjs';

export async function PUT(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const data = await request.json();
    const { senhaAtual, novaSenha } = data;

    if (!senhaAtual || !novaSenha) {
      return NextResponse.json({ error: 'Senha atual e nova senha são obrigatórias.' }, { status: 400 });
    }

    if (novaSenha.length < 8) {
      return NextResponse.json({ error: 'A nova senha deve ter no mínimo 8 caracteres.' }, { status: 400 });
    }

    const rows = await query<any[]>('SELECT senha_hash FROM usuarios WHERE id = ?', [user.id]);
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const isValid = await bcrypt.compare(senhaAtual, rows[0].senha_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 401 });
    }

    const newHash = await bcrypt.hash(novaSenha, 10);
    await query('UPDATE usuarios SET senha_hash = ? WHERE id = ?', [newHash, user.id]);

    return NextResponse.json({ message: 'Senha atualizada com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar senha:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
