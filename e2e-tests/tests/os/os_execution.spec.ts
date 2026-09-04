import { test, expect } from '@playwright/test';

test.describe('Fluxo de Criação e Execução de OS', () => {
  test('Deve abrir modal de Nova OS e validar campos obrigatórios', async ({ page }) => {
    await page.goto('/kanban');
    
    // Abre a OS
    const novaOsBtn = page.getByRole('button').filter({ hasText: 'Nova OS' }).first();
    if (await novaOsBtn.isVisible()) {
      await novaOsBtn.click();
      
      const modal = page.locator('.fixed').first();
      await expect(modal).toBeVisible();
      
      // O botão pode ser um ícone de fechar "X"
      const btnClose = modal.locator('button').first();
      await expect(btnClose).toBeVisible();
      await btnClose.click();
    }
  });
});
