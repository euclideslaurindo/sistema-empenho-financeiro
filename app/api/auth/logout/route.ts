import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/constants';

export async function POST() {
  const response = NextResponse.json({ success: true });
  // Remove o cookie de autenticação setando a data de expiração no passado
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}
