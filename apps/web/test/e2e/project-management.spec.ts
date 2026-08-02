import { expect, test } from '@playwright/test';

const apiBase = 'http://127.0.0.1:3001/api/v1';

test('user can find, filter and delete a project', async ({ page, request }) => {
  const name = `E2E 管理项目 ${Date.now()}`;
  const created = await request.post(`${apiBase}/projects`, {
    data: { name, original_idea: '验证项目列表与删除路径。' },
  });
  expect(created.status()).toBe(201);
  const project = (await created.json()) as { id: string };
  let deleted = false;
  try {
    await page.goto('/projects');
    await expect(page.getByRole('link', { name })).toBeVisible();

    await page.getByRole('tab', { name: '已经收好' }).click();
    await expect(page.getByRole('link', { name })).not.toBeVisible();
    await page.getByRole('tab', { name: '正在推进' }).click();
    await expect(page.getByRole('link', { name })).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    const card = page
      .getByRole('link', { name })
      .locator('xpath=ancestor::*[.//button[normalize-space()="移除"]][1]');
    await card.getByRole('button', { name: '移除' }).click();
    await expect(page.getByRole('link', { name })).not.toBeVisible();
    deleted = true;
  } finally {
    if (!deleted) await request.delete(`${apiBase}/projects/${project.id}`);
  }
});

test('project list exposes a friendly error and recovers on retry', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/v1/projects**', async (route) => {
    attempts += 1;
    if (attempts <= 2) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'private failure' } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], total: 0, offset: 0, limit: 20 }),
    });
  });

  await page.goto('/projects');
  await expect(page.getByText('服务暂时不可用，请稍后重试。', { exact: true })).toBeVisible();
  await expect(page.getByText('private failure')).not.toBeVisible();
  await page.getByRole('button', { name: '再试一次' }).click();
  await expect(page.getByRole('heading', { name: '这里还空着' })).toBeVisible();
  expect(attempts).toBe(3);
});
