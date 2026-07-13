import { expect, test } from '@playwright/test';

const apiBase = 'http://127.0.0.1:3001/api/v1';

test('user can create a project, finish workflow, inspect and download artifacts', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  let projectId = '';
  try {
    await page.goto('/projects/new', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: '说说你想做什么' })).toBeVisible();
    await page.getByLabel('给这个想法起个名字').fill(`E2E 项目 ${Date.now()}`);
    await page.getByLabel('先随便说说').fill('一个帮助团队把模糊想法转成软件规划的 Agent。');
    await page.getByRole('button', { name: '把它放进项目里' }).click();

    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/);
    await expect(page.getByRole('button', { name: '开始把它想清楚' })).toBeVisible();
    projectId = page.url().split('/').at(-1) ?? '';

    await page.getByRole('button', { name: '开始把它想清楚' }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/workflow$`));
    await expect(page.getByRole('heading', { name: '项目进展' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '把不清楚的地方聊明白' })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByLabel('你的回复').fill('首版服务上海，主要用户是负责需求收敛的产品经理。');
    await page.getByRole('button', { name: '发出回复' }).click();
    await expect(
      page.locator('aside article').filter({ hasText: /最想用哪个数字判断/ }),
    ).toBeVisible({ timeout: 30_000 });

    await page.getByLabel('你的回复').fill('以 40% 的用户采用推荐方案作为首版成功标准。');
    await page.getByRole('button', { name: '发出回复' }).click();
    await expect(page.getByRole('button', { name: '确认，继续下一环节' })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByLabel('你的回复').fill('首版先保证规划结果可执行，协作功能以后再做。');
    await page.getByRole('button', { name: '继续讨论' }).click();
    await expect(page.getByText(/反馈.*带入后续规划/)).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: '确认，继续下一环节' }).click();
    await expect(page.locator('aside').getByText('需求综合', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: '确认，继续下一环节' }).click();
    await expect(page.locator('aside').getByText('MVP压缩', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: '确认，继续下一环节' }).click();
    await expect(page.locator('aside').getByText('平台推荐', { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: '确认，继续下一环节' }).click();
    await expect(page.locator('aside').getByText('已完成', { exact: true }).first()).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole('link', { name: '产物' }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/artifacts$`));
    await expect(page.getByRole('heading', { name: '已经整理好的内容' })).toBeVisible();
    const artifactLinks = page.locator(`a[href^="/projects/${projectId}/artifacts/"]`);
    await expect(artifactLinks).toHaveCount(11);
    const prdLink = artifactLinks.filter({ hasText: 'PRD' }).first();
    await expect(prdLink).toBeVisible();

    await prdLink.click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/artifacts/[0-9a-f-]+$`));
    await expect(page.getByRole('button', { name: '下载这份内容' })).toBeVisible();
    await expect(page.locator('pre')).toContainText('本地演示模式生成');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '下载这份内容' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('prd.md');

    await page.getByRole('link', { name: '回到全部内容' }).click();
    await page.getByRole('link', { name: '看看这次花了多少' }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/usage$`));
    await expect(page.getByRole('heading', { name: '调用与成本' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '每一次调用' })).toBeVisible();
    await expect(page.getByText('问过几次')).toBeVisible();
  } finally {
    if (projectId) {
      const cleanup = await request.delete(`${apiBase}/projects/${projectId}`);
      expect(cleanup.status()).toBe(204);
    }
  }
});
