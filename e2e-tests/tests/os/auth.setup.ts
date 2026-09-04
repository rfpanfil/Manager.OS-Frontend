import { test as setup, expect } from '@playwright/test';
import * as path from 'path';

const authFile = path.join(__dirname, '../../playwright/.auth/os_user.json');

setup('authenticate OS', async ({ page }) => {
  setup.setTimeout(120000); 
  
  await page.goto('/login');
  
  const preencherBtn = page.getByRole('button', { name: /Preencher/i }).first();
  await expect(preencherBtn).toBeVisible({ timeout: 30000 });
  await preencherBtn.click();
  
  await page.getByRole('button', { name: /Entrar/i }).first().click();
  
  // Esperar o render acordar
  await expect(page.locator('text=Painel Kanban').first()).toBeVisible({ timeout: 80000 });
  
  await page.context().storageState({ path: authFile });
});
