// Claude のレビューの結果を、PR のコメントから判定する (ADR-0016)。
//
//   node scripts/ci/judge-review.mjs <開始時刻 (ISO 8601, UTC)> < コメントの JSON (gh api の issues/N/comments)
//
// 判定:
//   成功 (exit 0): この実行の開始以降に、claude が投稿・更新した「## Code review」で始まるコメントのうち、
//                  最新のものに「No issues found」が含まれる。
//   失敗 (exit 1): 上記のコメントが見つからない、または「No issues found」を含まない (指摘がある)。
// コメントが見つからないときも失敗にする (レビューが走っていないのに、通ってしまうのを防ぐ)。
import { readFileSync } from 'node:fs';

const startedAt = process.argv[2];
if (!startedAt) {
  console.error('::error::開始時刻を渡してください');
  process.exit(1);
}

const comments = JSON.parse(readFileSync(0, 'utf8'));
const started = Date.parse(startedAt);

const latest = comments
  .filter((c) => /^claude/.test(c.user?.login ?? ''))
  .filter((c) => (c.body ?? '').startsWith('## Code review'))
  .filter((c) => Date.parse(c.updated_at) >= started)
  .sort((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at))
  .at(-1);

if (!latest) {
  console.error(
    '::error::このレビューの実行で、コメントが投稿されませんでした。' +
      ' AGENTS.md、CLAUDE.md、.claude/ などの機微なパスを変更する PR は、claude-code-action がレビューを実行しません (仕様)。' +
      ' その場合は、人が内容を確認してマージしてください。それ以外のときは、ワークフローを再実行してください。',
  );
  process.exit(1);
}

if (latest.body.includes('No issues found')) {
  console.log('レビューの指摘はありません');
  process.exit(0);
}

console.error('::error::レビューに指摘があります。PR のコメントを確認してください');
console.error(latest.body.split('\n').slice(0, 40).join('\n'));
process.exit(1);
