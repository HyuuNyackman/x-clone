# ADR-0035: エージェントの作業を Orca に移し、Actions には検査とマージだけを残す

**Date**: 2026-11-27
**Status**: accepted
**Deciders**: HyuuNyackman

## Context

Issue からの実装 (`claude.yml` の `agent-ready`) と、CI の失敗の自動修正 (`claude-fix.yml`) は、GitHub Actions で動いている ([ADR-0016](0016-automated-pipeline-from-linear-to-merge.md)、[ADR-0030](0030-claude-fix-on-workflow-run.md))。
今後は、企画・設計・タスク分解・承認ゲート・並列の実装までを、Orca の Manager とワーカーで進めたい。新しいリポジトリでも同じ仕組みを使うので、汎用の部分は別リポジトリ `agent-dev-kit` で管理する。
一方で、必須チェックと自動マージは、PC が止まっていても、AI が迂回できない形で効く必要がある。

## Decision

- **Actions に残す**: CI (check・E2E・pgTAP・デプロイ)、Claude のレビュー (必須チェックのゲート)、`auto-merge.yml`、ブランチ保護。「`develop` へは自動マージ、人は `develop → main` を見る」(ADR-0016) は変えない。
- **Orca に移す**: Issue からの実装と、CI の失敗の修正。修正は、実装したワーカー本人が行う。PR を作った後に `gh pr checks --watch` で CI を待ち、失敗していれば直して push する (同じ原因で 3 回まで)。取りこぼしは、定期実行の Scout が拾う。
- **ブランチ**: Orca のワーカーは `agent/<key>-<slug>` で作業する。人の作業は `feature/<key>` のまま。`auto-merge.yml` の対象は `agent/` だけにする。
- **Actions のエージェントは止める**: `claude.yml` (`agent-ready` と `@claude`) と `claude-fix.yml` を消す。`claude/` のブランチは今後作らないので、既存のもの (すべてマージ済み) も消す。ADR-0009・ADR-0013・ADR-0030 は deprecated にする。並走はしない。

## Alternatives Considered

### Alternative 1: Actions のまま続ける

- **Pros**: PC の状態に関係なく動く。すでに実機で動いている。
- **Cons**: 承認ゲートを挟む企画・設計・並列実行が組みにくい。`claude-fix.yml` の `workflow_run` の配線やトークンの扱いなど、自作の部分の手入れが要る。
- **Why not**: 企画から統合までを1つの流れで進めたい、という目的に合わない。

### Alternative 2: CI とマージも含めて、すべて Orca に移す

- **Pros**: 仕組みが1か所にまとまる。
- **Cons**: PC と Orca が止まると、検査もマージの判定も止まる。AI と同じ場所で検査が動くので、迂回を防げない。
- **Why not**: 必須チェックは、AI の外で強制する必要がある。

### Alternative 3: ワーカーのブランチを `feature/<key>` にする

- **Pros**: 規約が1つで済む。
- **Cons**: 人の PR と区別できず、自動マージの条件に使えない。
- **Why not**: 自動マージの対象を、ブランチ名で絞りたい。

### Alternative 4: ワーカーのブランチを `orca/` や `ai/` にする

- **Pros**: `orca/` は、どの仕組みの持ち物かが分かる。`ai/` は短い。
- **Cons**: `orca/` はツールを替えると名前も変わる。`ai/` は短すぎて検索で紛れる。
- **Why not**: `agent/` は「AI が作り、自動マージの対象」という役割を表し、ツールにも依存しない。

## Consequences

### Positive

- 企画から統合までを、承認ゲート付きの1つの流れで進められる。
- 修正を、変更の文脈を持つワーカー本人に頼める。Orca は持ち主のアカウントで push するので、修正の push で CI が走る (ADR-0016 の Alternative 4 の問題が起きない)。
- 汎用の部分を `agent-dev-kit` から APM と再利用ワークフローで配れる。

### Negative

- Orca のエージェントの作業は、PC (WSL) と Orca が起動している間しか進まない。止まっても、CI が赤の PR はマージされないので、安全側に倒れる。
- Orca の経路を確かめる前に Actions の経路を止めるので、確かめ終わるまで、エージェントに頼む手段は Orca だけになる。

### Risks

- **`agent/` のブランチは、名前だけで自動マージの対象になる。** 書き込めるのが持ち主だけ、という前提で成り立つ。共同作業者を増やすときは、作成者でも絞る。
- **Orca の bot は持ち主として動くので、持ち主の操作 (ラベル・コメント) では起動しない。** Scout などは、ラベルではなく定期実行か CI のイベントで起動する。
- **Orca の経路は、一部しか試していない。** XCL-118 (XCL-127・XCL-128、PR #156・#157) で、setup の `apm install --frozen`、`agent/` への切り替え、`ask` と `reply`、CI を待つこと、自動マージ、2 つのワーカーの並列を確かめた (XCL-121)。ゲート A・B、`local-db` の直列化、3 回で直らなかったときの止まり方は、まだ確かめていない。
- **ワーカーの worktree は、Orca が最初に作ったブランチ (`<ユーザー名>/...`) から `agent/` に切り替える。** Orca のブランチの接頭辞を `agent` にすると、人が Orca で作る worktree も自動マージの対象になるため、設定では変えない。最初のブランチは push されずに残るので、worktree と一緒に消す。
- **ワーカーの権限の制限 (`settings.json` の deny、Reviewer の読み取り専用) は、強制ではない。** 最終的な防御は、GitHub のブランチ保護と必須チェック。
