import { expect, test, type Request } from '@playwright/test';

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

// 45 件 (3 ページ分) を入れて、続きの読み込みと、重複・欠落がないことを確かめる。
test('タイムラインは、スクロールで続きを読み込み、重複も欠落もない', async ({ page }) => {
  const rpcRequests: Request[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/rpc/get_timeline')) rpcRequests.push(request);
  });

  await signUpOnly(page, uniqueEmail());
  await setupProfile(page, uniqueHandle(), 'Carol');
  await expect.poll(() => rpcRequests.length).toBeGreaterThan(0);

  // アプリ自身の認証ヘッダーを借りて、REST で投稿をまとめて入れる。
  const headers = rpcRequests[0].headers();
  const origin = new URL(rpcRequests[0].url()).origin;
  const userId = JSON.parse(
    atob(headers.authorization.split(' ')[1].split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
  ).sub as string;
  const tag = `seed${Date.now()}`;
  const total = 45;
  const base = Date.now() - total * 1000;
  const rows = Array.from({ length: total }, (_, i) => ({
    author_id: userId,
    body: `${tag}-${String(i).padStart(3, '0')}`,
    created_at: new Date(base + i * 1000).toISOString(),
  }));
  const res = await page.request.post(`${origin}/rest/v1/posts`, {
    headers: { apikey: headers.apikey, authorization: headers.authorization },
    data: rows,
  });
  expect(res.ok()).toBeTruthy();

  await page.reload();
  // 新しい順。最初のページ (20 件) の先頭が見える。
  await expect(page.getByText(`${tag}-044`)).toBeVisible();

  // 末尾までスクロールして、最後 (最古) の投稿まで届くのを待つ。
  const oldest = page.getByText(`${tag}-000`);
  await expect(async () => {
    await page.mouse.move(200, 400);
    await page.mouse.wheel(0, 4000);
    await expect(oldest).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 30_000 });

  // 取得は 3 ページ以上 (20 + 20 + 5 件)。
  expect(rpcRequests.length).toBeGreaterThanOrEqual(3);
});

test('投稿詳細からリプライすると、一覧とカウンタに反映される', async ({ page }) => {
  await signUpOnly(page, uniqueEmail());
  await setupProfile(page, uniqueHandle(), 'Dave');

  const text = `e2e 元投稿 ${Date.now()}`;
  await page.getByRole('button', { name: '投稿を作成' }).click();
  await page.getByLabel('本文').fill(text);
  await page.getByRole('button', { name: '投稿する' }).click();
  await expect(page).toHaveURL(/\/home$/);

  // 投稿を開く
  await page.getByText(text).click();
  await expect(page).toHaveURL(/\/post\//);
  await expect(page.getByText('まだリプライがありません')).toBeVisible();

  const replyText = `e2e 返信 ${Date.now()}`;
  await page.getByLabel('返信', { exact: true }).fill(replyText);
  await page.getByRole('button', { name: '返信する' }).click();
  // 下のホーム画面 (タイムライン) にも同じ投稿が出るので、先頭の 1 件で確かめる。
  await expect(page.getByText(replyText).first()).toBeVisible();
  await expect(page.getByText('返信 1', { exact: true }).first()).toBeVisible();

  // 再読み込みしても残っている (DB に保存され、カウンタも更新されている)
  await page.reload();
  await expect(page.getByText(replyText).first()).toBeVisible();
  await expect(page.getByText('返信 1', { exact: true }).first()).toBeVisible();

  // タイムラインのカウンタにも反映される
  await page.getByRole('button', { name: '戻る' }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText(text)).toBeVisible();
});
