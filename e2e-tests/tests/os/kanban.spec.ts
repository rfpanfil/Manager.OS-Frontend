import { test, expect } from '@playwright/test';

test.describe('Módulo Kanban de OS (Interação e Mocks)', () => {
  test('Deve criar uma Ordem de Serviço nova no Kanban usando Mock de API', async ({ page }) => {
    
    // MOCK DE API para proteger o banco industrial
    await page.route('**/api/os*', async route => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ id: 1050, titulo: 'Manutenção Preditiva Elevador', status: 'aberto' })
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/kanban');
    
    const btnNovaOs = page.getByRole('button').filter({ hasText: /Nova OS|Criar/i }).first();
    await expect(btnNovaOs).toBeVisible({ timeout: 15000 });
    await btnNovaOs.click();

    // Preenchimento do modal
    await page.getByPlaceholder(/Título/i).fill('Manutenção Preditiva Elevador');
    await page.getByRole('button', { name: /Salvar/i }).click();

    // Valida se o card apareceu no Kanban (UI reagindo ao Mock)
    await expect(page.getByText(/Manutenção Preditiva Elevador/i)).toBeVisible({ timeout: 5000 });
  });
});
