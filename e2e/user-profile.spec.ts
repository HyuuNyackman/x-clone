import { expect, test } from '@playwright/test';

import { setupProfile, signUpOnly, uniqueEmail, uniqueHandle } from './helpers';

test('他ユーザーのプロフィールが見え、フォロー・解除でフォロワー数が変わる', async ({
  browser,
  page,
}) => {
  const bobHandle = uniqueHandle();
  const bobText = `e2e profile ${Date.now()}`;
  const bobContext = await browser.newContext();
  const bob = await bobContext.newPage();
  await signUpOnly(bob, uniqueEmail());
  await setupProfile(bob, bobHandle, 'Bob');
  await bob.getByRole('button', { name: '投稿を作成' }).click();
  await bob.getByLabel('本文').fill(bobText);
  await bob.getByRole('button', { name: '投稿する' }).click();
  // 作成画面の textarea (値が本文と一致) を除くため、div のテキストに絞る。
  await expect(bob.getByText(bobText).and(bob.locator('div'))).toBeVisible();

  await signUpOnly(page, uniqueEmail());
  await setupProfile(page, uniqueHandle(), 'Alice');

  // ホームの投稿者名から、プロフィールを開く。
  await page.getByLabel(`@${bobHandle} のプロフィールを開く`).first().click();
  await expect(page).toHaveURL(new RegExp(`/user/${bobHandle}$`));
  await expect(page.getByText('Bob', { exact: true })).toBeVisible();
  await expect(page.getByText(bobText).and(page.locator('div:visible'))).toBeVisible();
  await expect(page.getByLabel('フォロワー数')).toContainText('0');
  await expect(page.getByRole('button', { name: 'プロフィールを編集' })).toHaveCount(0);

  // フォローすると、フォロワー数が 1 になり、再読み込みしても残る。
  await page.getByRole('button', { name: 'フォロー', exact: true }).click();
  await expect(page.getByRole('button', { name: 'フォロー中', exact: true })).toBeVisible();
  await expect(page.getByLabel('フォロワー数')).toContainText('1');
  await page.reload();
  await expect(page.getByRole('button', { name: 'フォロー中', exact: true })).toBeVisible();
  await expect(page.getByLabel('フォロワー数')).toContainText('1');

  // 解除すると 0 に戻る。
  await page.getByRole('button', { name: 'フォロー中', exact: true }).click();
  await expect(page.getByRole('button', { name: 'フォロー', exact: true })).toBeVisible();
  await expect(page.getByLabel('フォロワー数')).toContainText('0');
  await bobContext.close();
});

test('自分の handle はプロフィールのタブに移り、存在しない handle は見つからないと出る', async ({
  page,
}) => {
  const handle = uniqueHandle();
  await signUpOnly(page, uniqueEmail());
  await setupProfile(page, handle, 'Alice');

  await page.goto(`/user/${handle}`);
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole('button', { name: 'フォロー', exact: true })).toHaveCount(0);

  await page.goto('/user/no_such_user_zz');
  await expect(page.getByText('ユーザーが見つかりません')).toBeVisible();
});
