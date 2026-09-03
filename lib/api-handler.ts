import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export type StandardResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
};

// wrapper pra tratar excecoes nas rotas da api sem ter que repetir try/catch em todo lugar
export async function withErrorHandler(
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error: any) {
    console.error('[API Error]:', error);

    // erro de validação do zod, manda 400 com os detalhes
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Dados inválidos.',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    // qualquer outro erro (banco, logica, etc)
    // nao manda a mensagem original pra nao vazar query sql no front
    return NextResponse.json(
      {
        success: false,
        error: 'Ocorreu um erro interno ao processar a requisição.',
      },
      { status: 500 }
    );
  }
}
