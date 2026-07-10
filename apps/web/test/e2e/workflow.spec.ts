import { expect, test } from '@playwright/test';

const apiBase = 'http://127.0.0.1:3001/api/v1';

test('user can create a project, finish workflow, inspect and download artifacts', async ({
  page,
  request,
}) => {
  let projectId = '';
  try {
    await page.goto('/projects/new');
    await page.getByLabel('项目名称').fill(`E2E 项目 ${Date.now()}`);
    await page.getByLabel('原始想法').fill('一个帮助团队把模糊想法转成软件规划的 Agent。');
    await page.getByRole('button', { name: '创建项目' }).click();

    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/);
    await expect(page.getByRole('button', { name: '启动工作流' })).toBeVisible();
    projectId = page.url().split('/').at(-1) ?? '';

    await page.getByRole('button', { name: '启动工作流' }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/workflow$`));
    await expect(page.getByRole('heading', { name: '规划流水线' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '需要你补充信息' })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByLabel('澄清回复').fill('主要用户是负责需求收敛的产品经理。');
    await page.getByRole('button', { name: '提交回复并继续' }).click();
    await expect(page.getByText('已完成').first()).toBeVisible({ timeout: 30_000 });

    await page.getByRole('link', { name: '产物' }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/artifacts$`));
    await expect(page.getByRole('heading', { name: '规划产物' })).toBeVisible();
    const prdLink = page.getByRole('link').filter({ hasText: 'PRD 产品需求文档' }).first();
    await expect(prdLink).toBeVisible();

    await prdLink.click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/artifacts/[0-9a-f-]+$`));
    await expect(page.getByRole('button', { name: '下载 Markdown' })).toBeVisible();
    await expect(page.locator('pre')).toContainText('mock');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '下载 Markdown' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('prd.md');

    await page.getByRole('link', { name: '返回列表' }).click();
    await page.getByRole('link', { name: '查看用量' }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/usage$`));
    await expect(page.getByRole('heading', { name: '模型用量' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '模型调用日志' })).toBeVisible();
    await expect(page.getByText('调用次数')).toBeVisible();
  } finally {
    if (projectId) {
      const cleanup = await request.delete(`${apiBase}/projects/${projectId}`);
      expect(cleanup.status()).toBe(204);
    }
  }
});
