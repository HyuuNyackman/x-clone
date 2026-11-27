# ADR-0009: CI の Claude は技術負債を GitHub Issue として切り、Linear の同期で取り込む

**Date**: 2026-11-23
**Status**: deprecated (ADR-0035)
**Deciders**: HyuuNyackman

## Context

作業中に見つけた、今回は直さない将来の技術負債は、黙って残さずタスクとして切る運用にした (`AGENTS.md` の「技術負債の扱い」)。
手元のセッションは Linear に直接 Issue を作れる。
CI で動く Claude (`claude.yml`) は Linear を操作する手段を持たない。`--allowedTools` は git と gh のコマンドだけで、MCP も設定していない。
GitHub Issue と Linear は双方向に同期されている。

## Decision

CI の Claude は、技術負債を GitHub Issue として作る (`gh issue create`)。Linear への取り込みは同期に任せる。
作る前に `gh issue list --state all --search` で重複を確認する。指示は `claude.yml` の `--append-system-prompt` の手順 (7) に書き、許可するコマンドは `gh issue list` と `gh issue create` を足すだけにする。
ラベルは付けず、整理は Linear 側で行う。
(変更: 人の判断や作業が要るものには、`needs-human` ラベルを付ける。`AGENTS.md` の「技術負債の扱い」を参照。)

## Alternatives Considered

### Alternative 1: PR 本文やレビューコメントに「技術負債」として書き、人が Linear に登録する

- **Pros**: CI に新しい権限が要らない。
- **Cons**: 登録を忘れると、PR を閉じたあとに負債が残らない。
- **Why not**: 同期が取れているため、GitHub Issue で自動的にタスクになるほうが漏れにくいため。

### Alternative 2: CI に Linear の MCP と API キーを渡し、Linear に直接作らせる

- **Pros**: プロジェクトやラベルを指定して作れる。Linear の Issue を直接検索できる。
- **Cons**: リポジトリが公開で、API キーの権限と漏えいの管理が増える。[ADR-0003](0003-claude-actions-guardrails.md) の方針を広げることになる。
- **Why not**: GitHub Issue と同期で足りるため。

## Consequences

### Positive

- CI の Claude が見つけた負債が、Linear のタスクとして残る。
- 追加する権限は `gh issue list` と `gh issue create` だけで、`issues: write` は既に持っている。
- 重複の確認は、同期された GitHub Issue に対して行える。

### Negative

- 手元のセッションと違い、プロジェクトやラベルを指定できない。Linear 側で整理する手間が出る。
- 同期の遅れや設定の変更で、取り込まれない可能性がある。

### Risks

- 同期の対象外の Issue は、重複の確認で見えない。重複した Issue ができたら Linear 側でまとめる。
- Issue の本文に `@claude` が入ると `claude.yml` が反応しうる。指示で禁止している。`GITHUB_TOKEN` で作った Issue は他のワークフローを起動しないが、実際の動作で確認する。
- 指示は CI の `--append-system-prompt` にだけ書いてあり、`AGENTS.md` を CI が読むかは確認できていない。指示を変えるときは `claude.yml` を直す。
