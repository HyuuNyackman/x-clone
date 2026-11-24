// develop → main のリリース PR に載せる、確認事項の要約を作る (ADR-0015、XCL-94)。
//
//   node scripts/ci/release-summary.mjs <base> <head>   Markdown を標準出力に出す
//
// 人が見るべき点を、変更されたファイルの種類から機械的に選ぶ。文章の要約はしない
// (毎回同じ基準で、ローカルでテストでき、利用枠も使わないため)。
import { execFileSync } from 'node:child_process';

const [base, head] = process.argv.slice(2);
if (!base || !head) {
  console.error('使い方: release-summary.mjs <base> <head>');
  process.exit(1);
}

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// ===== 変更の取得 =====

// base に無く head にある、コミットの件名。
const subjects = git('log', '--format=%s', `${base}..${head}`).split('\n').filter(Boolean);

// 共通の祖先からの変更ファイル (A: 追加, M: 変更, D: 削除, R: 名前変更)。
const changes = git('diff', '--name-status', '--no-renames', `${base}...${head}`)
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [status, ...rest] = line.split('\t');
    return { status, path: rest.join('\t') };
  });

const paths = (predicate) => changes.filter((c) => predicate(c.path));

// ===== 含まれる Issue =====

const issues = new Map();
for (const subject of subjects) {
  const key = subject.match(/\b(?:XCL|xcl)-(\d+)\b/);
  if (!key) continue;
  const id = `XCL-${key[1]}`;
  const pr = subject.match(/\(#(\d+)\)\s*$/)?.[1];
  const title = subject
    .replace(/^\[[^\]]+\]\s*/, '') // [xcl-12] を除く
    .replace(/^(?:XCL|xcl)-\d+\s*/, '') // XCL-12 を除く
    .replace(/^(?:feat|fix|docs|style|refactor|perf|test|build|ci|chore):\s*/, '')
    .replace(/\s*\(#\d+\)\s*$/, '');
  if (!issues.has(id)) issues.set(id, { title, prs: [] });
  if (pr) issues.get(id).prs.push(pr);
}

// ===== マイグレーション =====

const migrations = paths((p) => /^supabase\/migrations\/.+\.sql$/.test(p));
const addedMigrations = migrations.filter((c) => c.status === 'A');
const touchedExisting = migrations.filter((c) => c.status !== 'A');

// 破壊的、または、データに依存して失敗しうる SQL。コメントを除いた行を見る。
const RISKY = [
  [
    /\bdrop\s+(table|column|schema|policy|function|trigger|index|view|type|constraint)\b/i,
    '削除 (drop)',
  ],
  [/\btruncate\b/i, 'truncate'],
  [/\bdelete\s+from\b/i, 'delete'],
  [/\balter\s+table\b[^;]*\balter\s+column\b[^;]*\btype\b/i, '列の型の変更'],
  [/\brename\s+(to|column)\b/i, '名前の変更 (rename)'],
  [/\bset\s+not\s+null\b/i, 'not null の追加 (既存の行が違反すると失敗する)'],
  [/\badd\s+constraint\b/i, '制約の追加 (既存の行が違反すると失敗する)'],
  [/\bdisable\s+row\s+level\s+security\b/i, 'RLS の無効化'],
  [
    /\bgrant\s+(all|insert|update|delete|truncate)\b[^;]*\bto\b[^;]*\b(anon|public)\b/i,
    'anon / public への書き込み系の権限の付与',
  ],
];

const warnings = [];
for (const { path } of addedMigrations) {
  const sql = git('show', `${head}:${path}`)
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  for (const [pattern, label] of RISKY) {
    if (pattern.test(sql)) warnings.push(`\`${path}\`: ${label}`);
  }
}

// ===== その他の領域 =====

const workflows = paths((p) => p.startsWith('.github/'));
const deps = paths((p) => p === 'package.json' || p === 'pnpm-lock.yaml');
const configs = paths((p) =>
  ['supabase/config.toml', 'wrangler.jsonc', 'app.json', 'eas.json'].includes(p),
);
const authAndRls = paths(
  (p) =>
    p.startsWith('src/features/auth/') ||
    p.startsWith('src/app/(auth)/') ||
    /^supabase\/tests\//.test(p) ||
    /(rls|policy|policies)/i.test(p),
);

const depLines = deps.some((c) => c.path === 'package.json')
  ? git('diff', '--no-color', '-U0', `${base}...${head}`, '--', 'package.json')
      .split('\n')
      .filter((l) => /^[+-]\s+"[^"]+":/.test(l))
      .slice(0, 30)
  : [];

// ===== 出力 =====

const list = (items) => items.map((c) => `\`${c.path}\``).join('、');
const lines = [];
const out = (line = '') => lines.push(line);

out('## リリースの確認事項');
out();
out(`${subjects.length} 件のコミット、${changes.length} 個のファイルの変更を、本番に反映する。`);
out();

out('### 含まれる Issue');
out();
if (issues.size === 0) {
  out('- (件名から Issue を読み取れたものはなし)');
} else {
  for (const [id, { title, prs }] of issues) {
    const refs = prs.length ? ` (${prs.map((n) => `#${n}`).join(', ')})` : '';
    out(`- ${id} ${title}${refs}`);
  }
}
out();

if (warnings.length > 0) {
  out('### ⚠️ 破壊的、またはデータに依存して失敗しうる SQL');
  out();
  for (const w of warnings) out(`- ${w}`);
  out();
  out('マージすると、本番の DB に適用される。内容を読んでから、バックアップを取ること。');
  out();
}

out('### 確認すること');
out();
const checks = [];
if (addedMigrations.length > 0) {
  checks.push(
    `**マイグレーション (${addedMigrations.length} 件)**: ${list(addedMigrations)}。\`supabase / dry-run\` の結果を見て、本番の DB のバックアップを取ってから、マージする。`,
  );
}
if (touchedExisting.length > 0) {
  checks.push(
    `**⚠️ 既存のマイグレーションが変更・削除されている**: ${list(touchedExisting)}。適用済みの履歴は変えてはいけない。意図したものか確かめる。`,
  );
}
if (authAndRls.length > 0) {
  checks.push(
    `**認証・RLS に関わる変更**: ${list(authAndRls)}。Preview で、確認用のアカウントを使って、ログインとアクセス制御を試す。`,
  );
}
if (deps.length > 0) {
  checks.push(
    `**依存・スクリプトの変更**: ${list(deps)}。` +
      (depLines.length
        ? `\n  \`\`\`diff\n${depLines.map((l) => `  ${l}`).join('\n')}\n  \`\`\``
        : ''),
  );
}
if (workflows.length > 0) {
  checks.push(`**CI・ワークフローの変更**: ${list(workflows)}。意図したものか確かめる。`);
}
if (configs.length > 0) {
  checks.push(`**設定ファイルの変更**: ${list(configs)}。本番の設定との差がないか確かめる。`);
}
if (checks.length === 0) {
  checks.push('特に注意が必要な領域の変更はない。Preview で、画面の動作を確かめる。');
}
for (const c of checks) out(`- [ ] ${c}`);
out('- [ ] 統合後の状態を、Preview で確かめた (URL は、この PR のコメントの Preview を参照)');
out('- [ ] E2E (`e2e / e2e`) と pgTAP (`db-test / db-test`) のチェックが通っている');
out();

out('### 確認用アカウント');
out();
out(
  'Preview は本番の Supabase に繋がる。確認は、確認用のアカウントだけで行い、作ったデータは、確認用だと分かる名前にして、後で手動で消す ([ADR-0015](docs/adr/0015-production-deploy-only-from-main.md))。',
);

console.log(lines.join('\n'));
