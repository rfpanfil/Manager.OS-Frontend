import { test, expect } from '@playwright/test';

test.describe('Calendário e Cronograma 52 Semanas', () => {
  test('Deve renderizar o Calendário', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.locator('text=Baixar relatório').first()).toBeVisible();
  });

  test('Deve renderizar o Cronograma de 52 Semanas', async ({ page }) => {
    await page.goto('/schedule');
    await expect(page.locator('text=Todos').or(page.locator('text=Agendar')).first()).toBeVisible();
  });
});
