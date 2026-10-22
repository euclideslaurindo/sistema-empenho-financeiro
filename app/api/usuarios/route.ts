import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth';
import { criarUsuario, listarUsuarios } from '@/lib/services/usuario.service';

// GET /api/usuarios - Lista usuários
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || user.perfil !== 'ADMIN') return unauthorizedResponse();

  try {
    const usuarios = await listarUsuarios();
    return NextResponse.json({ usuarios });
  } catch (error: any) {
    console.error('[GET /api/usuarios] Erro:', error);
    return NextResponse.json({ error: 'Erro ao listar usuários' }, { status: 500 });
  }
}

// POST /api/usuarios - Cria novo usuário
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || user.perfil !== 'ADMIN') return unauthorizedResponse();

  try {
    const body = await request.json();
    const { nome, email, senha, perfil } = body;

    if (!nome || !email || !senha) {
      return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios' }, { status: 400 });
    }

    // Administrador, Gestor ou Consulta. Sem perfil (ou "USER", da tela antiga), Gestor.
    const roleValue = perfil === undefined || perfil === null || perfil === '' || perfil === 'USER' ? 'GESTOR' : perfil;

    const result = await criarUsuario({ nome: String(nome).trim(), email: String(email).trim(), senha, perfil: roleValue });
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, id: result.id }, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/usuarios] Erro:', error);
    return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 });
  }
}
