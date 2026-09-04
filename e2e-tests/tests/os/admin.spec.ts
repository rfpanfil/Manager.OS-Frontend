import { test, expect } from '@playwright/test';

test.describe('Painel Admin e Configurações', () => {
  test('Deve acessar a Matriz de Permissões', async ({ page }) => {
    await page.goto('/admin/permissoes');
    // Verifica o texto do h1 da página de permissões
    await expect(page.locator('text=Gerenciamento de Permissões').first()).toBeVisible();
    await expect(page.locator('text=Novo Cargo').first()).toBeVisible();
  });

  test('Deve acessar a página de Empresas (SaaS)', async ({ page }) => {
    await page.goto('/admin/empresas');
    await expect(page.locator('text=Nova Empresa').or(page.locator('text=Gestão de Clientes')).first()).toBeVisible();
  });
});
