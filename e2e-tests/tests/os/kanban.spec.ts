import { test, expect } from '@playwright/test';

test.describe('Kanban e Painel de OS', () => {
  test('Deve carregar o Kanban e exibir todas as colunas de status', async ({ page }) => {
    await page.goto('/kanban');
    
    // Verifica os cabeçalhos das colunas
    await expect(page.locator('text=Pendente').first()).toBeVisible();
    await expect(page.locator('text=Em Execução').first()).toBeVisible();
    await expect(page.locator('text=Em Revisão').first()).toBeVisible();
    await expect(page.locator('text=Concluído').first()).toBeVisible();
  });

  test('Deve abrir o modal de Nova OS pelo Header', async ({ page }) => {
    await page.goto('/kanban');
    
    // Clica no botão "+ Nova OS"
    const novaOsBtn = page.getByRole('button').filter({ hasText: 'Nova OS' }).first();
    // Se o usuário logado tiver permissão, o botão existe
    if (await novaOsBtn.isVisible()) {
      await novaOsBtn.click();
      await expect(page.locator('text=Criar Nova OS').or(page.locator('text=Nova Ordem de Serviço')).first()).toBeVisible();
      // Cancela/fecha o modal
      await page.getByRole('button', { name: /Cancelar/i }).first().click();
    }
  });
});
