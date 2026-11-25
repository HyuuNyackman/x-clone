// E2E がローカルの Supabase だけに繋がることを確かめるガード。
// 失敗すると、本番にサインアップやログインをしてしまう (Web ビルドは接続先を埋め込むため)。
//
//   node scripts/e2e/check-local-target.mjs env   ビルド前: 渡された接続先がローカルか
//   node scripts/e2e/check-local-target.mjs dist  ビルド後: 成果物に、ローカル以外の Supabase が無いか
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const LOCAL_URL = /^http:\/\/(127\.0\.0\.1|localhost):[0-9]+$/;
// ホスティング版の Supabase の URL。成果物に 1 つでもあれば、本番に繋がり得る。
const HOSTED_URL = /https:\/\/[a-z0-9-]+\.supabase\.(co|in|red)/g;

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

const mode = process.argv[2];
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

if (mode === 'env') {
  if (!LOCAL_URL.test(url)) {
    fail(`E2E の接続先がローカルではありません: ${url || '(未設定)'}`);
  }
  if (!process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    fail('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY が空です');
  }
  console.log(`接続先はローカルです: ${url}`);
} else if (mode === 'dist') {
  const dir = process.argv[3] ?? 'dist';
  let foundLocal = false;
  for (const file of walk(dir)) {
    if (!/\.(js|html|json|map)$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    const hosted = text.match(HOSTED_URL);
    if (hosted) fail(`成果物にホスティング版の Supabase の URL があります: ${file} (${hosted[0]})`);
    if (url && text.includes(url)) foundLocal = true;
  }
  if (!foundLocal) fail('成果物にローカルの接続先が埋め込まれていません (ビルドの環境変数を確認)');
  console.log('成果物の接続先はローカルだけです');
} else {
  fail('使い方: check-local-target.mjs env | dist [dir]');
}
