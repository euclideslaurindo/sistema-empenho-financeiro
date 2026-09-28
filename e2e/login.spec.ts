import { test, expect } from '@playwright/test';

/**
 * Smoke test de login → dashboard
 *
 * REQUISITOS:
 * - Banco de dados MySQL acessível (local ou o serviço `mysql` do CI, ver
 *   .github/workflows/ci.yml, job `e2e`)
 * - ENABLE_SETUP=true no ambiente — o usuário admin@admin.com / Mudar@123
 *   (ou ADMIN_INITIAL_PASSWORD) é criado automaticamente por
 *   e2e/global-setup.ts, que roda antes da suíte (ver playwright.config.ts)
 * - Servidor dev é subido automaticamente pelo Playwright (webServer)
 *
 * Este teste NÃO usa mocks — é um teste E2E real que valida o fluxo completo.
 */

test.describe('Auth Flow — Login → Dashboard', () => {
  test('Login com credenciais válidas redireciona para dashboard', async ({ page }) => {
    // Navega até a página de login
    await page.goto('/login');
    expect(page).toHaveURL('/login');

    // Preenche email
    await page.fill('#login-email', 'admin@admin.com');

    // Preenche senha
    await page.fill('#login-senha', 'Mudar@123');

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

    await page.fill('#login-email', 'admin@admin.com');
    await page.fill('#login-senha', 'WrongPassword');

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

    await page.fill('#login-email', 'nonexistent@example.com');
    await page.fill('#login-senha', 'SomePassword123');

    await page.click('button[type="submit"]');

    const errorMessage = page.locator('[role="alert"], .error, .toast-error').first();
    await expect(errorMessage).toBeVisible({ timeout: 3000 });

    expect(page).toHaveURL('/login');
  });

  test('Logout redireciona para login', async ({ page }) => {
    // Faz login primeiro
    await page.goto('/login');
    await page.fill('#login-email', 'admin@admin.com');
    await page.fill('#login-senha', 'Mudar@123');
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
