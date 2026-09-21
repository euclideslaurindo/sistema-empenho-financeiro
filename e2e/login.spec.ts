import { test, expect } from '@playwright/test';

/**
 * Smoke test de login → dashboard
 *
 * REQUISITOS:
 * - Banco de dados rodando com as tabelas criadas
 * - Usuário de teste existente com email: admin@admin.com e senha: Mudar@123
 *   (use a rota GET /api/setup com ENABLE_SETUP=true para criar)
 * - Servidor dev rodando em http://localhost:3000
 *
 * Este teste NÃO usa mocks — é um teste E2E real que valida o fluxo completo.
 */

test.describe('Auth Flow — Login → Dashboard', () => {
  test('Login com credenciais válidas redireciona para dashboard', async ({ page }) => {
    // Navega até a página de login
    await page.goto('/login');
    expect(page).toHaveURL('/login');

    // Preenche email
    await page.fill('input[type="email"]', 'admin@admin.com');

    // Preenche senha
    await page.fill('input[type="password"]', 'Mudar@123');

    // Submete formulário
    await page.click('button[type="submit"]');

    // Aguarda redirecionamento para dashboard
    await page.waitForURL('/');
    expect(page).toHaveURL('/');

    // Valida que o dashboard carregou (elemento característico)
    const dashboardTitle = page.locator('h1, [data-testid="dashboard-title"]');
    await expect(dashboardTitle).toBeVisible({ timeout: 5000 });

    // Valida que o usuário está autenticado (header mostra nome do usuário ou logout button)
    const logoutButton = page.locator('button[aria-label*="Sair"]');
    await expect(logoutButton).toBeVisible();
  });

  test('Login com senha inválida mostra erro', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'admin@admin.com');
    await page.fill('input[type="password"]', 'WrongPassword');

    await page.click('button[type="submit"]');

    // Aguarda mensagem de erro
    const errorMessage = page.locator('[role="alert"], .error, .toast-error').first();
    await expect(errorMessage).toBeVisible({ timeout: 3000 });
    await expect(errorMessage).toContainText(/inválid|credenciais|não encontrad/i);

    // Valida que não foi redirecionado
    expect(page).toHaveURL('/login');
  });

  test('Login com email não registrado mostra erro', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'nonexistent@example.com');
    await page.fill('input[type="password"]', 'SomePassword123');

    await page.click('button[type="submit"]');

    const errorMessage = page.locator('[role="alert"], .error, .toast-error').first();
    await expect(errorMessage).toBeVisible({ timeout: 3000 });

    expect(page).toHaveURL('/login');
  });

  test('Logout redireciona para login', async ({ page }) => {
    // Faz login primeiro
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@admin.com');
    await page.fill('input[type="password"]', 'Mudar@123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // Clica em logout
    const logoutButton = page.locator('button[aria-label*="Sair"]');
    await logoutButton.click();

    // Aguarda redirecionamento para login
    await page.waitForURL('/login', { timeout: 5000 });
    expect(page).toHaveURL('/login');
  });
});
