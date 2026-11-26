import { expect, test } from '@playwright/test';

import { setupProfile, signUpOnly, uniqueEmail, uniqueHandle } from './helpers';

test('ブックマークの追加・解除ができ、一覧には自分のブックマークだけが出る', async ({
  browser,
  page,
}) => {
  const text = `e2e ブックマーク ${Date.now()}`;
  await signUpOnly(page, uniqueEmail());
  await setupProfile(page, uniqueHandle(), 'Mark');
  await page.getByRole('button', { name: '投稿を作成' }).click();
  await page.getByLabel('本文').fill(text);
  await page.getByRole('button', { name: '投稿する' }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText(text)).toBeVisible();

  // 追加: 押すと即時に「解除」に変わり、再読み込みしても残る
  await page.getByRole('button', { name: 'ブックマーク', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'ブックマークを解除' }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(text)).toBeVisible();
  await expect(page.getByRole('button', { name: 'ブックマークを解除' }).first()).toBeVisible();

  // 一覧に出る
  await page.goto('/bookmarks');
  await expect(page.getByText(text)).toBeVisible();

  // 別のユーザーの一覧には出ない
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signUpOnly(otherPage, uniqueEmail());
  await setupProfile(otherPage, uniqueHandle(), 'Other');
  await otherPage.goto('/bookmarks');
  await expect(otherPage.getByText('ブックマークはまだありません')).toBeVisible();
  await expect(otherPage.getByText(text)).toHaveCount(0);
  await other.close();

  // 解除: 一覧から消える
  await page.getByRole('button', { name: 'ブックマークを解除' }).first().click();
  await expect(page.getByText('ブックマークはまだありません')).toBeVisible();
  await expect(page.getByText(text)).toHaveCount(0);
});
