import { expect, test, type Browser, type Request } from '@playwright/test';

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

test('いいねと取り消しが即時に反映され、二重にならない', async ({ page }) => {
  await signUpOnly(page, uniqueEmail());
  await setupProfile(page, uniqueHandle(), 'Eve');

  const text = `e2e いいね ${Date.now()}`;
  await page.getByRole('button', { name: '投稿を作成' }).click();
  await page.getByLabel('本文').fill(text);
  await page.getByRole('button', { name: '投稿する' }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText(text)).toBeVisible();

  // いいね: 押すと即時に「済み・1」になる
  await page.getByRole('button', { name: 'いいね', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'いいねを取り消す' }).first()).toHaveText('♥ 1');

  // 再読み込みしても残っている (DB に 1 件だけ保存されている)
  await page.reload();
  await expect(page.getByText(text)).toBeVisible();
  await expect(page.getByRole('button', { name: 'いいねを取り消す' }).first()).toHaveText('♥ 1');

  // 取り消し: 押すと即時に「未・0」に戻る
  await page.getByRole('button', { name: 'いいねを取り消す' }).first().click();
  await expect(page.getByRole('button', { name: 'いいね', exact: true }).first()).toHaveText('♡ 0');

  await page.reload();
  await expect(page.getByText(text)).toBeVisible();
  await expect(page.getByRole('button', { name: 'いいね', exact: true }).first()).toHaveText('♡ 0');
});

// ユーザーを作ってホームに入り、本文を 1 件投稿する。投稿者ごとに別のブラウザーコンテキストを使う。
async function newUserWithPost(browser: Browser, name: string, handle: string, text: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signUpOnly(page, uniqueEmail());
  await setupProfile(page, handle, name);
  await page.getByRole('button', { name: '投稿を作成' }).click();
  await page.getByLabel('本文').fill(text);
  await page.getByRole('button', { name: '投稿する' }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText(text)).toBeVisible();
  return { context, page };
}

test('フォローすると「フォロー中」タブにその人の投稿だけが出て、解除すると消える', async ({
  browser,
  page,
}) => {
  const tag = Date.now();
  const bobHandle = uniqueHandle();
  const carolHandle = uniqueHandle();
  const bobText = `e2e bob ${tag}`;
  const carolText = `e2e carol ${tag}`;
  const bob = await newUserWithPost(browser, 'Bob', bobHandle, bobText);
  const carol = await newUserWithPost(browser, 'Carol', carolHandle, carolText);

  await signUpOnly(page, uniqueEmail());
  await setupProfile(page, uniqueHandle(), 'Alice');

  // おすすめ (全体) には、2 人とも出る。
  await expect(page.getByText(bobText)).toBeVisible();
  await expect(page.getByText(carolText)).toBeVisible();

  // まだ誰もフォローしていないので、フォロー中タブには出ない。
  await page.getByRole('tab', { name: 'フォロー中' }).click();
  await expect(page.getByText('フォロー中の人の投稿はまだありません')).toBeVisible();
  await expect(page.getByText(bobText)).toHaveCount(0);

  // Bob をフォローする (おすすめタブのカードから)。
  await page.getByRole('tab', { name: 'おすすめ' }).click();
  await page.getByRole('button', { name: `@${bobHandle} をフォロー`, exact: true }).click();
  await expect(
    page.getByRole('button', { name: `@${bobHandle} のフォローを解除`, exact: true }),
  ).toBeVisible();

  // フォロー中タブには Bob の投稿だけが出る (Carol は出ない)。
  await page.getByRole('tab', { name: 'フォロー中' }).click();
  await expect(page.getByText(bobText)).toBeVisible();
  await expect(page.getByText(carolText)).toHaveCount(0);

  // 再読み込みしても、フォロー状態は残る (DB に保存されている)。
  await page.reload();
  await page.getByRole('tab', { name: 'フォロー中' }).click();
  await expect(page.getByText(bobText)).toBeVisible();
  await expect(page.getByText(carolText)).toHaveCount(0);

  // 解除すると、フォロー中タブから消える。
  await page.getByRole('button', { name: `@${bobHandle} のフォローを解除`, exact: true }).click();
  await expect(page.getByText(bobText)).toHaveCount(0);
  await expect(page.getByText('フォロー中の人の投稿はまだありません')).toBeVisible();

  // おすすめには、引き続き出る。
  await page.getByRole('tab', { name: 'おすすめ' }).click();
  await expect(page.getByText(bobText)).toBeVisible();
  await expect(
    page.getByRole('button', { name: `@${bobHandle} をフォロー`, exact: true }),
  ).toBeVisible();

  await bob.context.close();
  await carol.context.close();
});

// 1x1 の PNG。端末側で JPEG に変換されてアップロードされる。
// Playwright の setFiles は Node の Buffer を要求する (型定義は未導入なので最小限を宣言)。
declare const Buffer: { from(data: string, encoding: 'base64'): never };
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

test('画像付きで投稿すると、タイムラインに画像が出る', async ({ page }) => {
  await signUpOnly(page, uniqueEmail());
  await setupProfile(page, uniqueHandle(), 'Carol');

  await page.getByRole('button', { name: '投稿を作成' }).click();
  await page.getByLabel('本文').fill(`e2e 画像 ${Date.now()}`);

  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '画像を追加' }).click();
  await (await chooser).setFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG_1X1 });
  await expect(page.getByRole('button', { name: '画像1を外す' })).toBeVisible();

  await page.getByRole('button', { name: '投稿する' }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.reload();
  await expect(page.getByLabel('投稿の画像').first()).toBeVisible();
});
