import { test as setup, expect } from '@playwright/test';
import * as path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  
  // Utiliza o botão de preencher demo para logar
  await page.getByRole('button', { name: /Preencher Credenciais/i }).click();
  await page.getByRole('button', { name: 'Entrar' }).click();
  
  // Aguarda carregar
  await page.waitForURL('**/kanban');
  await expect(page.locator('text=Painel Kanban')).toBeVisible();

  // Salva o state
  await page.context().storageState({ path: authFile });
});
