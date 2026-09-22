import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { criarUsuario } from '@/lib/services/usuario.service';

export async function POST(request: NextRequest) {
  // Somente ADMIN pode criar novos usuários
  const admin = await getAuthUser(request);
  if (!admin) return unauthorizedResponse();
  if (admin.perfil !== 'ADMIN') return forbiddenResponse();

  try {
    const body = await request.json();
    const { nome, senha } = body;

    if (!nome || !senha) {
      return NextResponse.json(
        { error: 'Nome e senha são obrigatórios' },
        { status: 400 }
      );
    }

    if (nome.trim().length > 100) {
      return NextResponse.json(
        { error: 'O nome de usuário não pode ter mais de 100 caracteres.' },
        { status: 400 }
      );
    }

    if (senha.length < 8) {
      return NextResponse.json(
        { error: 'A senha deve ter no mínimo 8 caracteres' },
        { status: 400 }
      );
    }

    if (senha.length > 128) {
      return NextResponse.json(
        { error: 'A senha não pode ter mais de 128 caracteres.' },
        { status: 400 }
      );
    }

    // Criar um email fake baseado no nome de usuário + hash único para evitar colisão de homônimos
    // Ex: "João Silva" + UUID abc12345 → "joao.silva.abc12345@empenho.local"
    const uniqueSuffix = crypto.randomUUID().replace(/-/g, '').substring(0, 8);
    const normalizedUsername = nome.trim().toLowerCase().replace(/\s+/g, '.');
    const fakeEmail = `${normalizedUsername}.${uniqueSuffix}@empenho.local`;

    const result = await criarUsuario({ nome: nome.trim(), email: fakeEmail, senha, perfil: 'GESTOR' });
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      message: 'Usuário criado com sucesso'
    });

  } catch (error: any) {
    console.error('[API Auth Register] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno no servidor ao criar usuário.' },
      { status: 500 }
    );
  }
}
