import { test, expect } from '@playwright/test';

test.describe('Planos de Manutenção', () => {
  test('Deve acessar os Planos de Manutenção e carregar as bibliotecas', async ({ page }) => {
    await page.goto('/plans');
    
    // Verifica elementos base da tela em vez de botões restritos
    await expect(page.locator('text=Planos de Manutenção').first()).toBeVisible();
    await expect(page.locator('text=Plano da Usina').or(page.locator('text=Plano Padrão')).first()).toBeVisible();
  });
});
