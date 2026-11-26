import { expect, test } from '@playwright/test';

import { setupProfile, signUpOnly, uniqueEmail, uniqueHandle } from './helpers';

test('キーワードを入力すると、投稿とユーザーが検索できる', async ({ page }) => {
  const handle = uniqueHandle();
  const keyword = `srch${Date.now()}`;
  await signUpOnly(page, uniqueEmail());
  await setupProfile(page, handle, `Searcher ${keyword}`);

  await page.getByRole('button', { name: '投稿を作成' }).click();
  await page.getByLabel('本文').fill(`検索テスト ${keyword}`);
  await page.getByRole('button', { name: '投稿する' }).click();
  await expect(page.getByText(`検索テスト ${keyword}`).and(page.locator('div'))).toBeVisible();

  await page.goto('/search');
  await page.getByLabel('検索キーワード').fill(keyword);

  // デバウンスのあと、投稿タブに結果が出る。
  await expect(
    page.getByText(`検索テスト ${keyword}`).and(page.locator('div:visible')),
  ).toBeVisible();

  // ユーザータブに切り替えると、表示名で見つかる。
  await page.getByRole('tab', { name: 'ユーザー' }).click();
  await expect(page.getByLabel(`@${handle} のプロフィールを開く`)).toBeVisible();

  // 該当なしのキーワード。
  await page.getByLabel('検索キーワード').fill(`none${keyword}`);
  await expect(page.getByText('見つかりませんでした')).toBeVisible();
});
