/**
 * Roda uma vez antes de toda a suíte E2E. O Playwright já garante que o
 * webServer (`npm run dev`, ver playwright.config.ts) está de pé e respondendo
 * antes de disparar isto, então é seguro chamar a API aqui.
 *
 * GET /api/setup cria a tabela `usuarios` (se não existir) e o usuário admin
 * inicial (admin@admin.com / ADMIN_INITIAL_PASSWORD ou "Mudar@123"). Só
 * funciona com ENABLE_SETUP=true e fora de produção — a própria rota se
 * recusa a rodar caso contrário.
 */
export default async function globalSetup() {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  const res = await fetch(`${baseURL}/api/setup`);

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Setup do banco de teste falhou (${res.status}): ${body}\n` +
      'Verifique se ENABLE_SETUP=true está definido no ambiente que roda os testes E2E.'
    );
  }
}
