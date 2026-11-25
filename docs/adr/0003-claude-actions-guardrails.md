# ADR-0003: Claude Code Actions の実行条件を絞る

**Date**: 2026-11-23
**Status**: accepted (自動レビューを実行するタイミングは [ADR-0016](0016-automated-pipeline-from-linear-to-merge.md) で変更)
**Deciders**: HyuuNyackman

## Context

Issue のコメントで `@claude` と呼ぶと、GitHub Actions で Claude が実装やレビューをする仕組みを入れた。リポジトリは公開なので、第三者に利用枠を使われないようにする必要がある。

## Decision

- **実行者**: `github.actor == github.repository_owner` のときだけ起動する。許可ユーザーを増やすときは `if:` を変える。
- **自動レビュー**: PR の `opened` / `ready_for_review` / `reopened` で実行する。`synchronize` は含めず、push のたびに利用枠を使わない。追加のレビューは `@claude` のコメントで頼む。fork からの PR とドラフトは対象外にする。
- **設定値**: モデルと最大ターン数は、リポジトリ変数 `CLAUDE_MODEL`(既定 `claude-sonnet-5-5`)と `CLAUDE_MAX_TURNS`(既定 30)で変える。
- **スキル**: `.claude/skills/` は `.gitignore` 対象なので、実行前に復元する。外部スキルは `microsoft/apm-action` の `apm install` で入れ、自作スキルはコミット済みの `.apm/skills/` をコピーして重ねる。
- **権限**: `contents` / `pull-requests` / `issues` は `write`、`actions` は `read`。

## Alternatives Considered

### Alternative 1: 書き込み権限を持つ全員に開放する

- **Pros**: 設定が単純。
- **Cons**: 公開リポジトリでは、利用枠の消費を制御しにくい。
- **Why not**: オーナー本人だけに絞るほうが安全。

### Alternative 2: 外部スキルを `.apm/skills/` にコピーして同梱する

- **Pros**: CI に APM が要らない。
- **Cons**: ライセンス表示の保守と、元の更新への追従を手作業で行う。
- **Why not**: APM の依存として宣言するほうが、更新を追いやすい。

## Consequences

### Positive

- 利用枠を、オーナー本人の操作だけが消費する。
- 外部スキルを、ローカルと CI で同じ定義から入れられる。

### Negative

- 実行者が増えると、`if:` の変更が必要になる。
- CI で `apm install` が増え、実行時間が少し延びる。

### Risks

- APM のバージョン差で、`apm install` が失敗することがある。その場合は `apm-version` を固定するか、ローカルで `apm install` をやり直して `apm.lock.yaml` を更新する。
