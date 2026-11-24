import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'e2e-password-123';

// テストごとに別のユーザーを作る。ローカルの Supabase は使い捨てなので、後始末はしない。
export function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

// handle は 3〜15 文字の小文字英数字とアンダースコア。
export function uniqueHandle() {
  return `e2e_${Math.random().toString(36).slice(2, 10)}`;
}

// サインアップだけ行う。初回はプロフィール設定画面に移る。
export async function signUpOnly(page: Page, email: string) {
  await page.goto('/signup');
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード (8文字以上)').fill(PASSWORD);
  await page.getByLabel('パスワード (確認)').fill(PASSWORD);
  await page.getByRole('button', { name: '登録する' }).click();
}

// プロフィール設定画面で handle と表示名を決めて、ホームに入る。
export async function setupProfile(page: Page, handle: string, displayName: string) {
  await expect(page).toHaveURL(/\/profile-setup$/);
  await page.getByLabel('ハンドル').fill(handle);
  await page.getByLabel('表示名').fill(displayName);
  await page.getByRole('button', { name: 'はじめる' }).click();
  await expect(page).toHaveURL(/\/home$/);
}
