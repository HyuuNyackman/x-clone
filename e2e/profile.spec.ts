import { expect, test } from '@playwright/test';

import { setupProfile, signUpOnly, uniqueEmail, uniqueHandle } from './helpers';

test('サインアップ直後は、プロフィール設定画面に移る', async ({ page }) => {
  await signUpOnly(page, uniqueEmail());
  await expect(page).toHaveURL(/\/profile-setup$/);
  await expect(page.getByText('プロフィールを設定')).toBeVisible();
});

test('設定を済ませる前に、ホームのURLを開いても、設定画面に戻される', async ({ page }) => {
  await signUpOnly(page, uniqueEmail());
  await expect(page).toHaveURL(/\/profile-setup$/);
  await page.goto('/home');
  await expect(page).toHaveURL(/\/profile-setup$/);
});

test('handle の形式が正しくないと、エラーが出て進めない', async ({ page }) => {
  await signUpOnly(page, uniqueEmail());
  await expect(page).toHaveURL(/\/profile-setup$/);
  await page.getByLabel('ハンドル').fill('Bad-Handle');
  await page.getByLabel('表示名').fill('Alice');
  await page.getByRole('button', { name: 'はじめる' }).click();
  await expect(page.getByText(/ハンドルは半角の小文字英数字/)).toBeVisible();
  await expect(page).toHaveURL(/\/profile-setup$/);
});

test('設定した内容が DB に保存され、再読み込みしても保たれる', async ({ page }) => {
  const handle = uniqueHandle();
  await signUpOnly(page, uniqueEmail());
  await setupProfile(page, handle, 'Alice');

  await page.getByRole('tab', { name: 'プロフィール' }).click();
  await expect(page.getByLabel('ハンドル')).toHaveValue(handle);
  await expect(page.getByLabel('表示名')).toHaveValue('Alice');

  await page.getByLabel('表示名').fill('Alice Edited');
  await page.getByLabel('自己紹介').fill('こんにちは');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByText('保存しました')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('ハンドル')).toHaveValue(handle);
  await expect(page.getByLabel('表示名')).toHaveValue('Alice Edited');
  await expect(page.getByLabel('自己紹介')).toHaveValue('こんにちは');
});

test('他の人と同じ handle にすると、重複のエラーが出る', async ({ page }) => {
  const taken = uniqueHandle();
  await signUpOnly(page, uniqueEmail());
  await setupProfile(page, taken, 'First');

  await page.getByRole('tab', { name: '設定' }).click();
  await page.getByRole('button', { name: 'ログアウト' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await signUpOnly(page, uniqueEmail());
  await expect(page).toHaveURL(/\/profile-setup$/);
  await page.getByLabel('ハンドル').fill(taken);
  await page.getByLabel('表示名').fill('Second');
  await page.getByRole('button', { name: 'はじめる' }).click();
  await expect(page.getByText('このハンドルは既に使われています')).toBeVisible();
  await expect(page).toHaveURL(/\/profile-setup$/);
});
