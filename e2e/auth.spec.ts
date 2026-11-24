import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'e2e-password-123';

// テストごとに別のユーザーを作る。ローカルの Supabase は使い捨てなので、後始末はしない。
function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function signUp(page: Page, email: string) {
  await page.goto('/signup');
  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード (8文字以上)').fill(PASSWORD);
  await page.getByLabel('パスワード (確認)').fill(PASSWORD);
  await page.getByRole('button', { name: '登録する' }).click();
}

async function signOut(page: Page) {
  await page.getByRole('tab', { name: '設定' }).click();
  await page.getByRole('button', { name: 'ログアウト' }).click();
}

test('未ログインで開くと、ログイン画面に移る', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'ログイン' })).toBeVisible();
});

test('サインアップすると、ホームに入れて、ローカルの Supabase に接続できている', async ({
  page,
}) => {
  await signUp(page, uniqueEmail());
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText('Supabase: 接続OK')).toBeVisible();
});

test('ログアウトすると、ログイン画面に戻る', async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await expect(page).toHaveURL(/\/home$/);

  await page.getByRole('tab', { name: '設定' }).click();
  await expect(page.getByText(`ログイン中: ${email}`)).toBeVisible();
  await page.getByRole('button', { name: 'ログアウト' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('作ったアカウントで、ログインし直せる', async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await expect(page).toHaveURL(/\/home$/);
  await signOut(page);
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'ログイン' }).click();
  await expect(page).toHaveURL(/\/home$/);
});

test('ログイン済みなら、再読み込みしてもログインが保たれる', async ({ page }) => {
  await signUp(page, uniqueEmail());
  await expect(page).toHaveURL(/\/home$/);
  await page.reload();
  await expect(page).toHaveURL(/\/home$/);
});

test('パスワードが違うと、ログインできずエラーが出る', async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await expect(page).toHaveURL(/\/home$/);
  await signOut(page);

  await page.getByLabel('メールアドレス').fill(email);
  await page.getByLabel('パスワード', { exact: true }).fill('wrong-password-999');
  await page.getByRole('button', { name: 'ログイン' }).click();
  await expect(page.getByText(/Invalid login credentials/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test('サインアップで、パスワードが一致しないとエラーが出る', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('メールアドレス').fill(uniqueEmail());
  await page.getByLabel('パスワード (8文字以上)').fill(PASSWORD);
  await page.getByLabel('パスワード (確認)').fill('different-password');
  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page.getByText('パスワードが一致しません')).toBeVisible();
  await expect(page).toHaveURL(/\/signup$/);
});
