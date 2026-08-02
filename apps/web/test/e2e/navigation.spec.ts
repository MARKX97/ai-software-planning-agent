import { expect, test } from '@playwright/test';

test('dashboard links to new project page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '把想法做成计划' })).toBeVisible();

  await page.getByRole('link', { name: '放进一个想法' }).first().click();
  await expect(page.getByRole('heading', { name: '说说你想做什么' })).toBeVisible();
});

test('new project form blocks empty submissions with accessible errors', async ({ page }) => {
  await page.goto('/projects/new');
  await page.getByRole('button', { name: '把它放进项目里' }).click();
  await expect(page.getByText('请输入项目名称。')).toBeVisible();
  await expect(page.getByText('请输入原始想法。')).toBeVisible();
  await expect(page.getByLabel('给这个想法起个名字')).toHaveAttribute('aria-invalid', 'true');
});
