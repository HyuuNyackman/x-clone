import { expect, test } from '@playwright/test';

import { setupProfile, signUpOnly, uniqueEmail, uniqueHandle } from './helpers';

test('投稿するとタイムラインに出て、削除すると消える', async ({ page }) => {
  await signUpOnly(page, uniqueEmail());
  await setupProfile(page, uniqueHandle(), 'Alice');

  const text = `e2e 投稿 ${Date.now()}`;
  await page.getByRole('button', { name: '投稿を作成' }).click();
  await expect(page).toHaveURL(/\/compose$/);
  await expect(page.getByLabel('残り文字数')).toHaveText('280');
  await page.getByLabel('本文').fill(text);
  await expect(page.getByLabel('残り文字数')).toHaveText(String(280 - text.length));
  await page.getByRole('button', { name: '投稿する' }).click();

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText(text)).toBeVisible();

  // 再読み込みしても残っている (DB に保存されている)
  await page.reload();
  await expect(page.getByText(text)).toBeVisible();

  await page.getByRole('button', { name: '投稿を削除' }).first().click();
  await expect(page.getByText(text)).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(text)).toHaveCount(0);
});

test('281文字以上は、投稿ボタンが押せない', async ({ page }) => {
  await signUpOnly(page, uniqueEmail());
  await setupProfile(page, uniqueHandle(), 'Bob');
  await page.getByRole('button', { name: '投稿を作成' }).click();
  await page.getByLabel('本文').fill('a'.repeat(281));
  await expect(page.getByLabel('残り文字数')).toHaveText('-1');
  await expect(page.getByRole('button', { name: '投稿する' })).toBeDisabled();
});
