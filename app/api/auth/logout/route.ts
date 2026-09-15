import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  // Remove o cookie auth_token setando a data de expiração no passado
  response.cookies.delete('auth_token');
  return response;
}
