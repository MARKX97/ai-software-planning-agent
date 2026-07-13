import { expect, test } from '@playwright/test';

test('dashboard links to new project page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '把想法做成计划' })).toBeVisible();

  await page.getByRole('link', { name: '放进一个想法' }).first().click();
  await expect(page.getByRole('heading', { name: '说说你想做什么' })).toBeVisible();
});
