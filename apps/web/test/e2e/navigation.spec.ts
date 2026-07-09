import { expect, test } from '@playwright/test';

test('dashboard links to new project page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '规划控制台' })).toBeVisible();

  await page.getByRole('link', { name: '新建项目' }).first().click();
  await expect(page.getByRole('heading', { name: '新建规划项目' })).toBeVisible();
});
